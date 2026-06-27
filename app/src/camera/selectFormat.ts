import {CAPTURE_SPEC, CameraSettings} from '../domain/captureSpec';

// The subset of a camera device format the capture spec cares about. The on-device camera library's
// format type carries far more; the adapter maps to this so the selection logic stays pure and
// testable without the native library.
export interface CameraFormat {
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

// Pick the format that best meets CAPTURE_SPEC: highest frame rate at or above the floors, with
// resolution as the tie-break. A format whose own minimum rate exceeds our target is skipped — we
// could not then record at or below the preferred rate. Shutter is not a format property; it is set
// by lighting/exposure and surfaced to the operator via FRAMING_CHECKLIST, so the reported
// shutterSeconds is the spec target, not a value selection can guarantee.
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
    if (fps < format.minFps) {
      continue;
    }
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
