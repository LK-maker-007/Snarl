import {TrackerSource} from '../domain/clip';
import {Point} from '../domain/cricket';
import {rectifyTrack} from '../domain/trajectory';
import {decodeJpegBase64} from './decodeJpeg';
import {createCachedAccessor} from './frameCache';
import {loadTfliteRunner} from './TfliteModelRunner';
import {trackClip} from './trackClip';

// Run the on-device tracker over a recorded clip and return the cleaned per-frame ball track.
// Loads the model, decodes frames on demand through a bounded cache (never holding all decoded
// frames in RAM — ADR-0006), runs the sliding 3-frame windows, then rectifies the track. Kept out
// of the screen so the inference pipeline is reusable and testable without rendering a component.
export async function analyzeClip(source: TrackerSource): Promise<(Point | null)[]> {
  const runner = await loadTfliteRunner();
  const accessor = createCachedAccessor(source.frames.length, index => {
    const encoded = source.frames[index];
    if (encoded === undefined) {
      throw new Error(`missing frame ${index}`);
    }
    const frame = decodeJpegBase64(encoded);
    if (frame.width !== source.width || frame.height !== source.height) {
      throw new Error(
        `frame ${index} is ${frame.width}x${frame.height}, expected ` +
          `${source.width}x${source.height}`,
      );
    }
    return frame.data;
  });
  const track = await trackClip(runner, accessor, source.width, source.height);
  return rectifyTrack(track);
}
