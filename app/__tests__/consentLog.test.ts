import {ConsentRecord} from '../src/domain/consent';
import {
  ClipRecord,
  createInMemoryConsentStore,
  formatConsentId,
  StoredConsent,
} from '../src/domain/consentLog';

const ADULT: ConsentRecord = {
  subjectName: 'A. Player',
  dateOfBirth: '1998-04-12',
  ageYears: 28,
  purpose: 'research',
  consentedAt: '2026-06-27T09:00:00.000Z',
  isMinor: false,
  guardian: null,
};

const STORED: StoredConsent = {consentId: 'c_abc_xyz', record: ADULT};
const CLIP: ClipRecord = {
  clipUri: '/data/clip.mp4',
  fps: 120,
  consentId: 'c_abc_xyz',
  capturedAt: '2026-06-27T09:05:00.000Z',
};

describe('formatConsentId', () => {
  it('builds a sortable timestamp + token id', () => {
    expect(formatConsentId(0, 'tok')).toBe('c_0_tok');
    expect(formatConsentId(1719479100000, 'k9')).toBe(`c_${(1719479100000).toString(36)}_k9`);
  });

  it('rejects a negative or non-integer timestamp and an empty token', () => {
    expect(() => formatConsentId(-1, 'tok')).toThrow();
    expect(() => formatConsentId(1.5, 'tok')).toThrow();
    expect(() => formatConsentId(1, '')).toThrow();
  });
});

describe('in-memory consent store', () => {
  it('saves and returns consents', () => {
    const store = createInMemoryConsentStore();
    store.saveConsent(STORED);
    expect(store.consents()).toEqual([STORED]);
  });

  it('links and returns clips', () => {
    const store = createInMemoryConsentStore();
    store.saveClip(CLIP);
    expect(store.clips()).toEqual([CLIP]);
    expect(store.clips()[0]?.consentId).toBe('c_abc_xyz');
  });

  it('returns copies, so mutating the result does not change the store', () => {
    const store = createInMemoryConsentStore();
    store.saveConsent(STORED);
    // Cast past the readonly return to confirm the runtime copy holds even if a caller forces it.
    (store.consents() as StoredConsent[]).push({consentId: 'rogue', record: ADULT});
    expect(store.consents()).toHaveLength(1);
  });
});
