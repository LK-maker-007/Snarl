import {checkSettings} from '../src/domain/captureSpec';

test('accepts settings that meet the bar', () => {
  const result = checkSettings({fps: 240, shutterSeconds: 1 / 2000, resolutionHeight: 1080});
  expect(result.ok).toBe(true);
  expect(result.failures).toHaveLength(0);
});

test('flags every failing setting', () => {
  const result = checkSettings({fps: 60, shutterSeconds: 1 / 200, resolutionHeight: 480});
  expect(result.ok).toBe(false);
  expect(result.failures).toHaveLength(3);
});

test('passes a borderline clip at the exact minimums', () => {
  const result = checkSettings({fps: 120, shutterSeconds: 1 / 1000, resolutionHeight: 720});
  expect(result.ok).toBe(true);
});
