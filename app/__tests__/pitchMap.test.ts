import {Delivery, PITCH_VIEW, summarizeDeliveries, toDiagramPosition} from '../src/domain/pitchMap';

test('maps world points to normalized diagram positions', () => {
  const middle = toDiagramPosition({x: 0, y: 0});
  expect(middle.x).toBeCloseTo(0.5, 5);
  expect(middle.y).toBeCloseTo(
    (0 - PITCH_VIEW.nearY) / (PITCH_VIEW.farY - PITCH_VIEW.nearY),
    5,
  );

  const offFar = toDiagramPosition({x: PITCH_VIEW.halfWidth, y: PITCH_VIEW.farY});
  expect(offFar.x).toBeCloseTo(1, 5);
  expect(offFar.y).toBeCloseTo(1, 5);
});

test('clamps points outside the view', () => {
  const far = toDiagramPosition({x: 99, y: 99});
  expect(far.x).toBe(1);
  expect(far.y).toBe(1);

  const behind = toDiagramPosition({x: -99, y: -99});
  expect(behind.x).toBe(0);
  expect(behind.y).toBe(0);
});

test('summarizes deliveries by zone', () => {
  const deliveries: Delivery[] = [
    {id: 'a', bounce: {x: 0, y: 4.5}, handedness: 'right'},
    {id: 'b', bounce: {x: 0, y: 4.0}, handedness: 'right'},
    {id: 'c', bounce: {x: 0, y: 0.5}, handedness: 'right'},
  ];
  const summary = summarizeDeliveries(deliveries);
  expect(summary.byLength.good).toBe(2);
  expect(summary.byLength.yorker).toBe(1);
  expect(summary.byLength.short).toBe(0);
  expect(summary.byLine.middle).toBe(3);
});
