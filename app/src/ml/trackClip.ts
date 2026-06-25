import {Point} from '../domain/cricket';
import {decodeHeatmap} from '../domain/heatmap';
import {buildInputTensor} from './preprocess';

const FRAMES_PER_WINDOW = 3;

// Runs the exported tracker on one [1, 9, H, W] NCHW float32 input (flattened) and returns the flat
// [1, 3, H, W] output. Implemented by the on-device TFLite adapter; abstracted here so the
// windowing and decoding are testable without a native runtime.
export interface ModelRunner {
  run(input: Float32Array): Promise<Float32Array>;
}

// Slide a 3-frame window across the clip, predict per-window heatmaps, and decode the centre
// frame's ball position — the centre frame is the one the model was trained and evaluated to
// localize. The first and last frames are never a window centre, so they stay null. `frames` are
// decoded RGBA byte buffers, one per clip frame.
export async function trackClip(
  runner: ModelRunner,
  frames: readonly Uint8Array[],
  width: number,
  height: number,
  threshold: number = 0.5,
): Promise<(Point | null)[]> {
  const plane = width * height;
  const track: (Point | null)[] = new Array<Point | null>(frames.length).fill(null);

  for (let start = 0; start + FRAMES_PER_WINDOW <= frames.length; start++) {
    const input = buildInputTensor(frames.slice(start, start + FRAMES_PER_WINDOW), width, height);
    const output = await runner.run(input);
    if (output.length !== FRAMES_PER_WINDOW * plane) {
      throw new Error(
        `model output length ${output.length} does not match ${FRAMES_PER_WINDOW}x${plane}`,
      );
    }
    const centre = output.subarray(plane, 2 * plane);
    track[start + 1] = decodeHeatmap(centre, width, height, threshold).point;
  }
  return track;
}
