"""Datasets and target encoding for ball-tracking training.

A clip is a sequence of RGB frames with a per-frame ball position. The model consumes
``num_frames`` consecutive frames (stacked on the channel axis) and predicts one Gaussian
heatmap per frame. Datasets:

- ``ClipDataset`` — clips stored as ``frames.npy`` + ``labels.csv`` (our own captured data).
- ``ImageClipDataset`` — clips stored as per-frame image files + ``labels.csv`` (TrackNet-style
  public datasets, and frames extracted from your own video).
- ``SyntheticBallDataset`` — a generated moving ball, to exercise the pipeline without footage.

On-disk clip layout (one directory per clip):
    <clip>/frames.npy   uint8 (T, H, W, 3)         [ClipDataset]
    <clip>/*.png        one image file per frame    [ImageClipDataset]
    <clip>/labels.csv   header ``frame,visibility,x,y`` (x,y ignored when visibility == 0)
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


def _read_image(path: Path) -> NDArray[np.uint8]:
    from PIL import Image

    with Image.open(path) as image:
        pixels: NDArray[np.uint8] = np.asarray(image.convert("RGB"), dtype=np.uint8)
    return pixels


@dataclass(frozen=True)
class _Window:
    clip_index: int
    start: int


class _FrameClipDataset(Dataset[tuple[Tensor, Tensor]]):
    """Base for clip datasets: sliding windows of consecutive frames with Gaussian targets."""

    def __init__(self, num_frames: int, sigma: float) -> None:
        if num_frames <= 0:
            raise ValueError(f"num_frames must be positive, got {num_frames}")
        self.num_frames = num_frames
        self.sigma = sigma
        self._clips: list[tuple[NDArray[np.uint8], list[Point | None]]] = []
        self._windows: list[_Window] = []

    def _add_clip(self, frames: NDArray[np.uint8], positions: list[Point | None]) -> None:
        if len(positions) != len(frames):
            raise ValueError(f"{len(frames)} frames but {len(positions)} labels")
        clip_index = len(self._clips)
        self._clips.append((frames, positions))
        for start in range(len(frames) - self.num_frames + 1):
            self._windows.append(_Window(clip_index, start))

    def _finalize(self, root: str) -> None:
        if not self._windows:
            raise ValueError(f"no clips with at least {self.num_frames} frames under {root!r}")

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


def _clip_dirs(root: str) -> list[Path]:
    clip_dirs = sorted(path for path in Path(root).iterdir() if path.is_dir())
    if not clip_dirs:
        raise ValueError(f"no clip directories found under {root!r}")
    return clip_dirs


class ClipDataset(_FrameClipDataset):
    """Clips stored as ``<clip>/frames.npy`` (uint8 T,H,W,3) + ``<clip>/labels.csv``."""

    def __init__(self, root: str, num_frames: int = 3, sigma: float = DEFAULT_SIGMA) -> None:
        super().__init__(num_frames, sigma)
        for clip_dir in _clip_dirs(root):
            frames: NDArray[np.uint8] = np.load(clip_dir / "frames.npy")
            self._add_clip(frames, _read_labels(clip_dir / "labels.csv"))
        self._finalize(root)


class ImageClipDataset(_FrameClipDataset):
    """Clips stored as per-frame image files + ``labels.csv`` (TrackNet-style data, or frames
    extracted from your own video). Each subdirectory of ``root`` is one clip; frames are the
    images matching ``image_glob`` sorted by name, and must share a common size. Requires Pillow.
    """

    def __init__(
        self,
        root: str,
        num_frames: int = 3,
        sigma: float = DEFAULT_SIGMA,
        labels_name: str = "labels.csv",
        image_glob: str = "*.png",
    ) -> None:
        super().__init__(num_frames, sigma)
        for clip_dir in _clip_dirs(root):
            # Sort numerically: with names like 0.png..10.png, (length, name) puts 2 before 10.
            frame_paths = sorted(clip_dir.glob(image_glob), key=lambda p: (len(p.stem), p.stem))
            if not frame_paths:
                continue
            frames = np.stack([_read_image(path) for path in frame_paths])
            self._add_clip(frames, _read_labels(clip_dir / labels_name))
        self._finalize(root)


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
