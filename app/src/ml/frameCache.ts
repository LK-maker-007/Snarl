import {FrameAccessor} from './trackClip';

// Wrap a per-frame decode function in an accessor that keeps only the most recent few decoded
// frames. Decoded RGBA frames are large, so materializing a whole clip risks OOM (ADR-0006);
// trackClip reads frames in sequential sliding windows, so a small cache gives near-total reuse
// while holding only a handful of frames at once. Eviction is insertion-order (FIFO), which for
// sequential access keeps exactly the live window.
export function createCachedAccessor(
  count: number,
  decode: (index: number) => Uint8Array,
  cacheSize: number = 4,
): FrameAccessor {
  if (count < 0) {
    throw new Error(`count must be non-negative, got ${count}`);
  }
  if (cacheSize <= 0) {
    throw new Error(`cacheSize must be positive, got ${cacheSize}`);
  }

  const cache = new Map<number, Uint8Array>();
  return {
    count,
    at(index: number): Uint8Array {
      if (index < 0 || index >= count) {
        throw new Error(`frame index ${index} out of range [0, ${count})`);
      }
      const cached = cache.get(index);
      if (cached !== undefined) {
        return cached;
      }
      const decoded = decode(index);
      cache.set(index, decoded);
      if (cache.size > cacheSize) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) {
          cache.delete(oldest);
        }
      }
      return decoded;
    },
  };
}
