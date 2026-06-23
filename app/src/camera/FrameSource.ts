import {CameraSettings} from '../domain/captureSpec';

export interface CapturedClip {
  readonly uri: string;
  readonly fps: number;
  readonly frameCount: number;
}

// The seam between the screens and a real high-speed camera. A native module (or a permissively
// licensed camera library) implements this on-device; the screens depend only on the interface so
// the capture flow and its UI stay testable without a device. Capture is decoupled from inference
// by design — record a clip here, process it later (never run the tracker during capture).
export interface FrameSource {
  readonly settings: CameraSettings;
  start(): Promise<void>;
  stop(): Promise<CapturedClip>;
}
