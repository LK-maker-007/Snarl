import {
  Correspondence,
  meanResidual,
  projectToGround,
  solveHomography,
} from '../src/domain/calibration';

// A known ground-truth homography; correspondences generated from it must be recoverable.
const TRUE_HOMOGRAPHY = Float64Array.from([2, 0.1, 5, -0.2, 3, -4, 0.001, 0.002, 1]);

function worldFor(x: number, y: number) {
  return projectToGround(TRUE_HOMOGRAPHY, {x, y});
}

test('recovers a known homography from four correspondences', () => {
  const images = [
    {x: 10, y: 20},
    {x: 200, y: 30},
    {x: 220, y: 240},
    {x: 15, y: 250},
  ];
  const correspondences: Correspondence[] = images.map(image => ({
    image,
    world: worldFor(image.x, image.y),
  }));

  const homography = solveHomography(correspondences);
  expect(meanResidual(homography, correspondences)).toBeLessThan(1e-6);

  const fresh = {x: 123, y: 88};
  const projected = projectToGround(homography, fresh);
  const expected = worldFor(fresh.x, fresh.y);
  expect(projected.x).toBeCloseTo(expected.x, 4);
  expect(projected.y).toBeCloseTo(expected.y, 4);
});

test('rejects fewer than four points', () => {
  const points: Correspondence[] = [
    {image: {x: 0, y: 0}, world: {x: 0, y: 0}},
    {image: {x: 1, y: 0}, world: {x: 1, y: 0}},
    {image: {x: 0, y: 1}, world: {x: 0, y: 1}},
  ];
  expect(() => solveHomography(points)).toThrow(/at least 4/);
});

test('rejects degenerate (collinear) points', () => {
  const collinear: Correspondence[] = [0, 1, 2, 3].map(step => {
    const image = {x: step * 10, y: step * 10};
    return {image, world: worldFor(image.x, image.y)};
  });
  expect(() => solveHomography(collinear)).toThrow(/degenerate/);
});
