import {CAPTURE_SPEC, CameraSettings} from '../domain/captureSpec';

// The subset of a camera device format the capture spec cares about. The on-device camera library's
// format type carries far more; the adapter maps to this so the selection logic stays pure and
// testable without the native library.
export interface CameraFormat {
  readonly videoWidth: number;
  readonly videoHeight: number;
  readonly minFps: number;
  readonly maxFps: number;
}

export interface SelectedFormat {
  readonly format: CameraFormat;
  readonly fps: number; // frame rate to record at
  readonly settings: CameraSettings;
}

function isBetter(candidate: SelectedFormat, best: SelectedFormat): boolean {
  if (candidate.fps !== best.fps) {
    return candidate.fps > best.fps;
  }
  return candidate.format.videoHeight > best.format.videoHeight;
}

// Pick the format that best meets CAPTURE_SPEC: at or above the resolution and fps floors, then the
// highest frame rate (capped at the preferred rate), and the highest resolution as a tie-break.
// Returns null when no format reaches both floors. Shutter is not a format property — it is governed
// by lighting/exposure and surfaced to the operator via FRAMING_CHECKLIST — so the reported
// shutterSeconds is the spec target, not a value format selection can guarantee.
export function selectCaptureFormat(formats: readonly CameraFormat[]): SelectedFormat | null {
  let best: SelectedFormat | null = null;
  for (const format of formats) {
    if (
      format.videoHeight < CAPTURE_SPEC.minResolutionHeight ||
      format.maxFps < CAPTURE_SPEC.minFps
    ) {
      continue;
    }
    const fps = Math.min(format.maxFps, CAPTURE_SPEC.preferredFps);
    const candidate: SelectedFormat = {
      format,
      fps,
      settings: {
        fps,
        shutterSeconds: CAPTURE_SPEC.maxShutterSeconds,
        resolutionHeight: format.videoHeight,
      },
    };
    if (best === null || isBetter(candidate, best)) {
      best = candidate;
    }
  }
  return best;
}
