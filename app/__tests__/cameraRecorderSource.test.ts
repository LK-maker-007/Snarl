import type {Recorder} from 'react-native-vision-camera';
import {createCameraRecorderSource} from '../src/camera/cameraRecorderSource';
import {CameraSettings} from '../src/domain/captureSpec';

const SETTINGS: CameraSettings = {fps: 120, shutterSeconds: 1 / 1000, resolutionHeight: 720};

type FinishedCallback = (filePath: string, reason: string) => void;
type ErrorCallback = (error: Error) => void;

// Minimal stand-in for the v5 Recorder: stopRecording fires the finished callback start() registered.
function fakeRecorder(filePath: string) {
  let finished: FinishedCallback | null = null;
  const recorder = {
    startRecording: async (onFinished: FinishedCallback, _onError: ErrorCallback) => {
      finished = onFinished;
    },
    stopRecording: async () => {
      finished?.(filePath, 'stopped');
    },
  };
  return recorder as unknown as Recorder;
}

describe('createCameraRecorderSource', () => {
  it('resolves stop() with the recorded clip path and fps', async () => {
    const source = createCameraRecorderSource(fakeRecorder('/data/clip.mp4'), SETTINGS, 120);
    await source.start();
    const clip = await source.stop();
    expect(clip).toEqual({uri: '/data/clip.mp4', fps: 120});
  });

  it('exposes the settings it was given', () => {
    const source = createCameraRecorderSource(fakeRecorder('/x'), SETTINGS, 120);
    expect(source.settings).toBe(SETTINGS);
  });

  it('rejects stop() when called before start()', async () => {
    const source = createCameraRecorderSource(fakeRecorder('/x'), SETTINGS, 120);
    await expect(source.stop()).rejects.toThrow('stop() called before start()');
  });
});
