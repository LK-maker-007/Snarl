import {Point} from './cricket';

export interface HeatmapPeak {
  readonly point: Point | null;
  readonly confidence: number;
}

// Decode one row-major heatmap (index = y * width + x) to its peak ball position. The ball is the
// argmax; a peak below `threshold` means the ball is absent and `point` is null. This mirrors the
// training/eval decode exactly — that equivalence is what lets the on-device track match the
// offline accuracy numbers. Throws if the data length does not match the dimensions.
export function decodeHeatmap(
  data: ArrayLike<number>,
  width: number,
  height: number,
  threshold: number = 0.5,
): HeatmapPeak {
  if (width <= 0 || height <= 0) {
    throw new Error(`width and height must be positive, got ${width}x${height}`);
  }
  if (data.length !== width * height) {
    throw new Error(`heatmap length ${data.length} does not match ${width}x${height}`);
  }

  let bestIndex = 0;
  let bestValue = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    if (value !== undefined && value > bestValue) {
      bestValue = value;
      bestIndex = i;
    }
  }

  if (bestValue < threshold) {
    return {point: null, confidence: bestValue};
  }
  return {
    point: {x: bestIndex % width, y: Math.floor(bestIndex / width)},
    confidence: bestValue,
  };
}
