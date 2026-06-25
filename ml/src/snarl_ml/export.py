"""Export a trained LightTrackNet checkpoint to .tflite, gated on PyTorch parity (ADR-0004).

`convert` exports a fresh, untrained model to de-risk the conversion mechanics; this loads trained
weights and verifies the converted .tflite reproduces the PyTorch output within the ADR-0004
tolerance (decoded ball position within ~3 px) before the file is trusted on-device. A checkpoint
that fails the gate is never written out as shippable. Run where the checkpoint and `litert-torch`
are installed.
"""

from __future__ import annotations

import argparse

import numpy as np
import torch

from .convert import to_litert
from .latency import benchmark
from .model import LightTrackNet, sample_input
from .parity import compare
from .runtime import run_single


def load_checkpoint(path: str, *, num_frames: int = 3) -> LightTrackNet:
    """Load a trained state_dict into an eval-mode model.

    ``weights_only=True`` refuses to execute arbitrary pickle code while loading — a checkpoint is
    data, not a program. ``load_state_dict`` raises if the architecture does not match the weights.
    """
    model = LightTrackNet(num_frames=num_frames)
    state = torch.load(path, map_location="cpu", weights_only=True)
    model.load_state_dict(state)
    model.eval()
    return model


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export a trained checkpoint to .tflite with a PyTorch parity gate."
    )
    parser.add_argument("--checkpoint", required=True, help="trained state_dict (.pt) to export")
    parser.add_argument("--out", default="lighttracknet.tflite", help="output .tflite path")
    parser.add_argument("--frames", type=int, default=3, help="frames per window")
    parser.add_argument("--height", type=int, default=360, help="input height, multiple of 8")
    parser.add_argument("--width", type=int, default=640, help="input width, multiple of 8")
    parser.add_argument("--max-pixel-distance", type=float, default=3.0, help="parity tolerance px")
    args = parser.parse_args()

    model = load_checkpoint(args.checkpoint, num_frames=args.frames)
    shape = (1, 3 * args.frames, args.height, args.width)
    example = sample_input(args.frames, args.height, args.width)
    probe = np.random.default_rng(0).random(size=shape, dtype=np.float32)

    with torch.no_grad():
        torch_out = model(torch.from_numpy(probe)).numpy()[0]

    path = to_litert(model, (example,), args.out)
    tflite_out = run_single(path, probe)[0]
    result = compare(torch_out, tflite_out)
    stats = benchmark(path, shape)

    print(f"exported {path}  ({args.frames} frames @ {args.height}x{args.width})")
    print(
        f"parity: max|d|={result.max_abs_error:.4g} mean|d|={result.mean_abs_error:.4g} "
        f"max_px={result.max_pixel_distance:.2f}"
    )
    print(f"latency (host CPU): p50={stats.p50_ms:.1f}ms p90={stats.p90_ms:.1f}ms")
    if not result.passes(max_pixel_distance=args.max_pixel_distance):
        raise SystemExit("parity gate FAILED — do not trust this .tflite")
    print("parity gate PASSED")


if __name__ == "__main__":
    main()
