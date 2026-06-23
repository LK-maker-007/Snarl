"""Train the ball-tracking heatmap model.

Trains LightTrackNet on synthetic clips (default, to validate the pipeline), on-disk npy clips
(``--data-dir``), or image-frame clips (``--image-dir``, e.g. TrackNet data). Reports per-epoch
loss and mean decoded pixel error on a held-out split, and saves the best checkpoint. Optionally
warm-starts from a checkpoint (``--init-from``) to fine-tune. Requires torch; run on a machine or
Colab with a GPU for real training. The pipeline (loss decreasing, error reported) is what this
validates — real accuracy requires real, consented cricket data.
"""

from __future__ import annotations

import argparse
from collections.abc import Sized
from dataclasses import dataclass
from typing import cast

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset, random_split

from .data import ClipDataset, ImageClipDataset, SyntheticBallDataset
from .losses import mean_pixel_error, weighted_heatmap_loss
from .model import LightTrackNet


@dataclass(frozen=True)
class EpochStats:
    epoch: int
    train_loss: float
    val_loss: float
    val_pixel_error: float


def _evaluate(
    model: nn.Module,
    loader: DataLoader[tuple[torch.Tensor, torch.Tensor]],
    device: torch.device,
) -> tuple[float, float]:
    model.eval()
    total_loss = 0.0
    batches = 0
    errors: list[float] = []
    with torch.no_grad():
        for frames, target in loader:
            frames, target = frames.to(device), target.to(device)
            pred = model(frames)
            total_loss += float(weighted_heatmap_loss(pred, target))
            errors.append(mean_pixel_error(pred.cpu().numpy(), target.cpu().numpy()))
            batches += 1
    mean_loss = total_loss / batches if batches else 0.0
    return mean_loss, float(np.mean(errors)) if errors else 0.0


def run_training(
    dataset: Dataset[tuple[torch.Tensor, torch.Tensor]],
    *,
    num_frames: int = 3,
    epochs: int = 5,
    batch_size: int = 8,
    learning_rate: float = 1e-3,
    seed: int = 0,
    checkpoint_path: str | None = None,
    init_from: str | None = None,
) -> list[EpochStats]:
    """Train the model and return per-epoch stats, saving the best checkpoint if a path is given."""
    torch.manual_seed(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    total = len(cast(Sized, dataset))
    val_len = max(1, total // 5)
    train_set, val_set = random_split(
        dataset, [total - val_len, val_len], generator=torch.Generator().manual_seed(seed)
    )
    train_loader: DataLoader[tuple[torch.Tensor, torch.Tensor]] = DataLoader(
        train_set, batch_size=batch_size, shuffle=True
    )
    val_loader: DataLoader[tuple[torch.Tensor, torch.Tensor]] = DataLoader(
        val_set, batch_size=batch_size
    )

    model = LightTrackNet(num_frames=num_frames).to(device)
    if init_from is not None:
        model.load_state_dict(torch.load(init_from, map_location=device))
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)

    history: list[EpochStats] = []
    best_error = float("inf")
    for epoch in range(1, epochs + 1):
        model.train()
        running = 0.0
        batches = 0
        for frames, target in train_loader:
            frames, target = frames.to(device), target.to(device)
            optimizer.zero_grad()
            loss = weighted_heatmap_loss(model(frames), target)
            loss.backward()
            optimizer.step()
            running += float(loss)
            batches += 1
        train_loss = running / batches if batches else 0.0
        val_loss, val_pixel_error = _evaluate(model, val_loader, device)
        history.append(EpochStats(epoch, train_loss, val_loss, val_pixel_error))
        if checkpoint_path is not None and val_pixel_error < best_error:
            best_error = val_pixel_error
            torch.save(model.state_dict(), checkpoint_path)
    return history


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the ball-tracking heatmap model.")
    parser.add_argument("--data-dir", default=None, help="npy clips; omit for synthetic")
    parser.add_argument("--image-dir", default=None, help="image-frame clips (e.g. TrackNet data)")
    parser.add_argument("--image-glob", default="*.png", help="frame glob for --image-dir")
    parser.add_argument("--frames", type=int, default=3)
    parser.add_argument("--height", type=int, default=64)
    parser.add_argument("--width", type=int, default=64)
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--out", default="checkpoint.pt")
    parser.add_argument("--init-from", default=None, help="load weights from this checkpoint first")
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    dataset: Dataset[tuple[torch.Tensor, torch.Tensor]]
    if args.image_dir is not None:
        dataset = ImageClipDataset(
            args.image_dir, num_frames=args.frames, image_glob=args.image_glob
        )
        source = args.image_dir
    elif args.data_dir is not None:
        dataset = ClipDataset(args.data_dir, num_frames=args.frames)
        source = args.data_dir
    else:
        dataset = SyntheticBallDataset(
            num_frames=args.frames, height=args.height, width=args.width, seed=args.seed
        )
        source = "synthetic"
    print(f"training on {source} data")
    history = run_training(
        dataset,
        num_frames=args.frames,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        seed=args.seed,
        checkpoint_path=args.out,
        init_from=args.init_from,
    )
    for stats in history:
        print(
            f"epoch {stats.epoch}: train_loss={stats.train_loss:.4f} "
            f"val_loss={stats.val_loss:.4f} val_px={stats.val_pixel_error:.2f}"
        )
    best = min(stats.val_pixel_error for stats in history)
    print(f"best val pixel error: {best:.2f} px (checkpoint: {args.out})")


if __name__ == "__main__":
    main()
