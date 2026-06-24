"""Convert public TrackNet-style datasets into our ``labels.csv`` schema for pretraining.

TrackNet tennis/badminton datasets label each frame with columns Frame/Visibility/X/Y, where
visibility is 0-3 (>0 means the ball is present). Our loader (``ImageClipDataset``) reads a
``labels.csv`` with header ``frame,visibility,x,y`` and a 0/1 visibility. This converts the
former to the latter. It does NOT download anything — get the datasets from their project repos
(e.g. the TrackNet/WASB repos link the tennis/badminton sets), extract the frames, then point
this at the per-clip CSVs. Rows must be in frame order (as TrackNet ships them).
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

_OUR_HEADER = ["frame", "visibility", "x", "y"]


def convert_tracknet_csv(src: Path, dst: Path, *, scale: float = 1.0) -> int:
    """Convert one TrackNet-style label CSV to our schema; return the number of rows written.

    ``scale`` multiplies the ball coordinates to match downscaled frames (e.g. 0.5 for half size).
    """
    with src.open(newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise ValueError(f"{src}: empty or headerless CSV")
        columns = {name.lower().strip(): name for name in reader.fieldnames}
        missing = [name for name in ("visibility", "x", "y") if name not in columns]
        if missing:
            raise ValueError(f"{src}: missing columns {missing} (have {reader.fieldnames})")
        rows = list(reader)

    with dst.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(_OUR_HEADER)
        for index, row in enumerate(rows):
            visible = int(float(row[columns["visibility"]])) > 0
            x = int(float(row[columns["x"]]) * scale) if visible else 0
            y = int(float(row[columns["y"]]) * scale) if visible else 0
            writer.writerow([index, int(visible), x, y])
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert TrackNet-style label CSVs to our schema.")
    parser.add_argument("root", help="dataset root to scan for label CSVs")
    parser.add_argument("--csv-glob", default="**/*.csv", help="which CSVs to convert")
    parser.add_argument("--out-name", default="labels.csv", help="output CSV name written per clip")
    args = parser.parse_args()

    root = Path(args.root)
    sources = [path for path in sorted(root.glob(args.csv_glob)) if path.name != args.out_name]
    if not sources:
        raise SystemExit(f"no CSVs matching {args.csv_glob!r} under {root}")

    total = 0
    for src in sources:
        rows = convert_tracknet_csv(src, src.with_name(args.out_name))
        total += rows
        print(f"{src} -> {src.with_name(args.out_name)} ({rows} rows)")
    print(f"converted {len(sources)} files, {total} rows")


if __name__ == "__main__":
    main()
