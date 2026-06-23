"""Gaussian heatmap encoding/decoding for ball-position targets.

The tracker regresses a 2D Gaussian heatmap per frame instead of a bounding box: the target
is a small Gaussian bump centred on the ball, and the predicted position is the heatmap peak.
These functions are pure and NumPy-only so the target pipeline and the decode step are
testable without the model or any ML runtime.
"""

from __future__ import annotations

import math
from typing import Final

import numpy as np
from numpy.typing import NDArray

# TrackNet uses a Gaussian target with variance ~10 px^2 (a peak a few pixels wide, matching a
# small fast ball). Exposed as the standard deviation for clarity.
DEFAULT_SIGMA: Final[float] = math.sqrt(10.0)

Point = tuple[int, int]


def gaussian_heatmap(
    height: int,
    width: int,
    center: Point | None,
    sigma: float = DEFAULT_SIGMA,
) -> NDArray[np.float32]:
    """Render a heatmap with a unit-peak Gaussian at ``center`` (``(x, y)`` in pixels).

    ``center`` is ``None`` when the ball is absent, giving an all-zero map. Raises
    ``ValueError`` on non-positive dimensions or sigma.
    """
    if height <= 0 or width <= 0:
        raise ValueError(f"height and width must be positive, got {height}x{width}")
    if sigma <= 0.0:
        raise ValueError(f"sigma must be positive, got {sigma}")

    if center is None:
        return np.zeros((height, width), dtype=np.float32)

    x0, y0 = center
    ys = np.arange(height, dtype=np.float32).reshape(height, 1)
    xs = np.arange(width, dtype=np.float32).reshape(1, width)
    squared_distance = (xs - x0) ** 2 + (ys - y0) ** 2
    return np.exp(-squared_distance / (2.0 * sigma * sigma)).astype(np.float32)


def decode_heatmap(
    heatmap: NDArray[np.float32],
    threshold: float = 0.5,
) -> tuple[Point | None, float]:
    """Return ``((x, y), confidence)`` for the heatmap peak.

    When the peak is below ``threshold`` the ball is treated as absent and the position is
    ``None`` (``confidence`` is still the peak value). Raises ``ValueError`` if not 2D.
    """
    if heatmap.ndim != 2:
        raise ValueError(f"heatmap must be 2D, got shape {heatmap.shape}")

    flat_index = int(np.argmax(heatmap))
    y, x = np.unravel_index(flat_index, heatmap.shape)
    confidence = float(heatmap[y, x])
    if confidence < threshold:
        return None, confidence
    return (int(x), int(y)), confidence
