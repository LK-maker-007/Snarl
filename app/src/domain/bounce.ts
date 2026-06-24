import {Homography, projectToGround} from './calibration';
import {Point} from './cricket';
import {Handedness} from './lineLength';
import {Delivery} from './pitchMap';

export interface BounceFrame {
  readonly frameIndex: number; // index into the original track
  readonly point: Point; // image-space ball position at the bounce
  readonly turnRadians: number; // how sharply the path turned here
}

interface Sample {
  readonly frameIndex: number;
  readonly point: Point;
}

const EPSILON = 1e-9;
const DEFAULT_MIN_TURN_RADIANS = 0.5;

// Detect the bounce as the sharpest corner in the ball's image-space path. The ball's flight is a
// smooth arc, so each step turns only slightly; the bounce reverses direction abruptly and shows
// up as the largest turn between consecutive motion vectors. This is view-agnostic — a bounce is a
// corner from any camera angle — but heuristic: validate and tune ``minTurnRadians`` against
// labelled clips. Returns null when there is no clear corner (too few points, or a straight path).
export function detectBounce(
  track: ReadonlyArray<Point | null>,
  minTurnRadians: number = DEFAULT_MIN_TURN_RADIANS,
): BounceFrame | null {
  const samples = collectSamples(track);
  if (samples.length < 3) {
    return null;
  }

  let best: BounceFrame | null = null;
  for (let i = 1; i < samples.length - 1; i++) {
    const previous = samples[i - 1];
    const current = samples[i];
    const next = samples[i + 1];
    if (previous === undefined || current === undefined || next === undefined) {
      continue;
    }
    const turn = turnAngle(previous.point, current.point, next.point);
    if (turn >= minTurnRadians && (best === null || turn > best.turnRadians)) {
      best = {frameIndex: current.frameIndex, point: current.point, turnRadians: turn};
    }
  }
  return best;
}

// Full chain from a tracked clip to a placed delivery: find the bounce, then project it onto the
// ground plane with the calibration. Returns null if no bounce is found.
export function deliveryFromTrack(
  track: ReadonlyArray<Point | null>,
  homography: Homography,
  handedness: Handedness,
  id: string,
  minTurnRadians?: number,
): Delivery | null {
  const bounce = detectBounce(track, minTurnRadians);
  if (bounce === null) {
    return null;
  }
  return {id, handedness, bounce: projectToGround(homography, bounce.point)};
}

function collectSamples(track: ReadonlyArray<Point | null>): Sample[] {
  const samples: Sample[] = [];
  track.forEach((point, frameIndex) => {
    if (point !== null) {
      samples.push({frameIndex, point});
    }
  });
  return samples;
}

// Direction change at ``current`` between the incoming and outgoing motion vectors, in radians
// (0 = straight on, up to pi = a full reversal).
function turnAngle(previous: Point, current: Point, next: Point): number {
  const inX = current.x - previous.x;
  const inY = current.y - previous.y;
  const outX = next.x - current.x;
  const outY = next.y - current.y;
  const inLength = Math.hypot(inX, inY);
  const outLength = Math.hypot(outX, outY);
  if (inLength < EPSILON || outLength < EPSILON) {
    return 0;
  }
  const cosine = (inX * outX + inY * outY) / (inLength * outLength);
  return Math.acos(Math.max(-1, Math.min(1, cosine)));
}
