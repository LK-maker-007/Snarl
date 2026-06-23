import {Point} from './cricket';

export type Handedness = 'right' | 'left';

export type LengthZone = 'yorker' | 'full' | 'good' | 'backOfLength' | 'short';

export type LineZone =
  | 'wideOutsideOff'
  | 'outsideOff'
  | 'offStump'
  | 'middle'
  | 'legStump'
  | 'downLeg';

export interface DeliveryZones {
  readonly line: LineZone;
  readonly length: LengthZone;
}

// Coaching conventions, not laws — distances in metres from the batsman's stumps down the pitch.
// Exposed so an academy can tune them to how its coaches define a "good length".
export const LENGTH_BOUNDS = {
  yorker: 1.0,
  full: 3.0,
  good: 6.0,
  backOfLength: 8.0,
} as const;

// Lateral offset boundaries in metres, measured on the off side (positive). A left-hander's frame
// is mirrored before classifying so the same boundaries apply.
export const LINE_BOUNDS = {
  wideOutsideOff: 0.3,
  outsideOff: 0.12,
  offStump: 0.05,
  middle: -0.05,
  legStump: -0.12,
} as const;

export function classifyDelivery(bounce: Point, handedness: Handedness = 'right'): DeliveryZones {
  return {
    line: classifyLine(bounce.x, handedness),
    length: classifyLength(bounce.y),
  };
}

function classifyLength(downPitch: number): LengthZone {
  if (downPitch < LENGTH_BOUNDS.yorker) {
    return 'yorker';
  }
  if (downPitch < LENGTH_BOUNDS.full) {
    return 'full';
  }
  if (downPitch < LENGTH_BOUNDS.good) {
    return 'good';
  }
  if (downPitch < LENGTH_BOUNDS.backOfLength) {
    return 'backOfLength';
  }
  return 'short';
}

function classifyLine(lateral: number, handedness: Handedness): LineZone {
  const offside = handedness === 'right' ? lateral : -lateral;
  if (offside > LINE_BOUNDS.wideOutsideOff) {
    return 'wideOutsideOff';
  }
  if (offside > LINE_BOUNDS.outsideOff) {
    return 'outsideOff';
  }
  if (offside > LINE_BOUNDS.offStump) {
    return 'offStump';
  }
  if (offside >= LINE_BOUNDS.middle) {
    return 'middle';
  }
  if (offside >= LINE_BOUNDS.legStump) {
    return 'legStump';
  }
  return 'downLeg';
}
