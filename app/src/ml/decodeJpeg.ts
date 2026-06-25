import {decode} from 'jpeg-js';
import {base64ToBytes} from './base64';

export interface DecodedFrame {
  readonly data: Uint8Array; // RGBA, length width*height*4
  readonly width: number;
  readonly height: number;
}

// Decode a base64 JPEG frame to RGBA bytes. `formatAsRGBA` guarantees four channels per pixel,
// which is the layout the input-tensor builder expects.
export function decodeJpegBase64(base64: string): DecodedFrame {
  const decoded = decode(base64ToBytes(base64), {useTArray: true, formatAsRGBA: true});
  return {data: decoded.data, width: decoded.width, height: decoded.height};
}
