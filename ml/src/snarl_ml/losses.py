"""Heatmap training loss and decoded-position metrics."""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray
from torch import Tensor

from .heatmap import decode_heatmap


def weighted_heatmap_loss(
    pred: Tensor,
    target: Tensor,
    foreground_weight: float = 50.0,
) -> Tensor:
    """Foreground-weighted MSE between predicted and target heatmaps.

    The target is almost entirely zero (the ball is a few pixels), so a plain MSE is dominated
    by background. Weighting each pixel by ``1 + foreground_weight * target`` concentrates the
    loss where the ball is.
    """
    if pred.shape != target.shape:
        raise ValueError(
            f"shape mismatch: pred {tuple(pred.shape)} vs target {tuple(target.shape)}"
        )
    weight = 1.0 + foreground_weight * target
    loss: Tensor = (weight * (pred - target) ** 2).mean()
    return loss


def mean_pixel_error(pred: NDArray[np.float32], target: NDArray[np.float32]) -> float:
    """Mean Euclidean distance (px) between decoded peaks, over any ``(..., H, W)`` batch."""
    if pred.shape != target.shape:
        raise ValueError(
            f"shape mismatch: pred {pred.shape} vs target {target.shape}"
        )
    height, width = pred.shape[-2], pred.shape[-1]
    pred_maps = pred.reshape(-1, height, width)
    target_maps = target.reshape(-1, height, width)

    distances: list[float] = []
    for predicted, expected in zip(pred_maps, target_maps, strict=True):
        predicted_point, _ = decode_heatmap(predicted, threshold=0.0)
        expected_point, _ = decode_heatmap(expected, threshold=0.0)
        if predicted_point is None or expected_point is None:
            continue
        dx = predicted_point[0] - expected_point[0]
        dy = predicted_point[1] - expected_point[1]
        distances.append(float(np.hypot(dx, dy)))
    return float(np.mean(distances)) if distances else 0.0
