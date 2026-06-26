"""Trajectory rectification for a per-frame ball track.

The tracker emits one ``(x, y)`` peak or ``None`` per frame; some detections are wrong (a
distractor won the heatmap) or missing (low confidence). A ball follows a smooth path, so the
surrounding detections constrain where it must be. Two stages, mirroring the trajectory
rectification in the TrackNet family this tracker is built on:

1. Gate gross outliers: drop a detection that sits far from the straight line between its nearest
   detected neighbours (a spike onto a distractor), so it cannot corrupt the fit below.
2. Curve fit: over a sliding window, fit a quadratic to the surviving detections, replace any that
   still lie far from it, and fill gaps from it (no extrapolation past the detected span).

Pure and NumPy-only: it operates on the decoded point sequence, independent of the model or
runtime, so it is testable in isolation and portable to the on-device pipeline.
"""

from __future__ import annotations

import numpy as np

from .heatmap import Point

_DEGREE = 2


def _nearest(points: list[Point | None], index: int, step: int) -> tuple[int, Point] | None:
    """Return the nearest non-empty ``(index, point)`` from ``index`` walking by ``step``."""
    j = index + step
    while 0 <= j < len(points):
        point = points[j]
        if point is not None:
            return j, point
        j += step
    return None


def _gate_outliers(points: list[Point | None], max_deviation: float) -> list[Point | None]:
    """Drop detections that deviate from the linear interpolation of their nearest neighbours."""
    gated: list[Point | None] = list(points)
    for i, current in enumerate(points):
        if current is None:
            continue
        previous = _nearest(points, i, -1)
        following = _nearest(points, i, 1)
        if previous is None or following is None:
            continue
        (pi, pp), (fi, fp) = previous, following
        fraction = (i - pi) / (fi - pi)
        expected_x = pp[0] + (fp[0] - pp[0]) * fraction
        expected_y = pp[1] + (fp[1] - pp[1]) * fraction
        if float(np.hypot(current[0] - expected_x, current[1] - expected_y)) > max_deviation:
            gated[i] = None
    return gated


def _fit_eval(
    indices: list[int],
    xs: list[float],
    ys: list[float],
    target: int,
    tolerance: float,
    min_points: int,
) -> Point:
    """Fit a quadratic to the window points (with one outlier-trimming refit) and evaluate it at
    ``target`` frame index."""
    t = np.asarray(indices, dtype=np.float64)
    x = np.asarray(xs, dtype=np.float64)
    y = np.asarray(ys, dtype=np.float64)
    coeff_x = np.polyfit(t, x, _DEGREE)
    coeff_y = np.polyfit(t, y, _DEGREE)
    residual = np.hypot(x - np.polyval(coeff_x, t), y - np.polyval(coeff_y, t))
    inliers = residual <= tolerance
    if not inliers.all() and int(inliers.sum()) >= min_points:
        t, x, y = t[inliers], x[inliers], y[inliers]
        coeff_x = np.polyfit(t, x, _DEGREE)
        coeff_y = np.polyfit(t, y, _DEGREE)
    return round(float(np.polyval(coeff_x, target))), round(float(np.polyval(coeff_y, target)))


def _curve_fill(
    points: list[Point | None],
    window: int,
    curve_tolerance: float,
    min_points: int,
) -> list[Point | None]:
    """Replace off-curve detections and fill gaps from a sliding-window quadratic fit."""
    half = window // 2
    refined: list[Point | None] = list(points)
    for i in range(len(points)):
        lo, hi = max(0, i - half), min(len(points), i + half + 1)
        indices: list[int] = []
        xs: list[float] = []
        ys: list[float] = []
        for j in range(lo, hi):
            nearby = points[j]
            if nearby is not None:
                indices.append(j)
                xs.append(float(nearby[0]))
                ys.append(float(nearby[1]))
        if len(indices) < min_points or i < indices[0] or i > indices[-1]:
            continue
        fit = _fit_eval(indices, xs, ys, i, curve_tolerance, min_points)
        original = points[i]
        if original is None or float(np.hypot(original[0] - fit[0], original[1] - fit[1])) > (
            curve_tolerance
        ):
            refined[i] = fit
    return refined


def rectify_track(
    points: list[Point | None],
    *,
    window: int = 7,
    curve_tolerance: float = 12.0,
    min_points: int = 4,
    max_deviation: float = 25.0,
) -> list[Point | None]:
    """Return a rectified copy of ``points`` with spikes removed, outliers replaced, gaps filled.

    First gross spikes (further than ``max_deviation`` px from the line between their nearest
    detected neighbours) are dropped; then a quadratic is fit over a ``window``-frame span centred
    on each frame, replacing detections more than ``curve_tolerance`` px from it and filling gaps
    that lie within the window's detected span. Frames with fewer than ``min_points`` nearby
    detections are left unchanged. Raises ``ValueError`` on invalid parameters.
    """
    if window < 3:
        raise ValueError(f"window must be at least 3, got {window}")
    if min_points <= _DEGREE:
        raise ValueError(f"min_points must exceed degree {_DEGREE}, got {min_points}")
    if curve_tolerance <= 0.0:
        raise ValueError(f"curve_tolerance must be positive, got {curve_tolerance}")
    if max_deviation <= 0.0:
        raise ValueError(f"max_deviation must be positive, got {max_deviation}")

    gated = _gate_outliers(points, max_deviation)
    return _curve_fill(gated, window, curve_tolerance, min_points)
