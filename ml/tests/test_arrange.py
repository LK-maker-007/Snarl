import csv
import shutil
import subprocess
from pathlib import Path

import pytest

from snarl_ml.arrange import arrange_tracknetv2


def test_arrange_tracknetv2(tmp_path: Path) -> None:
    match = tmp_path / "src" / "match1"
    rally = match / "frame" / "1_00_00"
    rally.mkdir(parents=True)
    (match / "ball_trajectory").mkdir(parents=True)
    for i in range(3):
        (rally / f"{i}.png").write_bytes(b"")  # content irrelevant for the arrange step
    with (match / "ball_trajectory" / "1_00_00_ball.csv").open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["Frame", "Visibility", "X", "Y"])
        for i in range(3):
            writer.writerow([i, 1, i + 1, i + 2])

    dst = tmp_path / "out"
    assert arrange_tracknetv2(str(tmp_path / "src"), str(dst), symlink=False) == 1

    clip = dst / "match1__1_00_00"
    assert sorted(path.name for path in clip.glob("*.png")) == ["0.png", "1.png", "2.png"]
    with (clip / "labels.csv").open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 3
    assert rows[1]["x"] == "2"  # frame 1: x = i + 1


def test_arrange_rejects_missing_dataset(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        arrange_tracknetv2(str(tmp_path), str(tmp_path / "out"))


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
def test_arrange_tracknetv2_video_layout(tmp_path: Path) -> None:
    match = tmp_path / "src" / "Professional" / "match1"
    (match / "video").mkdir(parents=True)
    (match / "csv").mkdir(parents=True)
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-f", "lavfi", "-i", "testsrc=duration=1:size=64x64:rate=10",
            str(match / "video" / "1_00_00.mp4"),
        ],
        check=True,
    )
    with (match / "csv" / "1_00_00_ball.csv").open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["Frame", "Visibility", "X", "Y"])
        for i in range(10):
            writer.writerow([i, 1, i + 1, i + 2])

    dst = tmp_path / "out"
    assert arrange_tracknetv2(str(tmp_path / "src"), str(dst)) == 1

    clip = dst / "match1__1_00_00"
    pngs = sorted(clip.glob("*.png"))
    with (clip / "labels.csv").open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert len(pngs) == len(rows)  # frames and labels aligned to a common length
    assert len(rows) >= 1
    assert rows[1]["x"] == "2"  # frame 1: x = i + 1
