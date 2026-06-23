import pytest

torch = pytest.importorskip("torch")

from snarl_ml.model import LightTrackNet, sample_input  # noqa: E402


def test_output_shape_and_range() -> None:
    model = LightTrackNet(num_frames=3).eval()
    inputs = sample_input(num_frames=3, height=64, width=64)
    with torch.no_grad():
        out = model(inputs)
    assert tuple(out.shape) == (1, 3, 64, 64)
    assert float(out.min()) >= 0.0
    assert float(out.max()) <= 1.0


def test_rejects_wrong_channel_count() -> None:
    model = LightTrackNet(num_frames=3)
    with pytest.raises(ValueError):
        model(torch.zeros(1, 6, 64, 64))


def test_invalid_construction_raises() -> None:
    with pytest.raises(ValueError):
        LightTrackNet(num_frames=0)
