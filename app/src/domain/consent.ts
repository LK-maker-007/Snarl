// The consent gate that must pass before anyone is filmed. ADR-0008 makes this "gate zero":
// consent + age check + an auditable record, with verifiable parental consent for minors, because
// non-consented footage cannot be used and cannot be fixed after the fact. This module is the pure
// decision logic; the current date is injected so age is deterministic and testable.

// India's DPDP Act treats a person under 18 as a minor (ADR-0008).
export const MINOR_AGE_YEARS = 18;

// A sanity bound so an obviously mistyped birth year is rejected rather than recorded.
const MAX_PLAUSIBLE_AGE_YEARS = 120;

// Phase 0 footage is used only for research (ADR-0011); the consent record names that purpose so a
// later change of purpose forces fresh consent rather than silently reusing the old one.
export type ConsentPurpose = 'research';

export interface BirthDate {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number; // 1-31
}

export interface Guardian {
  readonly name: string;
  readonly relationship: string;
}

interface ConsentRecordBase {
  readonly subjectName: string;
  readonly dateOfBirth: string; // ISO yyyy-mm-dd
  readonly ageYears: number;
  readonly purpose: ConsentPurpose;
  readonly consentedAt: string; // ISO timestamp the consent was captured
}

// A minor record always carries a guardian and an adult record never does; encoding that as a
// discriminated union makes the invariant compiler-enforced rather than a runtime convention.
// Note: this is a Phase-0 self-asserted consent record, not full DPDP-grade "verifiable" parental
// consent (no signature/identity check); a DPIA and stronger verification come before Phase 1
// (ADR-0008).
export type ConsentRecord =
  | (ConsentRecordBase & {readonly isMinor: false; readonly guardian: null})
  | (ConsentRecordBase & {readonly isMinor: true; readonly guardian: Guardian});

export interface ConsentInput {
  readonly subjectName: string;
  readonly birthDate: BirthDate;
  readonly subjectConsented: boolean;
  readonly guardianName: string;
  readonly guardianRelationship: string;
  readonly guardianConsented: boolean;
}

export type ConsentResult =
  | {readonly kind: 'ok'; readonly record: ConsentRecord}
  | {readonly kind: 'invalid'; readonly problems: readonly string[]};

// Build a real Date only when the components form an actual calendar day; JS rolls invalid dates
// over (e.g. Feb 30 -> Mar 2), so the round-trip check rejects those instead of accepting them.
function toDate(birth: BirthDate): Date | null {
  if (!Number.isInteger(birth.year) || !Number.isInteger(birth.month) || !Number.isInteger(birth.day)) {
    return null;
  }
  const date = new Date(birth.year, birth.month - 1, birth.day);
  const sameDay =
    date.getFullYear() === birth.year &&
    date.getMonth() === birth.month - 1 &&
    date.getDate() === birth.day;
  return sameDay ? date : null;
}

function ageInYears(birth: Date, asOf: Date): number {
  let age = asOf.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    asOf.getMonth() < birth.getMonth() ||
    (asOf.getMonth() === birth.getMonth() && asOf.getDate() < birth.getDate());
  if (beforeBirthday) {
    age -= 1;
  }
  return age;
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Age in whole years as of `asOf`, or null when the birth date is not a valid past calendar date.
// Used by the UI to decide whether to ask for guardian consent before the record is built.
export function birthDateToAge(birth: BirthDate, asOf: Date): number | null {
  const date = toDate(birth);
  if (date === null || date.getTime() > asOf.getTime()) {
    return null;
  }
  return ageInYears(date, asOf);
}

// Validate the input and produce an auditable consent record, or the full list of problems.
// All problems are collected (not just the first) so the form can show them at once.
export function buildConsentRecord(input: ConsentInput, asOf: Date): ConsentResult {
  const problems: string[] = [];

  const subjectName = input.subjectName.trim();
  if (subjectName.length === 0) {
    problems.push('Player name is required.');
  }

  const birth = toDate(input.birthDate);
  let ageYears: number | null = null;
  if (birth === null) {
    problems.push('Date of birth is not a valid calendar date.');
  } else if (birth.getTime() > asOf.getTime()) {
    problems.push('Date of birth is in the future.');
  } else {
    ageYears = ageInYears(birth, asOf);
    if (ageYears > MAX_PLAUSIBLE_AGE_YEARS) {
      problems.push('Date of birth is implausible — check the year.');
    }
  }

  if (!input.subjectConsented) {
    problems.push('The player must consent to being filmed.');
  }

  const isMinor = ageYears !== null && ageYears < MINOR_AGE_YEARS;
  let guardian: Guardian | null = null;
  if (isMinor) {
    const guardianName = input.guardianName.trim();
    const guardianRelationship = input.guardianRelationship.trim();
    if (guardianName.length === 0) {
      problems.push('A parent or guardian name is required for a minor.');
    }
    if (guardianRelationship.length === 0) {
      problems.push('The guardian relationship is required for a minor.');
    }
    if (!input.guardianConsented) {
      problems.push('A parent or guardian must consent for a minor.');
    }
    if (guardianName.length > 0 && guardianRelationship.length > 0 && input.guardianConsented) {
      guardian = {name: guardianName, relationship: guardianRelationship};
    }
  }

  if (problems.length > 0 || birth === null || ageYears === null) {
    return {kind: 'invalid', problems};
  }

  const base: ConsentRecordBase = {
    subjectName,
    dateOfBirth: formatIsoDate(birth),
    ageYears,
    purpose: 'research',
    consentedAt: asOf.toISOString(),
  };
  // guardian is guaranteed non-null here when isMinor (the validation above rejected otherwise),
  // and the && keeps the narrowing explicit without a non-null assertion.
  if (isMinor && guardian !== null) {
    return {kind: 'ok', record: {...base, isMinor: true, guardian}};
  }
  return {kind: 'ok', record: {...base, isMinor: false, guardian: null}};
}
