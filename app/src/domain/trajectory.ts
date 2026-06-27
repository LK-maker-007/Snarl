import {Point} from './cricket';

// Trajectory rectification for a per-frame ball track. A ball moves smoothly, so the surrounding
// detections constrain where it must be: gate spikes that jump away from the neighbour line, then
// fit a sliding-window quadratic to replace off-curve detections and fill short gaps. This mirrors
// the rectification step in the TrackNet family the tracker is built on, and is validated against
// ground truth in the ml package (snarl_ml.trajectory) before being relied on here.

const DEGREE = 2;

export interface RectifyOptions {
  readonly window?: number;
  readonly curveTolerance?: number;
  readonly minPoints?: number;
  readonly maxDeviation?: number;
}

interface Quadratic {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

function evalQuadratic(q: Quadratic, t: number): number {
  return q.a * t * t + q.b * t + q.c;
}

// Least-squares quadratic fit v(t) = a*t^2 + b*t + c via the 3x3 normal equations, solved by
// Cramer's rule. Returns null only when the system is singular (degenerate t values).
function fitQuadratic(ts: readonly number[], vs: readonly number[]): Quadratic | null {
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  let r0 = 0;
  let r1 = 0;
  let r2 = 0;
  for (let i = 0; i < ts.length; i += 1) {
    const t = ts[i] ?? 0;
    const v = vs[i] ?? 0;
    const tt = t * t;
    s0 += 1;
    s1 += t;
    s2 += tt;
    s3 += tt * t;
    s4 += tt * tt;
    r0 += tt * v;
    r1 += t * v;
    r2 += v;
  }
  // [[s4 s3 s2],[s3 s2 s1],[s2 s1 s0]] · [a,b,c] = [r0,r1,r2]
  const det =
    s4 * (s2 * s0 - s1 * s1) - s3 * (s3 * s0 - s1 * s2) + s2 * (s3 * s1 - s2 * s2);
  if (Math.abs(det) < 1e-9) {
    return null;
  }
  const a = (r0 * (s2 * s0 - s1 * s1) - s3 * (r1 * s0 - s1 * r2) + s2 * (r1 * s1 - s2 * r2)) / det;
  const b = (s4 * (r1 * s0 - s1 * r2) - r0 * (s3 * s0 - s1 * s2) + s2 * (s3 * r2 - r1 * s2)) / det;
  const c = (s4 * (s2 * r2 - r1 * s1) - s3 * (s3 * r2 - r1 * s2) + r0 * (s3 * s1 - s2 * s2)) / det;
  return {a, b, c};
}

function nearest(
  points: readonly (Point | null)[],
  index: number,
  step: number,
): {readonly index: number; readonly point: Point} | null {
  let j = index + step;
  while (j >= 0 && j < points.length) {
    const point = points[j];
    if (point !== null && point !== undefined) {
      return {index: j, point};
    }
    j += step;
  }
  return null;
}

// Drop detections that deviate from the linear interpolation of their nearest detected neighbours.
function gateOutliers(points: readonly (Point | null)[], maxDeviation: number): (Point | null)[] {
  const gated: (Point | null)[] = [...points];
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    if (current === null || current === undefined) {
      continue;
    }
    const previous = nearest(points, i, -1);
    const following = nearest(points, i, 1);
    if (previous === null || following === null) {
      continue;
    }
    const fraction = (i - previous.index) / (following.index - previous.index);
    const expectedX = previous.point.x + (following.point.x - previous.point.x) * fraction;
    const expectedY = previous.point.y + (following.point.y - previous.point.y) * fraction;
    if (Math.hypot(current.x - expectedX, current.y - expectedY) > maxDeviation) {
      gated[i] = null;
    }
  }
  return gated;
}

