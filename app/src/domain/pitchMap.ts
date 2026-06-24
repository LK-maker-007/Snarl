import {Point} from './cricket';
import {
  Handedness,
  LENGTH_ZONES,
  LINE_ZONES,
  LengthZone,
  LineZone,
  classifyDelivery,
} from './lineLength';

// The slice of the pitch the diagram shows, in world metres (origin at the batsman's stumps).
export const PITCH_VIEW = {
  nearY: -1.0, // a little behind the batsman's stumps
  farY: 12.0, // far enough down the pitch to cover short deliveries
  halfWidth: 1.6, // lateral extent shown either side of the middle stump
} as const;

export interface DiagramPosition {
  readonly x: number; // 0 (left edge) .. 1 (right edge)
  readonly y: number; // 0 (batsman end) .. 1 (down the pitch toward the bowler)
}

export interface Delivery {
  readonly id: string;
  readonly bounce: Point; // world ground point in metres
  readonly handedness: Handedness;
}

export interface ZoneSummary {
  readonly byLength: Record<LengthZone, number>;
  readonly byLine: Record<LineZone, number>;
}

// Map a world ground point to a normalized position within the rendered pitch view. Handedness
// does not move the dot (it is a physical position); it only changes how the line is named.
export function toDiagramPosition(world: Point): DiagramPosition {
  const x = (world.x + PITCH_VIEW.halfWidth) / (2 * PITCH_VIEW.halfWidth);
  const y = (world.y - PITCH_VIEW.nearY) / (PITCH_VIEW.farY - PITCH_VIEW.nearY);
  return {x: clamp01(x), y: clamp01(y)};
}

export function summarizeDeliveries(deliveries: readonly Delivery[]): ZoneSummary {
  const byLength = zeroCounts(LENGTH_ZONES);
  const byLine = zeroCounts(LINE_ZONES);
  for (const delivery of deliveries) {
    const zones = classifyDelivery(delivery.bounce, delivery.handedness);
    byLength[zones.length] += 1;
    byLine[zones.line] += 1;
  }
  return {byLength, byLine};
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function zeroCounts<T extends string>(keys: readonly T[]): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const key of keys) {
    counts[key] = 0;
  }
  return counts;
}
