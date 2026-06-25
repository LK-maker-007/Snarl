/* eslint-disable no-bitwise -- base64 decodes 6-bit groups into bytes; bitwise shifts and masks
   are the standard, clearest implementation of that packing. */

// Decode a standard base64 string to bytes. The demo frames are embedded as base64 (the phone
// can't reach Metro over a cable/Wi-Fi, so assets ship inside the JS bundle); decoding here keeps
// the frame loader independent of whether the JS engine exposes a global `atob`.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const LOOKUP = buildLookup();

function buildLookup(): Int16Array {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) {
    table[ALPHABET.charCodeAt(i)] = i;
  }
  return table;
}

export function base64ToBytes(base64: string): Uint8Array {
  const input = base64.replace(/\s+/g, '');
  let charCount = input.length;
  while (charCount > 0 && input[charCount - 1] === '=') {
    charCount--;
  }

  const bytes = new Uint8Array(Math.floor((charCount * 6) / 8));
  let outIndex = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < charCount; i++) {
    const value = LOOKUP[input.charCodeAt(i)];
    if (value === undefined || value < 0) {
      throw new Error(`invalid base64 character at index ${i}`);
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[outIndex++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}
