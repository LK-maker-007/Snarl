"""Extract frames from a video into our per-frame image format, using ffmpeg.

For turning your own (or downloaded, openly-licensed) clips into the frame folders that
``ImageClipDataset`` reads. Frames are written zero-padded (``00001.png`` ...) so they sort in
order. Requires the ``ffmpeg`` binary on PATH (a system install, e.g. ``apt install ffmpeg``);
it is not a Python dependency.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path


def extract_frames(
    video_path: str,
    out_dir: str,
    *,
    fps: float | None = None,
    ext: str = "png",
    scale: float | None = None,
) -> int:
    """Extract frames from ``video_path`` into ``out_dir`` as ``00001.<ext>``...; return the count.

    ``fps`` resamples (e.g. 120 for a high-speed clip); ``None`` keeps the source frame rate.
    ``scale`` downscales each frame by that factor (e.g. 0.5 for half size), rounding dimensions
    down to a multiple of eight (which the model requires); ``None`` keeps the source size. Raises
    FileNotFoundError if the video is missing and RuntimeError if ffmpeg is not installed.
    """
    source = Path(video_path)
    if not source.is_file():
        raise FileNotFoundError(f"video not found: {video_path}")
    if scale is not None and scale <= 0:
        raise ValueError(f"scale must be positive, got {scale}")
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg not found on PATH; install it (e.g. `apt install ffmpeg`).")

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(source)]
    filters = []
    if fps is not None:
        filters.append(f"fps={fps}")
    if scale is not None:
        filters.append(f"scale=trunc(iw*{scale}/8)*8:trunc(ih*{scale}/8)*8")
    if filters:
        command += ["-vf", ",".join(filters)]
    command += ["-qscale:v", "2", str(out / f"%05d.{ext}")]
    subprocess.run(command, check=True)
    return len(list(out.glob(f"*.{ext}")))


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract video frames into our per-frame format.")
    parser.add_argument("video", help="input video file")
    parser.add_argument("out_dir", help="output directory for the extracted frames")
    parser.add_argument("--fps", type=float, default=None, help="resample fps (default: source)")
    parser.add_argument("--ext", default="png", help="frame image extension")
    parser.add_argument("--scale", type=float, default=None, help="downscale factor (e.g. 0.5)")
    args = parser.parse_args()
    count = extract_frames(args.video, args.out_dir, fps=args.fps, ext=args.ext, scale=args.scale)
    print(f"extracted {count} frames to {args.out_dir}")


if __name__ == "__main__":
    main()
