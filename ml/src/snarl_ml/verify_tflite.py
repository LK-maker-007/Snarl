"""Verify the exported .tflite — the exact artifact the app ships — against ground-truth labels.

``evaluate`` scores the trained PyTorch checkpoint; this scores the converted .tflite that runs
on the phone, so the numbers reflect what is actually deployed. It runs the model over image-frame
clips with the on-device preprocessing (3-frame window, NCHW, normalised to [0, 1]), decodes the
centre-frame heatmap peak, and compares it to the human-labeled position with the same metrics as
``evaluate``: detection precision/recall/F1 and median/p90 pixel error.

Requires a TFLite runtime (``ai-edge-litert`` or ``tensorflow``) and torch (for the dataset).
"""

from __future__ import annotations

import argparse

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset

from .data import ImageClipDataset
from .evaluate import Accuracy, score_detections
from .heatmap import Point, decode_heatmap
from .runtime import make_interpreter


def verify_tflite(
    model_path: str,
    dataset: Dataset[tuple[torch.Tensor, torch.Tensor]],
    *,
    tolerance: float = 4.0,
    threshold: float = 0.5,
) -> Accuracy:
    """Score the .tflite at ``model_path`` over the centre frame of every window in ``dataset``.

    ``threshold`` is the on-device ball-present confidence; ``tolerance`` is the hit radius in px.
    """
    interpreter = make_interpreter(model_path)
    input_detail = interpreter.get_input_details()[0]
    output_detail = interpreter.get_output_details()[0]
    input_index = input_detail["index"]
    input_dtype = input_detail["dtype"]
    # batch_size=1 yields one (1, 9, H, W) window per step, matching the model's fixed input shape
    # and the centre-frame scoring; it also gives a typed, len-free iteration like evaluate().
    loader: DataLoader[tuple[torch.Tensor, torch.Tensor]] = DataLoader(dataset, batch_size=1)

    pairs: list[tuple[Point | None, Point | None]] = []
    for frames, targets in loader:
        batch = frames.numpy().astype(input_dtype)
        interpreter.set_tensor(input_index, batch)
        interpreter.invoke()
        prediction = np.asarray(interpreter.get_tensor(output_detail["index"]), dtype=np.float32)[0]
        truth = targets.numpy()[0]
        centre = prediction.shape[0] // 2
        predicted, _ = decode_heatmap(prediction[centre], threshold=threshold)
        expected, _ = decode_heatmap(truth[centre], threshold=0.5)
        pairs.append((predicted, expected))

    return score_detections(pairs, tolerance=tolerance)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Score the deployed .tflite on labeled image-frame clips."
    )
    parser.add_argument("--model", required=True, help="exported model (.tflite)")
    parser.add_argument("--image-dir", required=True, help="root of image-frame clips + labels.csv")
    parser.add_argument("--image-glob", default="*.jpg", help="frame glob within each clip")
    parser.add_argument("--frames", type=int, default=3)
    parser.add_argument("--tolerance", type=float, default=4.0, help="hit radius in px")
    parser.add_argument("--threshold", type=float, default=0.5, help="ball-present confidence")
    args = parser.parse_args()

    dataset = ImageClipDataset(args.image_dir, num_frames=args.frames, image_glob=args.image_glob)
    accuracy = verify_tflite(
        args.model,
        dataset,
        tolerance=args.tolerance,
        threshold=args.threshold,
    )

    print(
        f"verified {args.model} on {args.image_dir} "
        f"({accuracy.frames} frames, tolerance {args.tolerance:.0f} px)"
    )
    print(
        f"  detection: precision={accuracy.precision:.3f} "
        f"recall={accuracy.recall:.3f} f1={accuracy.f1:.3f} "
        f"accuracy={accuracy.detection_accuracy:.3f}"
    )
    print(
        f"  localization: median={accuracy.median_pixel_error:.2f} px "
        f"p90={accuracy.p90_pixel_error:.2f} px"
    )
    print(
        f"  counts: tp={accuracy.true_positives} fp={accuracy.false_positives} "
        f"fn={accuracy.false_negatives} tn={accuracy.true_negatives}"
    )


if __name__ == "__main__":
    main()
