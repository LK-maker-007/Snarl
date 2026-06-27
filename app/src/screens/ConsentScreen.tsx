import {useMemo, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  birthDateToAge,
  buildConsentRecord,
  ConsentRecord,
  MINOR_AGE_YEARS,
} from '../domain/consent';

interface ConsentScreenProps {
  onConsent: (record: ConsentRecord) => void;
  // Injectable "now" so the age hint and the recorded consent share one instant and tests are
  // deterministic; defaults to the real clock in the app.
  asOf?: Date;
}

// Empty field -> NaN so the domain rejects it rather than coercing '' to 0.
function toNumber(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text);
}

export function ConsentScreen({onConsent, asOf}: ConsentScreenProps) {
  const [subjectName, setSubjectName] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [subjectConsented, setSubjectConsented] = useState(false);
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('');
  const [guardianConsented, setGuardianConsented] = useState(false);
  const [problems, setProblems] = useState<readonly string[]>([]);

  // One instant for the whole form so the age hint and the recorded consent never disagree.
  const referenceDate = useMemo(() => asOf ?? new Date(), [asOf]);

  const birthDate = useMemo(
    () => ({year: toNumber(year), month: toNumber(month), day: toNumber(day)}),
    [year, month, day],
  );

  // Live age, only to decide whether to ask for guardian consent; the record is built on submit.
  const age = useMemo(() => birthDateToAge(birthDate, referenceDate), [birthDate, referenceDate]);
  const isMinor = age !== null && age < MINOR_AGE_YEARS;

  const handleSubmit = () => {
    const result = buildConsentRecord(
      {
        subjectName,
        birthDate,
        subjectConsented,
        guardianName,
        guardianRelationship,
        guardianConsented,
      },
      referenceDate,
    );
    if (result.kind === 'ok') {
      setProblems([]);
      onConsent(result.record);
    } else {
      setProblems(result.problems);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Consent &amp; age-gate</Text>
      <Text style={styles.note}>
        Required before filming anyone. Footage is used only for research; nobody is recorded
        without consent, and a minor needs a parent or guardian to consent too.
      </Text>

      <Text style={styles.label}>Player name</Text>
      <TextInput
        style={styles.input}
        value={subjectName}
        onChangeText={setSubjectName}
        placeholder="Full name"
        autoCapitalize="words"
        maxLength={80}
      />

      <Text style={styles.label}>Date of birth</Text>
      <View style={styles.dateRow}>
        <TextInput
          style={[styles.input, styles.dateField]}
          value={day}
          onChangeText={setDay}
          placeholder="DD"
          keyboardType="number-pad"
          maxLength={2}
        />
        <TextInput
          style={[styles.input, styles.dateField]}
          value={month}
          onChangeText={setMonth}
          placeholder="MM"
          keyboardType="number-pad"
          maxLength={2}
        />
        <TextInput
          style={[styles.input, styles.dateYear]}
          value={year}
          onChangeText={setYear}
          placeholder="YYYY"
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>
      {age !== null ? (
        <Text style={styles.age}>{`Age ${age} — ${isMinor ? 'minor' : 'adult'}`}</Text>
      ) : null}

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>The player consents to being filmed for research.</Text>
        <Switch value={subjectConsented} onValueChange={setSubjectConsented} />
      </View>

      {isMinor ? (
        <View style={styles.guardian}>
          <Text style={styles.subheading}>Parent or guardian consent</Text>
          <Text style={styles.label}>Guardian name</Text>
          <TextInput
            style={styles.input}
            value={guardianName}
            onChangeText={setGuardianName}
            placeholder="Full name"
            autoCapitalize="words"
          />
          <Text style={styles.label}>Relationship to the player</Text>
          <TextInput
            style={styles.input}
            value={guardianRelationship}
            onChangeText={setGuardianRelationship}
            placeholder="e.g. parent, legal guardian"
            autoCapitalize="none"
          />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              The parent or guardian consents to the minor being filmed for research.
            </Text>
            <Switch value={guardianConsented} onValueChange={setGuardianConsented} />
          </View>
        </View>
      ) : null}

      {problems.length > 0 ? (
        <View style={styles.problems}>
          {problems.map(problem => (
            <Text key={problem} style={styles.problem}>
              {`• ${problem}`}
            </Text>
          ))}
        </View>
      ) : null}

      <Pressable accessibilityRole="button" style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Record consent</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    gap: 4,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
  },
  subheading: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  note: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginTop: 6,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateField: {
    width: 64,
    textAlign: 'center',
  },
  dateYear: {
    width: 96,
    textAlign: 'center',
  },
  age: {
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  switchLabel: {
    flex: 1,
    fontSize: 14,
  },
  guardian: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  problems: {
    marginTop: 16,
    gap: 4,
  },
  problem: {
    color: '#e63946',
    fontSize: 14,
  },
  button: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 10,
    backgroundColor: '#1d6f3a',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
