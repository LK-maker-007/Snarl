import {decodeHeatmap} from '../src/domain/heatmap';

describe('decodeHeatmap', () => {
  it('returns the argmax as (x, y) in row-major order', () => {
    // width 3, height 2; peak at index 4 -> x = 1, y = 1
    const data = [0.1, 0.2, 0.0, 0.3, 0.9, 0.4];
    const peak = decodeHeatmap(data, 3, 2);
    expect(peak.point).toEqual({x: 1, y: 1});
    expect(peak.confidence).toBeCloseTo(0.9);
  });

  it('treats a peak below threshold as absent', () => {
    const data = [0.1, 0.2, 0.0, 0.3, 0.4, 0.1];
    const peak = decodeHeatmap(data, 3, 2, 0.5);
    expect(peak.point).toBeNull();
    expect(peak.confidence).toBeCloseTo(0.4);
  });

  it('throws when the data length does not match the dimensions', () => {
    expect(() => decodeHeatmap([0, 1, 2], 2, 2)).toThrow();
  });
});
