"""Convert the PyTorch tracker to a .tflite (LiteRT) model.

Uses the litert-torch (AI Edge Torch) API:

    edge = litert_torch.convert(model.eval(), sample_inputs)
    edge.export(out_path)

Requires PyTorch >= 2.4 and ``pip install litert-torch``.
"""

from __future__ import annotations

import argparse
from typing import Literal

import torch

from .model import LightTrackNet, sample_input

Dtype = Literal["float32", "float16"]


def to_litert(
    model: torch.nn.Module,
    sample_inputs: tuple[torch.Tensor, ...],
    out_path: str,
    *,
    dtype: Dtype = "float32",
) -> str:
    """Convert ``model`` to a .tflite file at ``out_path`` and return the path.

    ``dtype="float16"`` is the on-device target (ADR-0004), but the exact litert-torch flag for
    fp16 is not documented for this version, so it is intentionally not wired here rather than
    guessing an API: enable it via ``_ai_edge_converter_flags`` once confirmed against the
    installed version. The float32 path de-risks the conversion itself, which is the goal here.
    """
    if not out_path.endswith(".tflite"):
        raise ValueError(f"out_path must end with .tflite, got {out_path!r}")
    if dtype == "float16":
        raise NotImplementedError(
            "float16 conversion is not wired: confirm the litert-torch fp16 flag "
            "(via `_ai_edge_converter_flags`) against your installed version, then enable it."
        )

    import litert_torch  # imported lazily so the package is only required at conversion time

    edge_model = litert_torch.convert(model.eval(), sample_inputs)
    edge_model.export(out_path)
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert LightTrackNet to .tflite (LiteRT).")
    parser.add_argument("--out", default="lighttracknet.tflite")
    parser.add_argument("--frames", type=int, default=3)
    parser.add_argument("--height", type=int, default=288)
    parser.add_argument("--width", type=int, default=512)
    args = parser.parse_args()

    model = LightTrackNet(num_frames=args.frames)
    inputs = (sample_input(args.frames, args.height, args.width),)
    print(f"wrote {to_litert(model, inputs, args.out)}")


if __name__ == "__main__":
    main()
