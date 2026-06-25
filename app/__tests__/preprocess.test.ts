import {buildInputTensor} from '../src/ml/preprocess';

describe('buildInputTensor', () => {
  it('stacks three RGB frames channels-first, normalized, dropping alpha', () => {
    const red = new Uint8Array([255, 0, 0, 255]);
    const green = new Uint8Array([0, 255, 0, 255]);
    const blue = new Uint8Array([0, 0, 255, 255]);
    const tensor = buildInputTensor([red, green, blue], 1, 1);
    expect(Array.from(tensor)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('places pixels in row-major order within each channel plane', () => {
    const frame = () => new Uint8Array([255, 10, 20, 255, 30, 40, 50, 255]); // two RGBA pixels
    const tensor = buildInputTensor([frame(), frame(), frame()], 2, 1);
    // frame 0, R plane occupies indices 0..1 (pixel 0, pixel 1)
    expect(tensor[0]).toBeCloseTo(1);
    expect(tensor[1]).toBeCloseTo(30 / 255);
    // frame 0, G plane occupies indices 2..3
    expect(tensor[2]).toBeCloseTo(10 / 255);
    expect(tensor[3]).toBeCloseTo(40 / 255);
  });

  it('throws on the wrong frame count', () => {
    expect(() => buildInputTensor([new Uint8Array(4)], 1, 1)).toThrow();
  });

  it('throws when a frame has the wrong byte length', () => {
    const frames = [new Uint8Array(3), new Uint8Array(4), new Uint8Array(4)];
    expect(() => buildInputTensor(frames, 1, 1)).toThrow();
  });
});
