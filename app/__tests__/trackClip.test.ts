import {FrameAccessor, ModelRunner, trackClip} from '../src/ml/trackClip';

// width 2, height 1 -> plane 2; output is 3 planes (6 floats). Centre plane (indices 2..3) peaks at
// planeIndex 1, i.e. x = 1, y = 0.
function centrePeakRunner(): ModelRunner {
  return {
    run: async () => {
      const output = new Float32Array(6);
      output[2] = 0.1;
      output[3] = 0.9;
      return output;
    },
  };
}

function blankFrames(count: number): FrameAccessor {
  return {
    count,
    at: () => new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255]), // two RGBA pixels
  };
}

describe('trackClip', () => {
  it('decodes the centre frame of each window and leaves the ends null', async () => {
    const track = await trackClip(centrePeakRunner(), blankFrames(4), 2, 1, 0.5);
    expect(track.length).toBe(4);
    expect(track[0]).toBeNull();
    expect(track[1]).toEqual({x: 1, y: 0});
    expect(track[2]).toEqual({x: 1, y: 0});
    expect(track[3]).toBeNull();
  });

  it('throws when the model output size does not match the frame dimensions', async () => {
    const wrongSize: ModelRunner = {run: async () => new Float32Array(5)};
    await expect(trackClip(wrongSize, blankFrames(3), 2, 1)).rejects.toThrow();
  });
});
