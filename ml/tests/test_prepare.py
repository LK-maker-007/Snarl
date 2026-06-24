import csv
from pathlib import Path

import pytest

from snarl_ml.prepare import convert_tracknet_csv


def test_convert_tracknet_csv(tmp_path: Path) -> None:
    src = tmp_path / "Label.csv"
    with src.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["Frame", "Visibility", "X", "Y"])  # TrackNet-style capitalized headers
        writer.writerow(["0", "0", "0", "0"])  # ball absent
        writer.writerow(["1", "1", "100", "50"])  # visible
        writer.writerow(["2", "2", "110", "55"])  # visibility 2 -> 1

    dst = tmp_path / "labels.csv"
    assert convert_tracknet_csv(src, dst) == 3

    with dst.open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert [row["visibility"] for row in rows] == ["0", "1", "1"]
    assert rows[1]["x"] == "100" and rows[1]["y"] == "50"
    assert rows[0]["x"] == "0"  # absent -> zeroed


def test_convert_scales_coordinates(tmp_path: Path) -> None:
    src = tmp_path / "Label.csv"
    with src.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["Frame", "Visibility", "X", "Y"])
        writer.writerow(["0", "1", "100", "50"])
        writer.writerow(["1", "0", "0", "0"])  # absent stays zeroed regardless of scale

    dst = tmp_path / "labels.csv"
    convert_tracknet_csv(src, dst, scale=0.5)
    with dst.open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert rows[0]["x"] == "50" and rows[0]["y"] == "25"  # halved
    assert rows[1]["x"] == "0"


def test_missing_columns_raise(tmp_path: Path) -> None:
    src = tmp_path / "bad.csv"
    src.write_text("frame,foo\n0,1\n")
    with pytest.raises(ValueError):
        convert_tracknet_csv(src, tmp_path / "labels.csv")
