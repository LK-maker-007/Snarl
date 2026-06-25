// Build the model input for one 3-frame window. The exported tracker expects NCHW float32 of shape
// [1, 9, height, width]: three consecutive RGB frames stacked on the channel axis (frame 0 R, G, B,
// then frame 1, then frame 2), each a row-major height*width plane normalized to [0, 1]. Frames
// arrive as RGBA byte buffers from the image decoder; alpha is dropped. This must match the
// training pipeline's frame stacking exactly, or the predicted heatmaps are meaningless.

const FRAMES_PER_WINDOW = 3;
const CHANNELS_PER_FRAME = 3;
const BYTES_PER_PIXEL = 4; // RGBA
const MAX_BYTE = 255;

export function buildInputTensor(
  frames: readonly Uint8Array[],
  width: number,
  height: number,
): Float32Array {
  if (width <= 0 || height <= 0) {
    throw new Error(`width and height must be positive, got ${width}x${height}`);
  }
  if (frames.length !== FRAMES_PER_WINDOW) {
    throw new Error(`expected ${FRAMES_PER_WINDOW} frames, got ${frames.length}`);
  }

  const plane = width * height;
  const tensor = new Float32Array(FRAMES_PER_WINDOW * CHANNELS_PER_FRAME * plane);

  for (let frameIndex = 0; frameIndex < FRAMES_PER_WINDOW; frameIndex++) {
    const frame = frames[frameIndex];
    if (frame === undefined || frame.length !== plane * BYTES_PER_PIXEL) {
      throw new Error(
        `frame ${frameIndex} must be ${plane * BYTES_PER_PIXEL} RGBA bytes, ` +
          `got ${frame?.length ?? 'none'}`,
      );
    }
    const channelBase = frameIndex * CHANNELS_PER_FRAME;
    for (let planeIndex = 0; planeIndex < plane; planeIndex++) {
      const pixel = planeIndex * BYTES_PER_PIXEL;
      for (let channel = 0; channel < CHANNELS_PER_FRAME; channel++) {
        const byte = frame[pixel + channel];
        tensor[(channelBase + channel) * plane + planeIndex] = (byte ?? 0) / MAX_BYTE;
      }
    }
  }
  return tensor;
}
