import {Point} from './cricket';

// A homography maps image pixels to the ground plane. Stored row-major as nine coefficients
// [h11, h12, h13, h21, h22, h23, h31, h32, h33].
export type Homography = Float64Array;

export interface Correspondence {
  readonly image: Point;
  readonly world: Point;
}

const MIN_CORRESPONDENCES = 4;
const NEAR_ZERO = 1e-12;

// Solve the ground-plane homography from marked image/world point pairs (direct linear transform,
// least squares for more than four points). Throws if there are too few points or they are
// degenerate (collinear or coincident), which would make the mapping unrecoverable.
export function solveHomography(correspondences: readonly Correspondence[]): Homography {
  if (correspondences.length < MIN_CORRESPONDENCES) {
    throw new Error(
      `calibration needs at least ${MIN_CORRESPONDENCES} points, got ${correspondences.length}`,
    );
  }

  const rowCount = correspondences.length * 2;
  const a = new Float64Array(rowCount * 8);
  const b = new Float64Array(rowCount);
  correspondences.forEach((pair, index) => {
    const {x, y} = pair.image;
    const {x: worldX, y: worldY} = pair.world;
    const rowX = index * 2 * 8;
    a[rowX] = x;
    a[rowX + 1] = y;
    a[rowX + 2] = 1;
    a[rowX + 6] = -x * worldX;
    a[rowX + 7] = -y * worldX;
    b[index * 2] = worldX;
    const rowY = (index * 2 + 1) * 8;
    a[rowY + 3] = x;
    a[rowY + 4] = y;
    a[rowY + 5] = 1;
    a[rowY + 6] = -x * worldY;
    a[rowY + 7] = -y * worldY;
    b[index * 2 + 1] = worldY;
  });

  const {normal, projected} = normalEquations(a, b, rowCount, 8);
  const solution = solveLinearSystem(normal, projected, 8);
  const homography = new Float64Array(9);
  homography.set(solution);
  homography[8] = 1;
  return homography;
}

// Map an image point to ground-plane (world) metres under a solved homography.
export function projectToGround(homography: Homography, image: Point): Point {
  const denominator = at(homography, 6) * image.x + at(homography, 7) * image.y + at(homography, 8);
  if (Math.abs(denominator) < NEAR_ZERO) {
    throw new Error('point projects to infinity under this calibration');
  }
  const worldX = at(homography, 0) * image.x + at(homography, 1) * image.y + at(homography, 2);
  const worldY = at(homography, 3) * image.x + at(homography, 4) * image.y + at(homography, 5);
  return {x: worldX / denominator, y: worldY / denominator};
}

// Mean reprojection error in metres: how far the marked points land from their true positions.
export function meanResidual(
  homography: Homography,
  correspondences: readonly Correspondence[],
): number {
  if (correspondences.length === 0) {
    return 0;
  }
  let total = 0;
  for (const pair of correspondences) {
    const projected = projectToGround(homography, pair.image);
    total += Math.hypot(projected.x - pair.world.x, projected.y - pair.world.y);
  }
  return total / correspondences.length;
}

// Read a cell as a number; the kernel only ever indexes in range, so undefined means a bug.
function at(cells: Float64Array, index: number): number {
  const cell = cells[index];
  if (cell === undefined) {
    throw new RangeError(`index ${index} is out of range`);
  }
  return cell;
}

function normalEquations(
  a: Float64Array,
  b: Float64Array,
  rowCount: number,
  columns: number,
): {normal: Float64Array; projected: Float64Array} {
  const normal = new Float64Array(columns * columns);
  const projected = new Float64Array(columns);
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < columns; j++) {
      let sum = 0;
      for (let r = 0; r < rowCount; r++) {
        sum += at(a, r * columns + i) * at(a, r * columns + j);
      }
      normal[i * columns + j] = sum;
    }
    let projectedSum = 0;
    for (let r = 0; r < rowCount; r++) {
      projectedSum += at(a, r * columns + i) * at(b, r);
    }
    projected[i] = projectedSum;
  }
  return {normal, projected};
}

// Gauss-Jordan elimination with partial pivoting; throws if the system is singular.
function solveLinearSystem(matrix: Float64Array, vector: Float64Array, n: number): Float64Array {
  const a = Float64Array.from(matrix);
  const b = Float64Array.from(vector);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(at(a, row * n + col)) > Math.abs(at(a, pivot * n + col))) {
        pivot = row;
      }
    }
    if (Math.abs(at(a, pivot * n + col)) < NEAR_ZERO) {
      throw new Error('calibration points are degenerate (collinear or coincident)');
    }
    if (pivot !== col) {
      swapRows(a, b, pivot, col, n);
    }
    const diagonal = at(a, col * n + col);
    for (let row = 0; row < n; row++) {
      if (row === col) {
        continue;
      }
      const factor = at(a, row * n + col) / diagonal;
      if (factor === 0) {
        continue;
      }
      for (let k = col; k < n; k++) {
        a[row * n + k] = at(a, row * n + k) - factor * at(a, col * n + k);
      }
      b[row] = at(b, row) - factor * at(b, col);
    }
  }
  const solution = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    solution[i] = at(b, i) / at(a, i * n + i);
  }
  return solution;
}

function swapRows(a: Float64Array, b: Float64Array, first: number, second: number, n: number): void {
  for (let k = 0; k < n; k++) {
    const temp = at(a, first * n + k);
    a[first * n + k] = at(a, second * n + k);
    a[second * n + k] = temp;
  }
  const tempB = at(b, first);
  b[first] = at(b, second);
  b[second] = tempB;
}
