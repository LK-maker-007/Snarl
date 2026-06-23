"""Rearrange the TrackNetV2 shuttlecock dataset into our clip-dir format.

The TrackNetV2 dataset stores each match as ``match[N]/frame/<rally>/*.png`` with labels in
``match[N]/ball_trajectory/<rally>_ball.csv``. This builds one clip directory per rally, with the
frames (symlinked by default) and a converted ``labels.csv``, ready for ``ImageClipDataset``.
Research/non-commercial data — see the project's data policy.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from .prepare import convert_tracknet_csv


def arrange_tracknetv2(src_root: str, dst_root: str, *, symlink: bool = True) -> int:
    """Build clip dirs under ``dst_root`` from a TrackNetV2 dataset; return the clip count."""
    src, dst = Path(src_root), Path(dst_root)
    match_dirs = [
        path
        for path in sorted(src.rglob("*"))
        if (path / "frame").is_dir() and (path / "ball_trajectory").is_dir()
    ]
    if not match_dirs:
        raise ValueError(
            f"no TrackNetV2 match folders (with frame/ and ball_trajectory/) under {src_root!r}"
        )

    dst.mkdir(parents=True, exist_ok=True)
    clips = 0
    for match_dir in match_dirs:
        for rally_dir in sorted((match_dir / "frame").iterdir()):
            if not rally_dir.is_dir():
                continue
            csv_path = match_dir / "ball_trajectory" / f"{rally_dir.name}_ball.csv"
            if not csv_path.exists():
                continue
            clip_dir = dst / f"{match_dir.name}__{rally_dir.name}"
            clip_dir.mkdir(parents=True, exist_ok=True)
            for image in sorted(rally_dir.glob("*.png")):
                link = clip_dir / image.name
                if link.exists() or link.is_symlink():
                    continue
                if symlink:
                    link.symlink_to(image.resolve())
                else:
                    shutil.copy2(image, link)
            convert_tracknet_csv(csv_path, clip_dir / "labels.csv")
            clips += 1

    if clips == 0:
        raise ValueError(f"no rallies with matching CSVs found under {src_root!r}")
    return clips


def main() -> None:
    parser = argparse.ArgumentParser(description="Arrange the TrackNetV2 dataset into clip dirs.")
    parser.add_argument("src", help="extracted TrackNetV2 root (contains the match folders)")
    parser.add_argument("dst", help="output root of clip directories for ImageClipDataset")
    parser.add_argument("--copy", action="store_true", help="copy frames instead of symlinking")
    args = parser.parse_args()
    clips = arrange_tracknetv2(args.src, args.dst, symlink=not args.copy)
    print(f"arranged {clips} clips into {args.dst}")


if __name__ == "__main__":
    main()
