"""Parity gate: the converted .tflite output must match the PyTorch output (ADR-0004).

Compares heatmap error and decoded ball-position pixel distance between the source PyTorch
model and the converted .tflite model on the same input. Inputs are per-frame heatmap stacks
of shape ``(num_frames, height, width)``.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from .heatmap import decode_heatmap


@dataclass(frozen=True)
class ParityResult:
    max_abs_error: float
    mean_abs_error: float
    max_pixel_distance: float

    def passes(
        self,
        *,
        max_pixel_distance: float = 3.0,
        max_mean_abs_error: float = 0.05,
    ) -> bool:
        return (
            self.max_pixel_distance <= max_pixel_distance
            and self.mean_abs_error <= max_mean_abs_error
        )


def _max_decoded_pixel_distance(
    a: NDArray[np.float32],
    b: NDArray[np.float32],
) -> float:
    """Largest Euclidean gap between the two stacks' decoded peaks (frames where both present)."""
    worst = 0.0
    for hm_a, hm_b in zip(a, b, strict=True):
        point_a, _ = decode_heatmap(hm_a, threshold=0.0)
        point_b, _ = decode_heatmap(hm_b, threshold=0.0)
        if point_a is None or point_b is None:
            continue
        gap = float(np.hypot(point_a[0] - point_b[0], point_a[1] - point_b[1]))
        worst = max(worst, gap)
    return worst


def compare(
    torch_heatmaps: NDArray[np.float32],
    tflite_heatmaps: NDArray[np.float32],
) -> ParityResult:
    """Compute parity metrics between two ``(num_frames, height, width)`` heatmap stacks."""
    if torch_heatmaps.shape != tflite_heatmaps.shape:
        raise ValueError(
            f"shape mismatch: torch {torch_heatmaps.shape} vs tflite {tflite_heatmaps.shape}"
        )
    diff = np.abs(torch_heatmaps - tflite_heatmaps)
    return ParityResult(
        max_abs_error=float(diff.max()),
        mean_abs_error=float(diff.mean()),
        max_pixel_distance=_max_decoded_pixel_distance(torch_heatmaps, tflite_heatmaps),
    )
