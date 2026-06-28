import * as Keychain from 'react-native-keychain';
import {createMMKV} from 'react-native-mmkv';
import type {MMKV} from 'react-native-mmkv';
import {ClipRecord, ConsentStore, StoredConsent} from '../domain/consentLog';
import {log} from './log';
import {randomHex} from './random';

// Encrypted on-device consent store (ADR-0012). MMKV holds the data encrypted with AES-256; the key
// is generated once with the platform CSPRNG and kept in the Android Keystore via Keychain — never
// hardcoded. Requires the react-native-get-random-values polyfill to be imported at app entry.

const KEY_SERVICE = 'snarl.consentStoreKey'; // Keychain entry that holds the MMKV encryption key
const STORE_ID = 'snarl.consent';
const CONSENTS_KEY = 'consents';
const CLIPS_KEY = 'clips';
const KEY_BYTES = 32; // AES-256

async function loadEncryptionKey(): Promise<string> {
  const existing = await Keychain.getGenericPassword({service: KEY_SERVICE});
  if (existing !== false) {
    return existing.password;
  }
  const key = randomHex(KEY_BYTES);
  // setGenericPassword resolves to `false` on a Keystore write failure instead of throwing; a
  // dropped key would silently orphan every encrypted record on next launch, so fail loud.
  const written = await Keychain.setGenericPassword('mmkv', key, {service: KEY_SERVICE});
  if (written === false) {
    throw new Error('Keystore write failed — could not persist the consent encryption key');
  }
  return key;
}

function isStoredConsent(value: unknown): value is StoredConsent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.consentId === 'string' && typeof candidate.record === 'object';
}

function isClipRecord(value: unknown): value is ClipRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.clipUri === 'string' &&
    typeof candidate.fps === 'number' &&
    typeof candidate.consentId === 'string' &&
    typeof candidate.capturedAt === 'string'
  );
}

// Read a validated JSON array from storage. A missing value yields an empty list; a corrupt or
// unexpected value is logged and treated as empty so a damaged store degrades to "no records"
// instead of crashing capture (the consent gate then fails closed). Never throws.
function readList<T>(storage: MMKV, key: string, isValid: (value: unknown) => value is T): T[] {
  const raw = storage.getString(key);
  if (raw === undefined) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    log.error('consent store: corrupt JSON, ignoring', {key});
    return [];
  }
  if (!Array.isArray(parsed)) {
    log.error('consent store: expected an array', {key});
    return [];
  }
  const valid = parsed.filter(isValid);
  if (valid.length !== parsed.length) {
    log.error('consent store: dropped malformed records', {key, dropped: parsed.length - valid.length});
  }
  return valid;
}

export async function createEncryptedConsentStore(): Promise<ConsentStore> {
  const encryptionKey = await loadEncryptionKey();
  const storage = createMMKV({id: STORE_ID, encryptionKey, encryptionType: 'AES-256'});

  return {
    saveConsent: stored => {
      const all = readList(storage, CONSENTS_KEY, isStoredConsent);
      all.push(stored);
      storage.set(CONSENTS_KEY, JSON.stringify(all));
    },
    consents: () => readList(storage, CONSENTS_KEY, isStoredConsent),
    saveClip: clip => {
      const all = readList(storage, CLIPS_KEY, isClipRecord);
      all.push(clip);
      storage.set(CLIPS_KEY, JSON.stringify(all));
    },
    clips: () => readList(storage, CLIPS_KEY, isClipRecord),
  };
}
