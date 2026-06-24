import {deliveryFromTrack, detectBounce} from '../src/domain/bounce';
import {Point} from '../src/domain/cricket';

const IDENTITY = Float64Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);

const V_PATH: (Point | null)[] = [
  {x: 0, y: 0},
  {x: 10, y: 10},
  {x: 20, y: 20},
  {x: 30, y: 10},
  {x: 40, y: 0},
];

test('detects the bounce at the sharpest corner of the path', () => {
  const bounce = detectBounce(V_PATH);
  expect(bounce).not.toBeNull();
  expect(bounce?.frameIndex).toBe(2);
  expect(bounce?.point).toEqual({x: 20, y: 20});
});

test('keeps the original frame index across gaps', () => {
  const track: (Point | null)[] = [
    null,
    {x: 0, y: 0},
    {x: 10, y: 10},
    null,
    {x: 20, y: 20}, // corner here, at original index 4
    {x: 30, y: 10},
    {x: 40, y: 0},
  ];
  expect(detectBounce(track)?.frameIndex).toBe(4);
});

test('returns null for a near-straight path', () => {
  const straight: (Point | null)[] = [
    {x: 0, y: 0},
    {x: 10, y: 10},
    {x: 20, y: 20},
    {x: 30, y: 30},
  ];
  expect(detectBounce(straight)).toBeNull();
});

test('returns null with too few points', () => {
  expect(detectBounce([{x: 0, y: 0}, null])).toBeNull();
});

test('deliveryFromTrack projects the bounce onto the ground', () => {
  const delivery = deliveryFromTrack(V_PATH, IDENTITY, 'right', 'd1');
  expect(delivery).not.toBeNull();
  expect(delivery?.id).toBe('d1');
  expect(delivery?.bounce).toEqual({x: 20, y: 20}); // identity homography is a pass-through
});
