import {CameraFormat, selectCaptureFormat} from '../src/camera/selectFormat';

function format(videoWidth: number, videoHeight: number, maxFps: number): CameraFormat {
  return {videoWidth, videoHeight, minFps: 1, maxFps};
}

describe('selectCaptureFormat', () => {
  it('picks the highest frame rate that meets the floors', () => {
    const selected = selectCaptureFormat([
      format(1280, 720, 120),
      format(1280, 720, 240),
      format(1920, 1080, 60),
    ]);
    expect(selected?.fps).toBe(240);
    expect(selected?.format.videoHeight).toBe(720);
  });

  it('caps the record rate at the preferred rate', () => {
    const selected = selectCaptureFormat([format(1280, 720, 300)]);
    expect(selected?.fps).toBe(240);
  });

  it('breaks ties on equal fps by higher resolution', () => {
    const selected = selectCaptureFormat([
      format(1280, 720, 240),
      format(1920, 1080, 240),
    ]);
    expect(selected?.format.videoHeight).toBe(1080);
  });

  it('returns null when no format reaches the fps floor', () => {
    expect(selectCaptureFormat([format(1920, 1080, 60), format(1280, 720, 30)])).toBeNull();
  });

  it('returns null when no format reaches the resolution floor', () => {
    expect(selectCaptureFormat([format(640, 480, 240)])).toBeNull();
  });

  it('returns null for an empty format list', () => {
    expect(selectCaptureFormat([])).toBeNull();
  });

  it('reports settings that pass the capture spec', () => {
    const selected = selectCaptureFormat([format(1280, 720, 240)]);
    expect(selected?.settings).toEqual({fps: 240, shutterSeconds: 1 / 1000, resolutionHeight: 720});
  });
});
