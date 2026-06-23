"""Run a .tflite model with whichever LiteRT/TFLite runtime is installed.

Tries the LiteRT runtime (``ai_edge_litert``) first, then falls back to TensorFlow Lite. Both
expose the same Interpreter API, so the rest of the code stays runtime-agnostic.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from numpy.typing import NDArray


def _interpreter_class() -> Any:
    try:
        from ai_edge_litert.interpreter import Interpreter

        return Interpreter
    except ImportError:
        pass
    try:
        from tensorflow.lite import Interpreter

        return Interpreter
    except ImportError as exc:
        raise ImportError(
            "No TFLite runtime found. Install one: `pip install ai-edge-litert` (LiteRT) "
            "or `pip install tensorflow`."
        ) from exc


def make_interpreter(model_path: str) -> Any:
    """Load and allocate an Interpreter for ``model_path``."""
    interpreter = _interpreter_class()(model_path=model_path)
    interpreter.allocate_tensors()
    return interpreter


def run_single(model_path: str, input_array: NDArray[np.float32]) -> NDArray[np.float32]:
    """Run a single-input, single-output .tflite model and return its output as float32."""
    interpreter = make_interpreter(model_path)
    input_detail = interpreter.get_input_details()[0]
    output_detail = interpreter.get_output_details()[0]
    interpreter.set_tensor(input_detail["index"], input_array.astype(input_detail["dtype"]))
    interpreter.invoke()
    return np.asarray(interpreter.get_tensor(output_detail["index"]), dtype=np.float32)
