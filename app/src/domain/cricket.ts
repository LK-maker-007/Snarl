export interface Point {
  readonly x: number;
  readonly y: number;
}

// Ground-plane world frame in metres. Origin at the batsman's middle-stump base; +x toward the
// off side (for a right-hander), +y down the pitch toward the bowler. Bounce points lie on this
// plane, which is what makes line and length recoverable from a single calibrated camera.
export const CRICKET = {
  pitchLength: 20.12, // stump line to stump line (22 yd)
  wicketWidth: 0.2286, // outer width of the three stumps (9 in)
  stumpHeight: 0.7112, // ground to the top of the stumps (28 in)
  poppingCreaseFromStumps: 1.22, // popping crease toward the bowler from the stumps (4 ft)
  returnCreaseFromMiddle: 1.32, // each return crease from the middle stump (4 ft 4 in)
} as const;

const halfWicket = CRICKET.wicketWidth / 2;

// Ground points a coach can mark on a frame; world coordinates follow from the laws above.
export const REFERENCE_POINTS = {
  battingMiddleStump: {x: 0, y: 0},
  battingOffStump: {x: halfWicket, y: 0},
  battingLegStump: {x: -halfWicket, y: 0},
  battingPoppingOff: {x: CRICKET.returnCreaseFromMiddle, y: CRICKET.poppingCreaseFromStumps},
  battingPoppingLeg: {x: -CRICKET.returnCreaseFromMiddle, y: CRICKET.poppingCreaseFromStumps},
  bowlingMiddleStump: {x: 0, y: CRICKET.pitchLength},
} as const satisfies Record<string, Point>;

export type ReferencePointId = keyof typeof REFERENCE_POINTS;

export const REFERENCE_LABELS: Record<ReferencePointId, string> = {
  battingMiddleStump: 'batting middle-stump base',
  battingOffStump: 'batting off-stump base',
  battingLegStump: 'batting leg-stump base',
  battingPoppingOff: 'popping crease, off-side corner',
  battingPoppingLeg: 'popping crease, leg-side corner',
  bowlingMiddleStump: "bowler's middle-stump base",
};

// The four ground points to mark for calibration: two stump bases and two popping-crease corners
// form a non-collinear quad spanning the near ground, enough to solve the homography.
export const CALIBRATION_SEQUENCE: readonly ReferencePointId[] = [
  'battingOffStump',
  'battingLegStump',
  'battingPoppingOff',
  'battingPoppingLeg',
];
