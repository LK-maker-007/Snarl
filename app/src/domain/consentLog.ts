import {ConsentRecord} from './consent';

// A persisted consent: the validated record plus the id everything else references.
export interface StoredConsent {
  readonly consentId: string;
  readonly record: ConsentRecord;
}

// A recorded clip tied to the consent it was filmed under — ADR-0008 requires footage to be
// provably linked to a consent.
export interface ClipRecord {
  readonly clipUri: string;
  readonly fps: number;
  readonly consentId: string;
  readonly capturedAt: string; // ISO timestamp
}

// The persistence boundary: encrypted storage on-device, in-memory for tests.
export interface ConsentStore {
  saveConsent(stored: StoredConsent): void;
  consents(): readonly StoredConsent[];
  saveClip(clip: ClipRecord): void;
  clips(): readonly ClipRecord[];
}

// A local, per-device consent id: a sortable base-36 timestamp plus a random token. Not a globally
// unique UUID — adequate for one device's log (ADR-0012). Pure so the id is deterministic in tests;
// the timestamp and token are supplied by the caller.
export function formatConsentId(timestampMs: number, randomToken: string): string {
  if (!Number.isInteger(timestampMs) || timestampMs < 0) {
    throw new Error(`timestampMs must be a non-negative integer, got ${timestampMs}`);
  }
  if (randomToken.length === 0) {
    throw new Error('randomToken must be non-empty');
  }
  return `c_${timestampMs.toString(36)}_${randomToken}`;
}

export function createInMemoryConsentStore(): ConsentStore {
  const consentList: StoredConsent[] = [];
  const clipList: ClipRecord[] = [];
  return {
    saveConsent: stored => {
      consentList.push(stored);
    },
    consents: () => [...consentList],
    saveClip: clip => {
      clipList.push(clip);
    },
    clips: () => [...clipList],
  };
}
