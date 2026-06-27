import {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {CapturedClip, FrameSource} from '../camera/FrameSource';
import {CAPTURE_SPEC, FRAMING_CHECKLIST, checkSettings} from '../domain/captureSpec';

interface CaptureScreenProps {
  source?: FrameSource;
  onClipCaptured?: (clip: CapturedClip) => void;
  // Default fail-closed: filming is blocked until a consent record exists (ADR-0008, gate zero).
  consented?: boolean;
  onNeedConsent?: () => void;
}

export function CaptureScreen({
  source,
  onClipCaptured,
  consented = false,
  onNeedConsent,
}: CaptureScreenProps) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  if (!consented) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Record a delivery</Text>
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            Consent is required before filming anyone. Capture the player&apos;s consent (and a
            parent or guardian&apos;s, for a minor) first.
          </Text>
        </View>
        <Pressable accessibilityRole="button" style={styles.button} onPress={onNeedConsent}>
          <Text style={styles.buttonText}>Get consent</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const settingsCheck = source ? checkSettings(source.settings) : undefined;
  const shutterCeiling = Math.round(1 / CAPTURE_SPEC.maxShutterSeconds);

  const toggleRecording = async () => {
    if (!source) {
      return;
    }
    if (recording) {
      const clip = await source.stop();
      setRecording(false);
      onClipCaptured?.(clip);
    } else {
      setError(undefined);
      await source.start();
      setRecording(true);
    }
  };

  const handleRecordPress = () => {
    toggleRecording().catch(caught => {
      setError(caught instanceof Error ? caught.message : 'capture failed');
      setRecording(false);
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Record a delivery</Text>
      <Text style={styles.note}>
        Capture to spec, then process the clip afterwards. Never run the tracker while recording.
      </Text>

      <Text style={styles.sectionTitle}>Camera must meet</Text>
      <Text style={styles.item}>
        {`Frame rate at least ${CAPTURE_SPEC.minFps} fps (prefer ${CAPTURE_SPEC.preferredFps})`}
      </Text>
      <Text style={styles.item}>{`Shutter no slower than 1/${shutterCeiling} s`}</Text>
      <Text style={styles.item}>
        {`Resolution at least ${CAPTURE_SPEC.minResolutionHeight}p (prefer ${CAPTURE_SPEC.preferredResolutionHeight}p)`}
      </Text>

      <Text style={styles.sectionTitle}>Before you record</Text>
      {FRAMING_CHECKLIST.map(rule => (
        <Text key={rule} style={styles.item}>
          {`• ${rule}`}
        </Text>
      ))}

      {settingsCheck && !settingsCheck.ok ? (
        <View style={styles.warning}>
          {settingsCheck.failures.map(failure => (
            <Text key={failure} style={styles.warningText}>
              {failure}
            </Text>
          ))}
        </View>
      ) : null}

      {source ? (
        <Pressable
          accessibilityRole="button"
          style={[styles.button, recording ? styles.buttonRecording : null]}
          onPress={handleRecordPress}>
          <Text style={styles.buttonText}>{recording ? 'Stop' : 'Record'}</Text>
        </Pressable>
      ) : (
        <Text style={styles.unavailable}>
          Camera is not available in this build. Film with a 120 fps+ camera app and import the
          clip for processing.
        </Text>
      )}

      {error ? <Text style={styles.warningText}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 6,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 4,
  },
  note: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  item: {
    fontSize: 14,
    lineHeight: 20,
  },
  warning: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#3a1d1d',
  },
  warningText: {
    color: '#ff9b9b',
    fontSize: 13,
  },
  button: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#1d6f3a',
  },
  buttonRecording: {
    backgroundColor: '#8a1f1f',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  unavailable: {
    marginTop: 24,
    fontSize: 14,
    opacity: 0.7,
  },
});
