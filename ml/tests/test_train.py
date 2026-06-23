from pathlib import Path

import pytest

torch = pytest.importorskip("torch")

from snarl_ml.data import SyntheticBallDataset  # noqa: E402
from snarl_ml.train import run_training  # noqa: E402


def test_training_reduces_loss() -> None:
    dataset = SyntheticBallDataset(size=24, num_frames=3, height=48, width=48, seed=0)
    history = run_training(
        dataset, num_frames=3, epochs=4, batch_size=8, learning_rate=2e-3, seed=0
    )
    assert len(history) == 4
    # The loop must actually optimise: training loss goes down over epochs.
    assert history[-1].train_loss < history[0].train_loss
    assert history[-1].val_pixel_error >= 0.0


def test_init_from_loads_checkpoint(tmp_path: Path) -> None:
    dataset = SyntheticBallDataset(size=16, num_frames=3, height=48, width=48, seed=0)
    checkpoint = tmp_path / "init.pt"
    run_training(
        dataset, num_frames=3, epochs=1, batch_size=8, seed=0, checkpoint_path=str(checkpoint)
    )
    assert checkpoint.exists()
    history = run_training(
        dataset, num_frames=3, epochs=1, batch_size=8, seed=0, init_from=str(checkpoint)
    )
    assert len(history) == 1
