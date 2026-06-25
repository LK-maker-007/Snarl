// Demo clip source. This committed stub carries no frames, so the app builds, type-checks, and
// tests without the research-only TrackNetV2 footage (which must not be redistributed — ADR-0011).
// A local build overwrites this file with the real base64 frames; that local copy is kept out of
// git (git update-index --skip-worktree). An empty `frames` array means no demo is bundled, and the
// home screen hides the tracker entry.
export const DEMO_SOURCE = {
  frames: [] as string[],
  width: 640,
  height: 360,
  fps: 30,
};
