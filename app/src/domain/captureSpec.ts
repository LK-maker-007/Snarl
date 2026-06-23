// The capture bar a clip must clear for the tracker to have any chance. A fast ball in slow or
// blurry video is untrackable, so these are gates, not suggestions (see ml/DATA_COLLECTION.md).
export const CAPTURE_SPEC = {
  minFps: 120,
  preferredFps: 240,
  maxShutterSeconds: 1 / 1000,
  minResolutionHeight: 720,
  preferredResolutionHeight: 1080,
} as const;

// Framing requirements a coach checks before recording; the camera cannot verify these.
export const FRAMING_CHECKLIST: readonly string[] = [
  'Camera on a tripod, ~4-6 m behind the bowler, ~1.8 m high',
  'Stumps in frame (needed for calibration)',
  'Clean, static background (a net or wall)',
  'Focus and exposure locked',
  'Bright, even light',
];

export interface CameraSettings {
  readonly fps: number;
  readonly shutterSeconds: number;
  readonly resolutionHeight: number;
}

export interface SpecCheck {
  readonly ok: boolean;
  readonly failures: readonly string[];
}

export function checkSettings(settings: CameraSettings): SpecCheck {
  const failures: string[] = [];
  if (settings.fps < CAPTURE_SPEC.minFps) {
    failures.push(`frame rate ${settings.fps} fps is below the ${CAPTURE_SPEC.minFps} fps minimum`);
  }
  if (settings.shutterSeconds > CAPTURE_SPEC.maxShutterSeconds) {
    failures.push(
      `shutter 1/${Math.round(1 / settings.shutterSeconds)} s is slower than the ` +
        `1/${Math.round(1 / CAPTURE_SPEC.maxShutterSeconds)} s ceiling`,
    );
  }
  if (settings.resolutionHeight < CAPTURE_SPEC.minResolutionHeight) {
    failures.push(
      `resolution ${settings.resolutionHeight}p is below the ${CAPTURE_SPEC.minResolutionHeight}p floor`,
    );
  }
  return {ok: failures.length === 0, failures};
}
