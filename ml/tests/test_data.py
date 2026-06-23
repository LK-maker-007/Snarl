import csv

import numpy as np
import pytest

torch = pytest.importorskip("torch")

from snarl_ml.data import (  # noqa: E402
    ClipDataset,
    ImageClipDataset,
    SyntheticBallDataset,
    stack_frames,
    targets_from_positions,
)


def test_targets_from_positions_shape_and_peak() -> None:
    targets = targets_from_positions([(2, 3), None, (5, 5)], height=16, width=16)
    assert targets.shape == (3, 16, 16)
    assert targets[0, 3, 2] == pytest.approx(1.0)  # (x=2, y=3)
    assert not targets[1].any()  # absent ball


def test_stack_frames_shape_and_range() -> None:
    frames = np.full((2, 8, 8, 3), 255, dtype=np.uint8)
    stacked = stack_frames(frames)
    assert stacked.shape == (6, 8, 8)
    assert stacked.dtype == np.float32
    assert stacked.max() == pytest.approx(1.0)


def test_synthetic_dataset_item_shapes() -> None:
    dataset = SyntheticBallDataset(size=4, num_frames=3, height=32, width=32)
    assert len(dataset) == 4
    frames, targets = dataset[0]
    assert tuple(frames.shape) == (9, 32, 32)
    assert tuple(targets.shape) == (3, 32, 32)
    assert float(targets.max()) == pytest.approx(1.0)


def test_clip_dataset_roundtrip(tmp_path) -> None:  # type: ignore[no-untyped-def]
    clip = tmp_path / "clip0"
    clip.mkdir()
    np.save(clip / "frames.npy", np.zeros((4, 16, 16, 3), dtype=np.uint8))
    with (clip / "labels.csv").open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["frame", "visibility", "x", "y"])
        for frame in range(4):
            writer.writerow([frame, 1, frame + 2, frame + 3])

    dataset = ClipDataset(str(tmp_path), num_frames=3)
    assert len(dataset) == 2  # windows: 4 - 3 + 1
    frames, targets = dataset[0]
    assert tuple(frames.shape) == (9, 16, 16)
    assert tuple(targets.shape) == (3, 16, 16)


def test_image_clip_dataset_roundtrip(tmp_path) -> None:  # type: ignore[no-untyped-def]
    from PIL import Image

    clip = tmp_path / "clip0"
    clip.mkdir()
    for frame in range(4):
        Image.fromarray(np.zeros((16, 16, 3), dtype=np.uint8)).save(clip / f"{frame:03d}.png")
    with (clip / "labels.csv").open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["frame", "visibility", "x", "y"])
        for frame in range(4):
            writer.writerow([frame, 1, frame + 2, frame + 3])

    dataset = ImageClipDataset(str(tmp_path), num_frames=3)
    assert len(dataset) == 2
    frames, targets = dataset[0]
    assert tuple(frames.shape) == (9, 16, 16)
    assert tuple(targets.shape) == (3, 16, 16)


def test_image_clip_dataset_natural_frame_order(tmp_path) -> None:  # type: ignore[no-untyped-def]
    from PIL import Image

    clip = tmp_path / "clip0"
    clip.mkdir()
    count = 12  # 0.png .. 11.png — lexicographic order would wrongly put 10/11 before 2
    for i in range(count):
        Image.fromarray(np.full((8, 8, 3), i, dtype=np.uint8)).save(clip / f"{i}.png")
    with (clip / "labels.csv").open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["frame", "visibility", "x", "y"])
        for i in range(count):
            writer.writerow([i, 1, 1, 1])

    dataset = ImageClipDataset(str(tmp_path), num_frames=count)
    frames, _ = dataset[0]
    # frame k fills channels [3k:3k+3] with value k/255; numeric order => monotonic increase.
    per_frame = [float(frames[3 * k].mean()) * 255 for k in range(count)]
    assert per_frame == sorted(per_frame)
    assert round(per_frame[10]) == 10  # lexicographic sort would put "10.png" at index 2
