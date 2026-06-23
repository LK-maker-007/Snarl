"""Score a trained tracker on labeled clips: detection precision/recall and localization error.

Turns "is it accurate" into numbers on held-out data. Runs the model over a dataset, decodes the
predicted and ground-truth heatmap peaks for the centre frame of each window, and reports:

- detection precision / recall / F1, where a prediction counts as correct only when the ball is
  present and the predicted peak lands within ``tolerance`` pixels of the true position;
- the median and 90th-percentile pixel error over frames where a ball is both present and found
  (how close it is when it does find the ball).

Pixel-level localization is the foundation; coaching-grade line/length-zone accuracy needs the
stump calibration and is reported separately once that exists. Requires torch.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset

from .data import ClipDataset, ImageClipDataset, SyntheticBallDataset
from .heatmap import decode_heatmap
from .model import LightTrackNet

_GROUND_TRUTH_THRESHOLD = 0.5


@dataclass(frozen=True)
class Accuracy:
    """Detection and localization metrics over the scored frames."""

    frames: int
    true_positives: int
    false_positives: int
    false_negatives: int
    true_negatives: int
    median_pixel_error: float
    p90_pixel_error: float

    @property
    def precision(self) -> float:
        located = self.true_positives + self.false_positives
        return self.true_positives / located if located else 0.0

    @property
    def recall(self) -> float:
        present = self.true_positives + self.false_negatives
        return self.true_positives / present if present else 0.0

    @property
    def f1(self) -> float:
        precision, recall = self.precision, self.recall
        return 2.0 * precision * recall / (precision + recall) if precision + recall else 0.0

    @property
    def detection_accuracy(self) -> float:
        return (self.true_positives + self.true_negatives) / self.frames if self.frames else 0.0


def evaluate(
    model: nn.Module,
    dataset: Dataset[tuple[torch.Tensor, torch.Tensor]],
    *,
    tolerance: float = 4.0,
    threshold: float = 0.5,
    batch_size: int = 8,
) -> Accuracy:
    """Score ``model`` over the centre frame of every window in ``dataset``.

    A prediction is a true positive when the ball is present and the decoded peak is within
    ``tolerance`` px; ``threshold`` is the confidence below which a prediction is "no ball".
    Scoring only the centre frame counts each clip frame once despite the sliding windows.
    """
    if tolerance <= 0.0:
        raise ValueError(f"tolerance must be positive, got {tolerance}")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device).eval()
    loader: DataLoader[tuple[torch.Tensor, torch.Tensor]] = DataLoader(
        dataset, batch_size=batch_size
    )

    true_positives = false_positives = false_negatives = true_negatives = 0
    located_errors: list[float] = []
    with torch.no_grad():
        for frames, targets in loader:
            predictions = model(frames.to(device)).cpu().numpy()
            truth = targets.numpy()
            centre = predictions.shape[1] // 2
            for predicted_map, expected_map in zip(
                predictions[:, centre], truth[:, centre], strict=True
            ):
                predicted, _ = decode_heatmap(predicted_map, threshold=threshold)
                expected, _ = decode_heatmap(expected_map, threshold=_GROUND_TRUTH_THRESHOLD)
                if expected is None:
                    if predicted is None:
                        true_negatives += 1
                    else:
                        false_positives += 1
                    continue
                if predicted is None:
                    false_negatives += 1
                    continue
                distance = float(np.hypot(predicted[0] - expected[0], predicted[1] - expected[1]))
                located_errors.append(distance)
                if distance <= tolerance:
                    true_positives += 1
                else:
                    false_positives += 1

    errors = np.asarray(located_errors, dtype=np.float64)
    return Accuracy(
        frames=true_positives + false_positives + false_negatives + true_negatives,
        true_positives=true_positives,
        false_positives=false_positives,
        false_negatives=false_negatives,
        true_negatives=true_negatives,
        median_pixel_error=float(np.median(errors)) if errors.size else 0.0,
        p90_pixel_error=float(np.percentile(errors, 90)) if errors.size else 0.0,
    )


def _load_dataset(
    args: argparse.Namespace,
) -> tuple[Dataset[tuple[torch.Tensor, torch.Tensor]], str]:
    if args.image_dir is not None:
        return (
            ImageClipDataset(args.image_dir, num_frames=args.frames, image_glob=args.image_glob),
            args.image_dir,
        )
    if args.data_dir is not None:
        return ClipDataset(args.data_dir, num_frames=args.frames), args.data_dir
    return (
        SyntheticBallDataset(num_frames=args.frames, height=args.height, width=args.width),
        "synthetic",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Score a trained tracker on labeled clips.")
    parser.add_argument("--checkpoint", required=True, help="trained model checkpoint (.pt)")
    parser.add_argument("--data-dir", default=None, help="npy clips; omit for synthetic")
    parser.add_argument("--image-dir", default=None, help="image-frame clips (e.g. TrackNet data)")
    parser.add_argument("--image-glob", default="*.png", help="frame glob for --image-dir")
    parser.add_argument("--frames", type=int, default=3)
    parser.add_argument("--height", type=int, default=64, help="synthetic-only frame height")
    parser.add_argument("--width", type=int, default=64, help="synthetic-only frame width")
    parser.add_argument("--tolerance", type=float, default=4.0, help="hit radius in px")
    parser.add_argument("--threshold", type=float, default=0.5, help="ball-present confidence")
    parser.add_argument("--batch-size", type=int, default=8)
    args = parser.parse_args()

    dataset, source = _load_dataset(args)
    model = LightTrackNet(num_frames=args.frames)
    model.load_state_dict(torch.load(args.checkpoint, map_location="cpu"))
    accuracy = evaluate(
        model,
        dataset,
        tolerance=args.tolerance,
        threshold=args.threshold,
        batch_size=args.batch_size,
    )

    print(
        f"evaluated {accuracy.frames} frames on {source} data "
        f"(tolerance {args.tolerance:.0f} px)"
    )
    print(
        f"  detection: precision={accuracy.precision:.3f} "
        f"recall={accuracy.recall:.3f} f1={accuracy.f1:.3f} "
        f"accuracy={accuracy.detection_accuracy:.3f}"
    )
    print(
        f"  localization: median={accuracy.median_pixel_error:.2f} px "
        f"p90={accuracy.p90_pixel_error:.2f} px"
    )
    print(
        f"  counts: tp={accuracy.true_positives} fp={accuracy.false_positives} "
        f"fn={accuracy.false_negatives} tn={accuracy.true_negatives}"
    )


if __name__ == "__main__":
    main()
