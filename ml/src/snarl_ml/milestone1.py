"""End-to-end Milestone 1 check: convert -> parity gate -> latency.

Builds the efficient tracker, converts it to .tflite, verifies the converted model matches
PyTorch within tolerance (ADR-0004), and reports parameter count and host-CPU latency. Requires
``torch`` and ``litert-torch`` installed (run on a machine/Colab with them); the size, parity,
and latency numbers are produced by this run, not asserted in advance.
"""

from __future__ import annotations

import argparse
import tempfile
from pathlib import Path

import numpy as np
import torch

from .convert import to_litert
from .latency import benchmark
from .model import LightTrackNet
from .parity import compare
from .runtime import run_single


def main() -> None:
    parser = argparse.ArgumentParser(description="Milestone 1: convert, parity, latency.")
    parser.add_argument("--frames", type=int, default=3)
    parser.add_argument("--height", type=int, default=160)
    parser.add_argument("--width", type=int, default=256)
    parser.add_argument("--max-pixel-distance", type=float, default=3.0)
    args = parser.parse_args()

    torch.manual_seed(0)
    model = LightTrackNet(num_frames=args.frames).eval()
    params = sum(p.numel() for p in model.parameters())
    shape = (1, 3 * args.frames, args.height, args.width)
    example = torch.zeros(*shape, dtype=torch.float32)
    sample = np.random.default_rng(0).random(size=shape, dtype=np.float32)

    with torch.no_grad():
        torch_out = model(torch.from_numpy(sample)).numpy()[0]

    with tempfile.TemporaryDirectory() as tmp:
        path = to_litert(model, (example,), str(Path(tmp) / "model.tflite"))
        tflite_out = run_single(path, sample)[0]
        result = compare(torch_out, tflite_out)
        stats = benchmark(path, shape)

    print(f"input: {args.frames} frames @ {args.height}x{args.width}  params: {params / 1e6:.3f} M")
    print(
        f"parity: max|d|={result.max_abs_error:.4g} mean|d|={result.mean_abs_error:.4g} "
        f"max_px={result.max_pixel_distance:.2f}"
    )
    print(f"latency (host CPU): p50={stats.p50_ms:.1f}ms p90={stats.p90_ms:.1f}ms")
    if not result.passes(max_pixel_distance=args.max_pixel_distance):
        raise SystemExit("parity gate FAILED")
    print("parity gate PASSED")


if __name__ == "__main__":
    main()