// Fit a quadratic to the window's detections (with one outlier-trimming refit) and evaluate at the
// target frame index. Returns null only on a degenerate fit.
function fitEval(
  indices: readonly number[],
  xs: readonly number[],
  ys: readonly number[],
  target: number,
  tolerance: number,
  minPoints: number,
): Point | null {
  // Fit in indices centred on the window mean: Σt⁴ grows with the raw frame index (t⁴ ≈ 10⁸ at
  // frame 100), so centring keeps the normal-equations system well-conditioned in float64.
  const offset = indices.reduce((sum, index) => sum + index, 0) / indices.length;
  const centred = indices.map(index => index - offset);
  let fitX = fitQuadratic(centred, xs);
  let fitY = fitQuadratic(centred, ys);
  if (fitX === null || fitY === null) {
    return null;
  }
  const keepT: number[] = [];
  const keepXs: number[] = [];
  const keepYs: number[] = [];
  let trimmed = false;
  for (let i = 0; i < centred.length; i += 1) {
    const t = centred[i] ?? 0;
    const x = xs[i] ?? 0;
    const y = ys[i] ?? 0;
    if (Math.hypot(x - evalQuadratic(fitX, t), y - evalQuadratic(fitY, t)) <= tolerance) {
      keepT.push(t);
      keepXs.push(x);
      keepYs.push(y);
    } else {
      trimmed = true;
    }
  }
  if (trimmed && keepT.length >= minPoints) {
    const refitX = fitQuadratic(keepT, keepXs);
    const refitY = fitQuadratic(keepT, keepYs);
    if (refitX !== null && refitY !== null) {
      fitX = refitX;
      fitY = refitY;
    }
  }
  const centredTarget = target - offset;
  return {
    x: Math.round(evalQuadratic(fitX, centredTarget)),
    y: Math.round(evalQuadratic(fitY, centredTarget)),
  };
}

function curveFill(
  points: readonly (Point | null)[],
  window: number,
  curveTolerance: number,
  minPoints: number,
): (Point | null)[] {
  const half = Math.floor(window / 2);
  const refined: (Point | null)[] = [...points];
  for (let i = 0; i < points.length; i += 1) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(points.length, i + half + 1);
    const indices: number[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    for (let j = lo; j < hi; j += 1) {
      const nearby = points[j];
      if (nearby !== null && nearby !== undefined) {
        indices.push(j);
        xs.push(nearby.x);
        ys.push(nearby.y);
      }
    }
    const first = indices[0];
    const last = indices[indices.length - 1];
    if (
      indices.length < minPoints ||
      first === undefined ||
      last === undefined ||
      i < first ||
      i > last
    ) {
      continue;
    }
    const fit = fitEval(indices, xs, ys, i, curveTolerance, minPoints);
    if (fit === null) {
      continue;
    }
    const original = points[i];
    if (
      original === null ||
      original === undefined ||
      Math.hypot(original.x - fit.x, original.y - fit.y) > curveTolerance
    ) {
      refined[i] = fit;
    }
  }
  return refined;
}

// Return a rectified copy of the track: spikes removed, off-curve detections replaced, short gaps
// filled. Defaults match the ml-side measured best (window 7, curve 12 px, deviation 25 px).
export function rectifyTrack(
  points: readonly (Point | null)[],
  options: RectifyOptions = {},
): (Point | null)[] {
  const window = options.window ?? 7;
  const curveTolerance = options.curveTolerance ?? 12;
  const minPoints = options.minPoints ?? 4;
  const maxDeviation = options.maxDeviation ?? 25;
  if (window < 3) {
    throw new Error(`window must be at least 3, got ${window}`);
  }
  if (minPoints <= DEGREE) {
    throw new Error(`minPoints must exceed degree ${DEGREE}, got ${minPoints}`);
  }
  if (curveTolerance <= 0) {
    throw new Error(`curveTolerance must be positive, got ${curveTolerance}`);
  }
  if (maxDeviation <= 0) {
    throw new Error(`maxDeviation must be positive, got ${maxDeviation}`);
  }
  const gated = gateOutliers(points, maxDeviation);
  return curveFill(gated, window, curveTolerance, minPoints);
}
