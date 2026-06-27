// A recorded clip the tracker consumes: ordered base64 JPEG frames plus their dimensions and fps.
// Capture is decoupled from inference (ADR-0006), so the tracker only ever sees a finished clip,
// never a live camera. An empty `frames` means no clip is available.
export interface TrackerSource {
  readonly frames: readonly string[];
  readonly width: number;
  readonly height: number;
  readonly fps: number;
}
