import {useCallback, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  useVideoOutput,
} from 'react-native-vision-camera';
import {CapturedClip, FrameSource} from '../camera/FrameSource';
import {createCameraRecorderSource} from '../camera/cameraRecorderSource';
import {CAPTURE_SPEC, CameraSettings, FRAMING_CHECKLIST, checkSettings} from '../domain/captureSpec';
import {log} from '../infra/log';

interface CaptureScreenProps {
  // Default fail-closed: filming is blocked until a consent record exists (ADR-0008, gate zero).
  consented?: boolean;
  onNeedConsent?: () => void;
  onClipCaptured?: (clip: CapturedClip) => void;
}

// 720p capture target; the tracker downscales to its own input size when frames are extracted. The
// shorter dimension is the conventional "p" resolution the capture spec gates on.
const TARGET_RESOLUTION = CommonResolutions.HD_16_9;
const TARGET_HEIGHT = Math.min(TARGET_RESOLUTION.width, TARGET_RESOLUTION.height);

export function CaptureScreen({
  consented = false,
  onNeedConsent,
  onClipCaptured,
}: CaptureScreenProps) {
  const {hasPermission, requestPermission} = useCameraPermission();
  const device = useCameraDevice('back');
  const videoOutput = useVideoOutput({targetResolution: TARGET_RESOLUTION, enableAudio: false});

  // The camera reports the frame rate it actually configured; until then, assume the requested rate.
  const [fps, setFps] = useState<number>(CAPTURE_SPEC.preferredFps);
  const [source, setSource] = useState<FrameSource | null>(null);
  const [lastClip, setLastClip] = useState<CapturedClip | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settings: CameraSettings = useMemo(
    () => ({fps, shutterSeconds: CAPTURE_SPEC.maxShutterSeconds, resolutionHeight: TARGET_HEIGHT}),
    [fps],
  );

  const beginRecording = useCallback(async () => {
    setError(null);
    setLastClip(null);
    const recorder = await videoOutput.createRecorder({});
    const next = createCameraRecorderSource(recorder, settings, fps);
    await next.start();
    setSource(next);
  }, [videoOutput, settings, fps]);

  const endRecording = useCallback(
    async (active: FrameSource) => {
      const clip = await active.stop();
      setSource(null);
      setLastClip(clip);
      onClipCaptured?.(clip);
    },
    [onClipCaptured],
  );

  const handleRecordPress = () => {
    const action = source === null ? beginRecording() : endRecording(source);
    action.catch((caught: unknown) => {
      log.error('capture failed', {reason: String(caught)});
      setError(caught instanceof Error ? caught.message : 'capture failed');
      setSource(null);
    });
  };

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

  if (!hasPermission) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Record a delivery</Text>
        <Text style={styles.note}>The camera needs permission before it can record.</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => {
            requestPermission().catch((caught: unknown) => {
              setError(caught instanceof Error ? caught.message : 'permission request failed');
            });
          }}>
          <Text style={styles.buttonText}>Grant camera access</Text>
        </Pressable>
        {error ? <Text style={styles.warningText}>{error}</Text> : null}
      </ScrollView>
    );
  }

  if (device === undefined) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Record a delivery</Text>
        <Text style={styles.note}>No back camera is available on this device.</Text>
      </ScrollView>
    );
  }

  const recording = source !== null;
  const settingsCheck = checkSettings(settings);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Record a delivery</Text>
      <Text style={styles.note}>
        Capture to spec, then process the clip afterwards. The tracker never runs while recording.
      </Text>

      <Camera
        style={styles.preview}
        device={device}
        isActive={true}
        outputs={[videoOutput]}
        constraints={[{fps: CAPTURE_SPEC.preferredFps}]}
        onSessionConfigSelected={config => {
          if (config.selectedFPS !== undefined) {
            setFps(config.selectedFPS);
          }
        }}
      />

      <Text style={styles.status}>{`Recording at ${fps} fps · ${TARGET_HEIGHT}p`}</Text>
      {!settingsCheck.ok ? (
        <View style={styles.warning}>
          {settingsCheck.failures.map(failure => (
            <Text key={failure} style={styles.warningText}>
              {failure}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Before you record</Text>
      {FRAMING_CHECKLIST.map(rule => (
        <Text key={rule} style={styles.item}>
          {`• ${rule}`}
        </Text>
      ))}

      <Pressable
        accessibilityRole="button"
        style={[styles.button, recording ? styles.buttonRecording : null]}
        onPress={handleRecordPress}>
        <Text style={styles.buttonText}>{recording ? 'Stop' : 'Record'}</Text>
      </Pressable>

      {lastClip ? (
        <Text style={styles.status}>{`Recorded: ${lastClip.uri}`}</Text>
      ) : null}
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
  preview: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
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
    marginTop: 12,
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
});
