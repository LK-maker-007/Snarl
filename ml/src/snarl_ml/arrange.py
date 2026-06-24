"""Rearrange the TrackNetV2 shuttlecock dataset into our clip-dir format.

TrackNetV2 ships in two layouts depending on the release:

- pre-extracted frames: ``match[N]/frame/<rally>/*.png`` with ``ball_trajectory/<rally>_ball.csv``
- per-rally videos: ``match[N]/video/<rally>.mp4`` with ``match[N]/csv/<rally>_ball.csv``

Both are handled (auto-detected). Each rally becomes one clip directory with the frames (symlinked
for the frame layout, extracted with ffmpeg for the video layout) and a converted ``labels.csv``,
ready for ``ImageClipDataset``. Research/non-commercial data — see the project's data policy.
"""

from __future__ import annotations

import argparse
import csv
import shutil
from pathlib import Path

from .prepare import convert_tracknet_csv
from .video import extract_frames

_BALL_CSV_SUFFIX = "_ball.csv"


def arrange_tracknetv2(
    src_root: str,
    dst_root: str,
    *,
    symlink: bool = True,
    fps: float | None = None,
) -> int:
    """Build clip dirs under ``dst_root`` from a TrackNetV2 dataset; return the clip count.

    ``fps`` only applies to the video layout (resample on extraction; ``None`` keeps native fps).
    """
    src, dst = Path(src_root), Path(dst_root)
    frame_matches: list[Path] = []
    video_matches: list[Path] = []
    candidates = [src, *(path for path in sorted(src.rglob("*")) if path.is_dir())]
    for path in candidates:
        if (path / "frame").is_dir() and (path / "ball_trajectory").is_dir():
            frame_matches.append(path)
        elif (path / "video").is_dir() and (path / "csv").is_dir():
            video_matches.append(path)

    if not frame_matches and not video_matches:
        raise ValueError(
            "no TrackNetV2 match folders (frame/+ball_trajectory/ or video/+csv/) "
            f"under {src_root!r}"
        )

    dst.mkdir(parents=True, exist_ok=True)
    clips = 0
    for match_dir in frame_matches:
        clips += _arrange_frame_match(match_dir, dst, symlink=symlink)
    for match_dir in video_matches:
        clips += _arrange_video_match(match_dir, dst, fps=fps)

    if clips == 0:
        raise ValueError(f"no rallies with matching labels found under {src_root!r}")
    return clips


def _arrange_frame_match(match_dir: Path, dst: Path, *, symlink: bool) -> int:
    clips = 0
    for rally_dir in sorted((match_dir / "frame").iterdir()):
        if not rally_dir.is_dir():
            continue
        csv_path = match_dir / "ball_trajectory" / f"{rally_dir.name}{_BALL_CSV_SUFFIX}"
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
    return clips


def _arrange_video_match(match_dir: Path, dst: Path, *, fps: float | None) -> int:
    clips = 0
    video_dir = match_dir / "video"
    for csv_path in sorted((match_dir / "csv").glob(f"*{_BALL_CSV_SUFFIX}")):
        rally = csv_path.name[: -len(_BALL_CSV_SUFFIX)]
        video_path = video_dir / f"{rally}.mp4"
        if not video_path.exists():
            continue
        clip_dir = dst / f"{match_dir.name}__{rally}"
        frame_count = extract_frames(str(video_path), str(clip_dir), fps=fps)
        label_count = convert_tracknet_csv(csv_path, clip_dir / "labels.csv")
        _align_clip(clip_dir, frame_count, label_count)
        clips += 1
    return clips


def _align_clip(clip_dir: Path, frame_count: int, label_count: int) -> None:
    """Trim frames and labels to a common length (extraction can differ by a frame)."""
    target = min(frame_count, label_count)
    frames = sorted(clip_dir.glob("*.png"), key=lambda path: (len(path.stem), path.stem))
    for extra in frames[target:]:
        extra.unlink()
    if label_count > target:
        labels_path = clip_dir / "labels.csv"
        with labels_path.open(newline="") as handle:
            rows = list(csv.reader(handle))
        header, body = rows[0], rows[1 : target + 1]
        with labels_path.open("w", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(header)
            writer.writerows(body)


def main() -> None:
    parser = argparse.ArgumentParser(description="Arrange the TrackNetV2 dataset into clip dirs.")
    parser.add_argument("src", help="extracted TrackNetV2 root (contains the match folders)")
    parser.add_argument("dst", help="output root of clip directories for ImageClipDataset")
    parser.add_argument("--copy", action="store_true", help="copy frames instead of symlinking")
    parser.add_argument("--fps", type=float, default=None, help="resample fps for the video layout")
    args = parser.parse_args()
    clips = arrange_tracknetv2(args.src, args.dst, symlink=not args.copy, fps=args.fps)
    print(f"arranged {clips} clips into {args.dst}")


if __name__ == "__main__":
    main()
