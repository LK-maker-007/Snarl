import * as Keychain from 'react-native-keychain';
import {createMMKV} from 'react-native-mmkv';
import type {MMKV} from 'react-native-mmkv';
import {ClipRecord, ConsentStore, StoredConsent} from '../domain/consentLog';

// Encrypted on-device consent store (ADR-0012). MMKV holds the data encrypted with AES-256; the key
// is generated once with the platform CSPRNG and kept in the Android Keystore via Keychain — never
// hardcoded. Requires the react-native-get-random-values polyfill to be imported at app entry.

const KEY_SERVICE = 'snarl.consentStoreKey'; // Keychain entry that holds the MMKV encryption key
const STORE_ID = 'snarl.consent';
const CONSENTS_KEY = 'consents';
const CLIPS_KEY = 'clips';
const KEY_BYTES = 32;

interface RandomSource {
  getRandomValues(array: Uint8Array): Uint8Array;
}

function randomKeyHex(): string {
  const source = (globalThis as unknown as {crypto?: RandomSource}).crypto;
  if (source?.getRandomValues === undefined) {
    throw new Error('crypto.getRandomValues is unavailable — import react-native-get-random-values');
  }
  const bytes = source.getRandomValues(new Uint8Array(KEY_BYTES));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function loadEncryptionKey(): Promise<string> {
  const existing = await Keychain.getGenericPassword({service: KEY_SERVICE});
  if (existing !== false) {
    return existing.password;
  }
  const key = randomKeyHex();
  await Keychain.setGenericPassword('mmkv', key, {service: KEY_SERVICE});
  return key;
}

// Read a JSON array from storage; a missing or non-array value yields an empty list rather than
// throwing, so a fresh or corrupted store degrades to "no records" instead of crashing capture.
function readList<T>(storage: MMKV, key: string): T[] {
  const raw = storage.getString(key);
  if (raw === undefined) {
    return [];
  }
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

export async function createEncryptedConsentStore(): Promise<ConsentStore> {
  const encryptionKey = await loadEncryptionKey();
  const storage = createMMKV({id: STORE_ID, encryptionKey, encryptionType: 'AES-256'});

  return {
    saveConsent: stored => {
      const all = readList<StoredConsent>(storage, CONSENTS_KEY);
      all.push(stored);
      storage.set(CONSENTS_KEY, JSON.stringify(all));
    },
    consents: () => readList<StoredConsent>(storage, CONSENTS_KEY),
    saveClip: clip => {
      const all = readList<ClipRecord>(storage, CLIPS_KEY);
      all.push(clip);
      storage.set(CLIPS_KEY, JSON.stringify(all));
    },
    clips: () => readList<ClipRecord>(storage, CLIPS_KEY),
  };
}
