import numpy as np
import pytest

from snarl_ml.heatmap import DEFAULT_SIGMA, decode_heatmap, gaussian_heatmap


@pytest.mark.parametrize("center", [(10, 12), (0, 0), (63, 31), (5, 27)])
def test_encode_then_decode_recovers_center(center: tuple[int, int]) -> None:
    heatmap = gaussian_heatmap(32, 64, center)
    assert heatmap.shape == (32, 64)
    assert heatmap.dtype == np.float32
    decoded, confidence = decode_heatmap(heatmap)
    assert decoded == center
    assert confidence == pytest.approx(1.0)


def test_absent_ball_is_zero_map_and_decodes_to_none() -> None:
    heatmap = gaussian_heatmap(16, 16, None)
    assert not heatmap.any()
    decoded, confidence = decode_heatmap(heatmap)
    assert decoded is None
    assert confidence == 0.0


def test_peak_is_unit_and_falls_off() -> None:
    heatmap = gaussian_heatmap(21, 21, (10, 10), sigma=2.0)
    assert heatmap[10, 10] == pytest.approx(1.0)
    assert heatmap[10, 12] < heatmap[10, 11] < heatmap[10, 10]


def test_low_peak_is_marked_absent_by_threshold() -> None:
    weak = gaussian_heatmap(16, 16, (8, 8)) * np.float32(0.1)
    decoded, confidence = decode_heatmap(weak, threshold=0.5)
    assert decoded is None
    assert confidence == pytest.approx(0.1, abs=1e-6)


@pytest.mark.parametrize("dims", [(-1, 16), (16, 0)])
def test_invalid_dimensions_raise(dims: tuple[int, int]) -> None:
    with pytest.raises(ValueError):
        gaussian_heatmap(dims[0], dims[1], (1, 1))


def test_invalid_sigma_raises() -> None:
    with pytest.raises(ValueError):
        gaussian_heatmap(16, 16, (1, 1), sigma=0.0)


def test_non_2d_heatmap_raises() -> None:
    with pytest.raises(ValueError):
        decode_heatmap(np.zeros((2, 3, 3), dtype=np.float32))


def test_default_sigma_matches_tracknet_variance() -> None:
    assert pytest.approx(10.0**0.5) == DEFAULT_SIGMA
