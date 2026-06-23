"""Datasets and target encoding for ball-tracking training.

A clip is a sequence of RGB frames with a per-frame ball position. The model consumes
``num_frames`` consecutive frames (stacked on the channel axis) and predicts one Gaussian
heatmap per frame. Two datasets are provided: an on-disk ``ClipDataset`` (the real-data format)
and a ``SyntheticBallDataset`` that generates a moving ball, so the training pipeline can be
exercised and tested without real footage.

On-disk clip format (one directory per clip):
    <clip>/frames.npy   uint8 array of shape (T, H, W, 3)
    <clip>/labels.csv   header ``frame,visibility,x,y``; one row per frame (x,y ignored when
                        visibility == 0, i.e. the ball is absent)
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from numpy.typing import NDArray
from torch import Tensor
from torch.utils.data import Dataset

from .heatmap import DEFAULT_SIGMA, Point, gaussian_heatmap


def targets_from_positions(
    positions: list[Point | None],
    height: int,
    width: int,
    sigma: float = DEFAULT_SIGMA,
) -> NDArray[np.float32]:
    """Stack one Gaussian heatmap per frame position into a ``(N, H, W)`` array."""
    if not positions:
        raise ValueError("positions must be non-empty")
    maps = [gaussian_heatmap(height, width, position, sigma) for position in positions]
    return np.stack(maps).astype(np.float32)


def stack_frames(frames: NDArray[np.uint8]) -> NDArray[np.float32]:
    """Convert ``(N, H, W, 3)`` uint8 frames to a ``(3N, H, W)`` float32 tensor in ``[0, 1]``."""
    normalized = frames.astype(np.float32) / 255.0
    return np.concatenate([frame.transpose(2, 0, 1) for frame in normalized]).astype(np.float32)


def _draw_disc(image: NDArray[np.uint8], center: Point, radius: int) -> None:
    x0, y0 = center
    height, width = image.shape[0], image.shape[1]
    ys = np.arange(height).reshape(height, 1)
    xs = np.arange(width).reshape(1, width)
    mask = (xs - x0) ** 2 + (ys - y0) ** 2 <= radius * radius
    image[mask] = 255


def _read_labels(path: Path) -> list[Point | None]:
    positions: list[Point | None] = []
    with path.open(newline="") as handle:
        for row in csv.DictReader(handle):
            if int(row["visibility"]) == 0:
                positions.append(None)
            else:
                positions.append((int(float(row["x"])), int(float(row["y"]))))
    return positions


@dataclass(frozen=True)
class _Window:
    clip_index: int
    start: int


class ClipDataset(Dataset[tuple[Tensor, Tensor]]):
    """Sliding windows of ``num_frames`` consecutive frames over the on-disk clips."""

    def __init__(self, root: str, num_frames: int = 3, sigma: float = DEFAULT_SIGMA) -> None:
        if num_frames <= 0:
            raise ValueError(f"num_frames must be positive, got {num_frames}")
        self.num_frames = num_frames
        self.sigma = sigma
        self._clips: list[tuple[NDArray[np.uint8], list[Point | None]]] = []
        self._windows: list[_Window] = []

        clip_dirs = sorted(path for path in Path(root).iterdir() if path.is_dir())
        if not clip_dirs:
            raise ValueError(f"no clip directories found under {root!r}")
        for clip_index, clip_dir in enumerate(clip_dirs):
            frames: NDArray[np.uint8] = np.load(clip_dir / "frames.npy")
            positions = _read_labels(clip_dir / "labels.csv")
            if len(positions) != len(frames):
                raise ValueError(f"{clip_dir}: {len(frames)} frames but {len(positions)} labels")
            self._clips.append((frames, positions))
            for start in range(len(frames) - num_frames + 1):
                self._windows.append(_Window(clip_index, start))
        if not self._windows:
            raise ValueError(f"no clips with at least {num_frames} frames under {root!r}")

    def __len__(self) -> int:
        return len(self._windows)

    def __getitem__(self, index: int) -> tuple[Tensor, Tensor]:
        window = self._windows[index]
        frames, positions = self._clips[window.clip_index]
        window_slice = slice(window.start, window.start + self.num_frames)
        height, width = int(frames.shape[1]), int(frames.shape[2])
        inputs = stack_frames(frames[window_slice])
        targets = targets_from_positions(positions[window_slice], height, width, self.sigma)
        return torch.from_numpy(inputs), torch.from_numpy(targets)


class SyntheticBallDataset(Dataset[tuple[Tensor, Tensor]]):
    """Procedurally generated clips of a bright ball moving over noise, for pipeline validation."""

    def __init__(
        self,
        size: int = 256,
        num_frames: int = 3,
        height: int = 64,
        width: int = 64,
        sigma: float = DEFAULT_SIGMA,
        seed: int = 0,
    ) -> None:
        if size <= 0:
            raise ValueError(f"size must be positive, got {size}")
        if height % 8 != 0 or width % 8 != 0:
            raise ValueError(f"height and width must be multiples of 8, got {height}x{width}")
        self.size = size
        self.num_frames = num_frames
        self.height = height
        self.width = width
        self.sigma = sigma
        self.seed = seed

    def __len__(self) -> int:
        return self.size

    def __getitem__(self, index: int) -> tuple[Tensor, Tensor]:
        rng = np.random.default_rng(self.seed + index)
        x0 = int(rng.integers(4, self.width - 4))
        y0 = int(rng.integers(4, self.height - 4))
        dx, dy = int(rng.integers(-3, 4)), int(rng.integers(-3, 4))

        frames = np.zeros((self.num_frames, self.height, self.width, 3), dtype=np.uint8)
        positions: list[Point | None] = []
        for frame_index in range(self.num_frames):
            background = rng.integers(0, 60, (self.height, self.width, 3), dtype=np.uint8)
            x = int(np.clip(x0 + dx * frame_index, 0, self.width - 1))
            y = int(np.clip(y0 + dy * frame_index, 0, self.height - 1))
            _draw_disc(background, (x, y), radius=2)
            frames[frame_index] = background
            positions.append((x, y))

        inputs = stack_frames(frames)
        targets = targets_from_positions(positions, self.height, self.width, self.sigma)
        return torch.from_numpy(inputs), torch.from_numpy(targets)
