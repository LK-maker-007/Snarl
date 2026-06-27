import {
  birthDateToAge,
  buildConsentRecord,
  ConsentInput,
  MINOR_AGE_YEARS,
} from '../src/domain/consent';

// Fixed reference date so age and the consent timestamp are deterministic (month is 0-indexed).
const AS_OF = new Date(2026, 5, 27, 9, 0, 0);

function adultInput(overrides: Partial<ConsentInput> = {}): ConsentInput {
  return {
    subjectName: 'A. Player',
    birthDate: {year: 1998, month: 4, day: 12},
    subjectConsented: true,
    guardianName: '',
    guardianRelationship: '',
    guardianConsented: false,
    ...overrides,
  };
}

function minorInput(overrides: Partial<ConsentInput> = {}): ConsentInput {
  return {
    subjectName: 'Young Player',
    birthDate: {year: 2014, month: 8, day: 3},
    subjectConsented: true,
    guardianName: 'Parent Name',
    guardianRelationship: 'mother',
    guardianConsented: true,
    ...overrides,
  };
}

describe('buildConsentRecord', () => {
  it('accepts a consenting adult and needs no guardian', () => {
    const result = buildConsentRecord(adultInput(), AS_OF);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') {
      return;
    }
    expect(result.record.isMinor).toBe(false);
    expect(result.record.guardian).toBeNull();
    expect(result.record.ageYears).toBe(28);
    expect(result.record.dateOfBirth).toBe('1998-04-12');
    expect(result.record.purpose).toBe('research');
    expect(result.record.consentedAt).toBe(AS_OF.toISOString());
  });

  it('accepts a minor only with named, related, consenting guardian', () => {
    const result = buildConsentRecord(minorInput(), AS_OF);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') {
      return;
    }
    expect(result.record.isMinor).toBe(true);
    expect(result.record.guardian).toEqual({name: 'Parent Name', relationship: 'mother'});
  });

  it('rejects a minor with no guardian consent and lists every gap', () => {
    const result = buildConsentRecord(
      minorInput({guardianName: '', guardianRelationship: '', guardianConsented: false}),
      AS_OF,
    );
    expect(result.kind).toBe('invalid');
    if (result.kind !== 'invalid') {
      return;
    }
    expect(result.problems).toHaveLength(3);
  });

  it('rejects a minor whose guardian relationship is missing', () => {
    const result = buildConsentRecord(minorInput({guardianRelationship: '  '}), AS_OF);
    expect(result.kind).toBe('invalid');
    if (result.kind !== 'invalid') {
      return;
    }
    expect(result.problems).toHaveLength(1);
  });

  it('rejects a minor when the guardian has not consented', () => {
    const result = buildConsentRecord(minorInput({guardianConsented: false}), AS_OF);
    expect(result.kind).toBe('invalid');
    if (result.kind !== 'invalid') {
      return;
    }
    expect(result.problems).toHaveLength(1);
  });

  it('requires the player to consent even when the guardian does', () => {
    const result = buildConsentRecord(minorInput({subjectConsented: false}), AS_OF);
    expect(result).toMatchObject({kind: 'invalid'});
  });

  it('treats a Feb 29 birth as not-yet-18 on Feb 28 of the 18th year', () => {
    // Convention: a leap-day birthday "lands" on the real date, so the person is still a minor on
    // Feb 28 and turns 18 on Mar 1 in a non-leap year.
    const asOf = new Date(2026, 1, 28, 12, 0, 0); // 2026-02-28, a non-leap year
    const result = buildConsentRecord(minorInput({birthDate: {year: 2008, month: 2, day: 29}}), asOf);
    expect(result.kind === 'ok' && result.record.isMinor).toBe(true);
  });

  it('rejects when the subject has not consented', () => {
    const result = buildConsentRecord(adultInput({subjectConsented: false}), AS_OF);
    expect(result).toMatchObject({kind: 'invalid'});
  });

  it('rejects an empty player name', () => {
    const result = buildConsentRecord(adultInput({subjectName: '   '}), AS_OF);
    expect(result.kind).toBe('invalid');
  });

  it('rejects a non-existent calendar date', () => {
    const result = buildConsentRecord(adultInput({birthDate: {year: 2010, month: 2, day: 30}}), AS_OF);
    expect(result.kind).toBe('invalid');
  });

  it('rejects a future date of birth', () => {
    const result = buildConsentRecord(adultInput({birthDate: {year: 2030, month: 1, day: 1}}), AS_OF);
    expect(result.kind).toBe('invalid');
  });

  it('rejects an implausibly old date of birth (mistyped year)', () => {
    const result = buildConsentRecord(
      adultInput({birthDate: {year: AS_OF.getFullYear() - 121, month: 1, day: 1}}),
      AS_OF,
    );
    expect(result.kind).toBe('invalid');
  });

  it('treats exactly the threshold age as an adult', () => {
    const onBirthday = buildConsentRecord(
      adultInput({birthDate: {year: AS_OF.getFullYear() - MINOR_AGE_YEARS, month: 6, day: 27}}),
      AS_OF,
    );
    expect(onBirthday.kind === 'ok' && onBirthday.record.isMinor).toBe(false);
  });

  it('treats one day short of the threshold as a minor', () => {
    const dayBefore = buildConsentRecord(
      minorInput({birthDate: {year: AS_OF.getFullYear() - MINOR_AGE_YEARS, month: 6, day: 28}}),
      AS_OF,
    );
    expect(dayBefore.kind === 'ok' && dayBefore.record.isMinor).toBe(true);
  });
});

describe('birthDateToAge', () => {
  it('computes whole years for a valid past date', () => {
    expect(birthDateToAge({year: 2000, month: 1, day: 1}, AS_OF)).toBe(26);
  });

  it('returns null for an invalid or future date', () => {
    expect(birthDateToAge({year: 2010, month: 13, day: 1}, AS_OF)).toBeNull();
    expect(birthDateToAge({year: 2030, month: 1, day: 1}, AS_OF)).toBeNull();
  });
});
