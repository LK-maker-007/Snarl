"""Measure .tflite inference latency on the host CPU.

This is a desktop-CPU sanity bound to catch gross regressions early, NOT the on-device number.
The product latency is measured on the actual Android phone (capture-then-process), per the
design.
"""

from __future__ import annotations

import statistics
import time
from dataclasses import dataclass

import numpy as np

from .runtime import make_interpreter


@dataclass(frozen=True)
class LatencyStats:
    runs: int
    p50_ms: float
    p90_ms: float
    mean_ms: float


def benchmark(
    model_path: str,
    input_shape: tuple[int, ...],
    *,
    runs: int = 50,
    warmup: int = 5,
) -> LatencyStats:
    """Time ``runs`` single-input invocations after ``warmup`` untimed ones."""
    if runs <= 0:
        raise ValueError(f"runs must be positive, got {runs}")
    if warmup < 0:
        raise ValueError(f"warmup must be non-negative, got {warmup}")

    interpreter = make_interpreter(model_path)
    input_detail = interpreter.get_input_details()[0]
    output_detail = interpreter.get_output_details()[0]
    rng = np.random.default_rng(0)
    sample = rng.random(size=input_shape, dtype=np.float32).astype(input_detail["dtype"])

    def invoke_once() -> None:
        interpreter.set_tensor(input_detail["index"], sample)
        interpreter.invoke()
        interpreter.get_tensor(output_detail["index"])

    for _ in range(warmup):
        invoke_once()

    timings_ms: list[float] = []
    for _ in range(runs):
        start = time.perf_counter()
        invoke_once()
        timings_ms.append((time.perf_counter() - start) * 1000.0)
    timings_ms.sort()

    return LatencyStats(
        runs=runs,
        p50_ms=statistics.median(timings_ms),
        p90_ms=timings_ms[int(0.9 * (runs - 1))],
        mean_ms=statistics.fmean(timings_ms),
    )
