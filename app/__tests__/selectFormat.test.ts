import {CameraFormat, selectCaptureFormat} from '../src/camera/selectFormat';

function format(videoHeight: number, maxFps: number, minFps = 1): CameraFormat {
  return {videoHeight, minFps, maxFps};
}

describe('selectCaptureFormat', () => {
  it('picks the highest frame rate that meets the floors', () => {
    const selected = selectCaptureFormat([format(720, 120), format(720, 240), format(1080, 60)]);
    expect(selected?.fps).toBe(240);
    expect(selected?.format.videoHeight).toBe(720);
  });

  it('caps the record rate at the preferred rate', () => {
    expect(selectCaptureFormat([format(720, 300)])?.fps).toBe(240);
  });

  it('breaks ties on equal fps by higher resolution', () => {
    const selected = selectCaptureFormat([format(720, 240), format(1080, 240)]);
    expect(selected?.format.videoHeight).toBe(1080);
  });

  it('skips a format whose minimum rate exceeds the preferred rate', () => {
    expect(selectCaptureFormat([format(720, 300, 300)])).toBeNull();
  });

  it('returns null when no format reaches the fps floor', () => {
    expect(selectCaptureFormat([format(1080, 60), format(720, 30)])).toBeNull();
  });

  it('returns null when no format reaches the resolution floor', () => {
    expect(selectCaptureFormat([format(480, 240)])).toBeNull();
  });

  it('returns null for an empty format list', () => {
    expect(selectCaptureFormat([])).toBeNull();
  });

  it('reports settings that pass the capture spec', () => {
    const selected = selectCaptureFormat([format(720, 240)]);
    expect(selected?.settings).toEqual({fps: 240, shutterSeconds: 1 / 1000, resolutionHeight: 720});
  });
});
