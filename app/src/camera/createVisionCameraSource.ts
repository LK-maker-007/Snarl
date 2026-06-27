import type {Recorder} from 'react-native-vision-camera';
import {CameraSettings} from '../domain/captureSpec';
import {CapturedClip, FrameSource} from './FrameSource';

// Bridges a vision-camera Recorder to the FrameSource seam. Recording is callback-based, so the clip
// promise is armed in start() before recording begins and resolved when the finished callback fires
// after stop(). Only types are imported from the camera library, so this stays unit-testable without
// the native module. Frame count is not known at recording time — it is determined when frames are
// extracted from the clip.
export function createVisionCameraSource(
  recorder: Recorder,
  settings: CameraSettings,
  fps: number,
): FrameSource {
  let resolveClip: ((clip: CapturedClip) => void) | null = null;
  let rejectClip: ((error: Error) => void) | null = null;
  let pending: Promise<CapturedClip> | null = null;

  return {
    settings,
    start: async (): Promise<void> => {
      pending = new Promise<CapturedClip>((resolve, reject) => {
        resolveClip = resolve;
        rejectClip = reject;
      });
      await recorder.startRecording(
        filePath => resolveClip?.({uri: filePath, fps}),
        error => rejectClip?.(error),
      );
    },
    stop: async (): Promise<CapturedClip> => {
      if (pending === null) {
        throw new Error('stop() called before start()');
      }
      await recorder.stopRecording();
      return pending;
    },
  };
}
