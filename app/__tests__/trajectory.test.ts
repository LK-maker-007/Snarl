import {Point} from '../src/domain/cricket';
import {rectifyTrack} from '../src/domain/trajectory';

// A smooth curved path, like a ball arc, sampled once per frame.
function parabola(n: number): Point[] {
  return Array.from({length: n}, (_unused, t) => ({
    x: 10 + 4 * t,
    y: 100 - (t - 8) * (t - 8),
  }));
}

describe('rectifyTrack', () => {
  it('leaves a clean track essentially unchanged', () => {
    const track: (Point | null)[] = parabola(16);
    const rectified = rectifyTrack(track, {curveTolerance: 5});
    rectified.forEach((fixed, i) => {
      const original = track[i];
      expect(fixed).not.toBeNull();
      expect(original).not.toBeNull();
      expect(Math.abs((original?.x ?? 0) - (fixed?.x ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((original?.y ?? 0) - (fixed?.y ?? 0))).toBeLessThanOrEqual(1);
    });
  });

  it('pulls a gross outlier back onto the curve', () => {
    const track: (Point | null)[] = parabola(16);
    const truth = track[8] as Point;
    track[8] = {x: 300, y: 20};
    const fixed = rectifyTrack(track, {curveTolerance: 12})[8];
    expect(fixed).not.toBeNull();
    expect(Math.abs((fixed?.x ?? 0) - truth.x)).toBeLessThanOrEqual(3);
    expect(Math.abs((fixed?.y ?? 0) - truth.y)).toBeLessThanOrEqual(3);
  });

  it('fills a gap from the curve', () => {
    const track: (Point | null)[] = parabola(16);
    const truth = track[8] as Point;
    track[8] = null;
    const fixed = rectifyTrack(track, {curveTolerance: 12})[8];
    expect(fixed).not.toBeNull();
    expect(Math.abs((fixed?.x ?? 0) - truth.x)).toBeLessThanOrEqual(3);
    expect(Math.abs((fixed?.y ?? 0) - truth.y)).toBeLessThanOrEqual(3);
  });

  it('leaves a frame untouched when too few detections are nearby', () => {
    const track: (Point | null)[] = [null, null, {x: 5, y: 5}, null, null];
    expect(rectifyTrack(track, {curveTolerance: 10})).toEqual(track);
  });

  it('does not extrapolate beyond the detected span', () => {
    const track: (Point | null)[] = [...parabola(6), null, null, null, null];
    const rectified = rectifyTrack(track, {curveTolerance: 10});
    expect(rectified[7]).toBeNull();
    expect(rectified[9]).toBeNull();
  });

  it('rejects invalid parameters', () => {
    expect(() => rectifyTrack(parabola(8), {window: 2})).toThrow();
    expect(() => rectifyTrack(parabola(8), {minPoints: 2})).toThrow();
    expect(() => rectifyTrack(parabola(8), {curveTolerance: 0})).toThrow();
    expect(() => rectifyTrack(parabola(8), {maxDeviation: 0})).toThrow();
  });
});
