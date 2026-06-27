from __future__ import annotations

import pytest

from snarl_ml.heatmap import Point
from snarl_ml.trajectory import rectify_track


def _parabola(n: int) -> list[Point]:
    # A smooth curved path, like a ball arc, sampled once per frame.
    return [(10 + 4 * t, 100 - (t - 8) * (t - 8)) for t in range(n)]


def test_clean_track_is_left_essentially_unchanged() -> None:
    track: list[Point | None] = list(_parabola(16))
    rectified = rectify_track(track, curve_tolerance=5.0)
    for original, fixed in zip(track, rectified, strict=True):
        assert fixed is not None
        assert abs(original[0] - fixed[0]) <= 1
        assert abs(original[1] - fixed[1]) <= 1


def test_outlier_is_pulled_back_onto_the_curve() -> None:
    track: list[Point | None] = list(_parabola(16))
    truth = track[8]
    track[8] = (300, 20)  # a gross distractor far from the real path
    rectified = rectify_track(track, curve_tolerance=12.0)
    fixed = rectified[8]
    assert fixed is not None
    assert abs(fixed[0] - truth[0]) <= 3
    assert abs(fixed[1] - truth[1]) <= 3


def test_gap_is_filled_from_the_curve() -> None:
    track: list[Point | None] = list(_parabola(16))
    truth = track[8]
    track[8] = None  # a missed detection
    rectified = rectify_track(track, curve_tolerance=12.0)
    fixed = rectified[8]
    assert fixed is not None
    assert abs(fixed[0] - truth[0]) <= 3
    assert abs(fixed[1] - truth[1]) <= 3


def test_too_few_detections_leaves_frame_untouched() -> None:
    track: list[Point | None] = [None, None, (5, 5), None, None]
    assert rectify_track(track, curve_tolerance=10.0) == track


def test_no_extrapolation_beyond_detected_span() -> None:
    # The only detections sit early; trailing gaps must not be invented from an extrapolated curve.
    track: list[Point | None] = [*_parabola(6), None, None, None, None]
    rectified = rectify_track(track, curve_tolerance=10.0)
    assert rectified[7] is None
    assert rectified[9] is None


@pytest.mark.parametrize(
    "kwargs",
    [{"window": 2}, {"min_points": 2}, {"curve_tolerance": 0.0}, {"max_deviation": 0.0}],
)
def test_invalid_parameters_raise(kwargs: dict[str, float]) -> None:
    with pytest.raises(ValueError):
        rectify_track(list(_parabola(8)), **kwargs)
