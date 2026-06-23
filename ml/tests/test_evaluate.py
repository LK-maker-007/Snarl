import pytest

torch = pytest.importorskip("torch")

from snarl_ml.data import SyntheticBallDataset  # noqa: E402
from snarl_ml.evaluate import Accuracy, evaluate  # noqa: E402
from snarl_ml.model import LightTrackNet  # noqa: E402


def test_accuracy_metrics_arithmetic() -> None:
    accuracy = Accuracy(
        frames=10,
        true_positives=6,
        false_positives=2,
        false_negatives=1,
        true_negatives=1,
        median_pixel_error=2.0,
        p90_pixel_error=3.5,
    )
    assert accuracy.precision == pytest.approx(6 / 8)
    assert accuracy.recall == pytest.approx(6 / 7)
    assert accuracy.f1 == pytest.approx(2 * (6 / 8) * (6 / 7) / ((6 / 8) + (6 / 7)))
    assert accuracy.detection_accuracy == pytest.approx(7 / 10)


def test_accuracy_metrics_zero_division_safe() -> None:
    empty = Accuracy(0, 0, 0, 0, 0, 0.0, 0.0)
    assert empty.precision == 0.0
    assert empty.recall == 0.0
    assert empty.f1 == 0.0
    assert empty.detection_accuracy == 0.0


def test_evaluate_runs_and_counts_each_frame_once() -> None:
    dataset = SyntheticBallDataset(size=4, num_frames=3, height=32, width=32)
    model = LightTrackNet(num_frames=3)
    accuracy = evaluate(model, dataset, tolerance=4.0)

    assert accuracy.frames == 4  # one centre frame scored per window
    counts = (
        accuracy.true_positives
        + accuracy.false_positives
        + accuracy.false_negatives
        + accuracy.true_negatives
    )
    assert counts == accuracy.frames
    assert 0.0 <= accuracy.precision <= 1.0
    assert 0.0 <= accuracy.recall <= 1.0


def test_evaluate_rejects_nonpositive_tolerance() -> None:
    dataset = SyntheticBallDataset(size=2, num_frames=3, height=32, width=32)
    model = LightTrackNet(num_frames=3)
    with pytest.raises(ValueError, match="tolerance"):
        evaluate(model, dataset, tolerance=0.0)
