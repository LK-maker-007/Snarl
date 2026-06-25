import {createCachedAccessor} from '../src/ml/frameCache';

describe('createCachedAccessor', () => {
  it('decodes each frame once when read sequentially within the cache window', () => {
    const calls: number[] = [];
    const accessor = createCachedAccessor(
      5,
      index => {
        calls.push(index);
        return new Uint8Array([index]);
      },
      4,
    );
    // Sliding 3-windows: (0,1,2), (1,2,3), (2,3,4). With a 4-frame cache, no frame re-decodes.
    for (let start = 0; start + 3 <= accessor.count; start++) {
      accessor.at(start);
      accessor.at(start + 1);
      accessor.at(start + 2);
    }
    expect(calls).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns the decoded bytes', () => {
    const accessor = createCachedAccessor(3, index => new Uint8Array([index * 10]), 4);
    expect(Array.from(accessor.at(2))).toEqual([20]);
  });

  it('throws when the index is out of range', () => {
    const accessor = createCachedAccessor(2, () => new Uint8Array(1), 4);
    expect(() => accessor.at(2)).toThrow();
    expect(() => accessor.at(-1)).toThrow();
  });

  it('rejects a non-positive cache size', () => {
    expect(() => createCachedAccessor(1, () => new Uint8Array(1), 0)).toThrow();
  });
});
