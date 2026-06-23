import shutil
import subprocess
from pathlib import Path

import pytest

from snarl_ml.video import extract_frames


def test_missing_video_raises(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        extract_frames(str(tmp_path / "nope.mp4"), str(tmp_path / "out"))


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
def test_extract_frames(tmp_path: Path) -> None:
    video = tmp_path / "test.mp4"
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-f", "lavfi", "-i", "testsrc=duration=1:size=64x64:rate=10",
            str(video),
        ],
        check=True,
    )
    count = extract_frames(str(video), str(tmp_path / "frames"), fps=10)
    assert count > 0
    assert sorted((tmp_path / "frames").glob("*.png"))[0].name == "00001.png"
