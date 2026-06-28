// Cryptographically-strong random hex, backed by the platform CSPRNG. Requires the
// react-native-get-random-values polyfill to be imported at app entry; throws loudly if the
// CSPRNG is unavailable rather than falling back to a weak source.
interface RandomSource {
  getRandomValues(array: Uint8Array): Uint8Array;
}

export function randomHex(byteLength: number): string {
  if (!Number.isInteger(byteLength) || byteLength <= 0) {
    throw new Error(`byteLength must be a positive integer, got ${byteLength}`);
  }
  const source = (globalThis as unknown as {crypto?: RandomSource}).crypto;
  if (source?.getRandomValues === undefined) {
    throw new Error('crypto.getRandomValues unavailable — import react-native-get-random-values');
  }
  const bytes = source.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
