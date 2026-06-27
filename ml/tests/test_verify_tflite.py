from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pytest
from PIL import Image

pytest.importorskip("torch")

from snarl_ml import verify_tflite as verify_module  # noqa: E402
from snarl_ml.data import ImageClipDataset  # noqa: E402
from snarl_ml.evaluate import score_detections  # noqa: E402
from snarl_ml.heatmap import gaussian_heatmap  # noqa: E402


def test_score_detections_counts_and_errors() -> None:
    # (predicted, expected): a hit, a 5px miss, a false positive, a false negative, a true negative.
    pairs = [
        ((10, 10), (10, 10)),  # tp, 0 px
        ((15, 10), (10, 10)),  # within tolerance? 5 px -> tp at tolerance 5
        ((50, 50), None),  # fp (ball absent, predicted present)
        (None, (20, 20)),  # fn (ball present, not found)
        (None, None),  # tn
    ]
    accuracy = score_detections(pairs, tolerance=5.0)
    assert accuracy.true_positives == 2
    assert accuracy.false_positives == 1
    assert accuracy.false_negatives == 1
    assert accuracy.true_negatives == 1
    assert accuracy.frames == 5
    assert accuracy.median_pixel_error == pytest.approx(2.5)  # median of {0, 5}


def test_score_detections_rejects_nonpositive_tolerance() -> None:
    with pytest.raises(ValueError):
        score_detections([], tolerance=0.0)


class _FakeInterpreter:
    """Returns a heatmap peaked at a fixed pixel, so verify_tflite has a known prediction."""

    def __init__(self, height: int, width: int, peak: tuple[int, int]) -> None:
        heatmap = gaussian_heatmap(height, width, peak)
        self._output = np.stack([heatmap, heatmap, heatmap])[np.newaxis]  # (1, 3, H, W)

    def get_input_details(self) -> list[dict[str, Any]]:
        return [{"index": 0, "dtype": np.float32}]

    def get_output_details(self) -> list[dict[str, Any]]:
        return [{"index": 1}]

    def set_tensor(self, index: int, value: np.ndarray) -> None:  # noqa: ARG002
        return None

    def invoke(self) -> None:
        return None

    def get_tensor(self, index: int) -> np.ndarray:  # noqa: ARG002
        return self._output


def _write_clip(root: Path, frames: int, size: tuple[int, int], ball: tuple[int, int]) -> None:
    width, height = size
    clip = root / "clip"
    clip.mkdir()
    for i in range(frames):
        Image.new("RGB", size, (0, 0, 0)).save(clip / f"{i:05d}.jpg")
    lines = ["frame,visibility,x,y"]
    lines += [f"{i},1,{ball[0]},{ball[1]}" for i in range(frames)]
    (clip / "labels.csv").write_text("\n".join(lines) + "\n")


def test_verify_tflite_scores_the_window_pipeline(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # A fake interpreter peaked on the label exercises the window -> decode -> score wiring (one
    # score per centre frame, perfect predictor -> all true positives). The real accuracy number
    # comes from running the actual model, not this.
    width, height, ball = 64, 16, (30, 8)
    _write_clip(tmp_path, frames=5, size=(width, height), ball=ball)
    dataset = ImageClipDataset(str(tmp_path), num_frames=3, image_glob="*.jpg")

    monkeypatch.setattr(
        verify_module,
        "make_interpreter",
        lambda _path: _FakeInterpreter(height, width, ball),
    )
    accuracy = verify_module.verify_tflite("unused.tflite", dataset, tolerance=2.0)

    # 5 frames, 3-frame windows -> 3 centre frames, all predicted on the labelled ball.
    assert accuracy.frames == 3
    assert accuracy.true_positives == 3
    assert accuracy.median_pixel_error == pytest.approx(0.0)
