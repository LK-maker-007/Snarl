from pathlib import Path

import pytest
import torch

from snarl_ml.export import load_checkpoint
from snarl_ml.model import LightTrackNet


def test_load_checkpoint_roundtrip(tmp_path: Path) -> None:
    torch.manual_seed(0)
    original = LightTrackNet(num_frames=3).eval()
    checkpoint = tmp_path / "model.pt"
    torch.save(original.state_dict(), checkpoint)

    loaded = load_checkpoint(str(checkpoint), num_frames=3)
    assert not loaded.training  # eval mode is required for deterministic export

    probe = torch.zeros(1, 9, 80, 64)
    with torch.no_grad():
        expected = original(probe)
        actual = loaded(probe)
    assert actual.shape == (1, 3, 80, 64)
    assert torch.allclose(expected, actual)


def test_load_checkpoint_rejects_mismatched_architecture(tmp_path: Path) -> None:
    checkpoint = tmp_path / "model.pt"
    torch.save(LightTrackNet(num_frames=3).state_dict(), checkpoint)
    with pytest.raises(RuntimeError):
        load_checkpoint(str(checkpoint), num_frames=5)
