import {base64ToBytes} from '../src/ml/base64';

describe('base64ToBytes', () => {
  it('decodes a full triplet', () => {
    expect(Array.from(base64ToBytes('AAECAwQF'))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('decodes ASCII text', () => {
    expect(Array.from(base64ToBytes('TWFu'))).toEqual([77, 97, 110]);
  });

  it('handles padding', () => {
    expect(Array.from(base64ToBytes('TWE='))).toEqual([77, 97]);
  });

  it('ignores whitespace (line-wrapped base64)', () => {
    expect(Array.from(base64ToBytes('TW\nFu'))).toEqual([77, 97, 110]);
  });

  it('throws on an invalid character', () => {
    expect(() => base64ToBytes('@@@@')).toThrow();
  });
});
