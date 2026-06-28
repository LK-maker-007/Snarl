import {useEffect, useState} from 'react';
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {CapturedClip} from './src/camera/FrameSource';
import {ConsentRecord} from './src/domain/consent';
import {ConsentStore, formatConsentId} from './src/domain/consentLog';
import {Delivery} from './src/domain/pitchMap';
import {createEncryptedConsentStore} from './src/infra/encryptedConsentStore';
import {log} from './src/infra/log';
import {demoSource} from './src/ml/demoSource';
import {CalibrationScreen} from './src/screens/CalibrationScreen';
import {CaptureScreen} from './src/screens/CaptureScreen';
import {ConsentScreen} from './src/screens/ConsentScreen';
import {PitchMapScreen} from './src/screens/PitchMapScreen';
import {TrackerScreen} from './src/screens/TrackerScreen';

type Screen = 'home' | 'consent' | 'capture' | 'calibration' | 'pitchmap' | 'tracker';

// Placeholder until the tracker feeds real bounce points; lets the map be seen and laid out.
const SAMPLE_DELIVERIES: readonly Delivery[] = [
  {id: '1', bounce: {x: 0.02, y: 4.5}, handedness: 'right'},
  {id: '2', bounce: {x: 0.16, y: 5.3}, handedness: 'right'},
  {id: '3', bounce: {x: -0.04, y: 2.2}, handedness: 'right'},
  {id: '4', bounce: {x: 0.27, y: 7.4}, handedness: 'right'},
  {id: '5', bounce: {x: 0.05, y: 0.6}, handedness: 'right'},
  {id: '6', bounce: {x: -0.22, y: 9.6}, handedness: 'right'},
];

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Screen>('home');
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [store, setStore] = useState<ConsentStore | null>(null);
  const [activeConsentId, setActiveConsentId] = useState<string | null>(null);

  useEffect(() => {
    createEncryptedConsentStore()
      .then(setStore)
      .catch((reason: unknown) => log.error('consent store init failed', {reason: String(reason)}));
  }, []);

  const handleConsent = (record: ConsentRecord) => {
    const consentId = formatConsentId(Date.now(), Math.random().toString(36).slice(2, 10) || '0');
    if (store === null) {
      log.warn('consent not persisted — store still initializing');
    } else {
      store.saveConsent({consentId, record});
    }
    setConsent(record);
    setActiveConsentId(consentId);
    setScreen('home');
  };

  // Persist each recorded clip linked to the active consent (ADR-0008). Routing it into the tracker
  // comes with the frame-extraction step (the clip is a video file; the tracker consumes frames).
  const handleClipCaptured = (clip: CapturedClip) => {
    if (store === null || activeConsentId === null) {
      log.warn('clip not linked', {hasStore: store !== null, hasConsent: activeConsentId !== null});
      return;
    }
    store.saveClip({
      clipUri: clip.uri,
      fps: clip.fps,
      consentId: activeConsentId,
      capturedAt: new Date().toISOString(),
    });
    log.info('clip captured', {fps: clip.fps});
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top, paddingBottom: insets.bottom}]}>
      {screen === 'home' ? (
        <HomeScreen onSelect={setScreen} consent={consent} />
      ) : (
        <View style={styles.screen}>
          <Pressable
            accessibilityRole="button"
            style={styles.back}
            onPress={() => setScreen('home')}>
            <Text style={styles.backText}>{'< Back'}</Text>
          </Pressable>
          <ActiveScreen
            screen={screen}
            consent={consent}
            onConsent={handleConsent}
            onNeedConsent={() => setScreen('consent')}
            onClipCaptured={handleClipCaptured}
          />
        </View>
      )}
    </View>
  );
}

interface ActiveScreenProps {
  screen: Exclude<Screen, 'home'>;
  consent: ConsentRecord | null;
  onConsent: (record: ConsentRecord) => void;
  onNeedConsent: () => void;
  onClipCaptured: (clip: CapturedClip) => void;
}

function ActiveScreen({
  screen,
  consent,
  onConsent,
  onNeedConsent,
  onClipCaptured,
}: ActiveScreenProps) {
  switch (screen) {
    case 'consent':
      return <ConsentScreen onConsent={onConsent} />;
    case 'capture':
      return (
        <CaptureScreen
          consented={consent !== null}
          onNeedConsent={onNeedConsent}
          onClipCaptured={onClipCaptured}
        />
      );
    case 'calibration':
      return <CalibrationScreen />;
    case 'pitchmap':
      return (
        <PitchMapScreen
          deliveries={SAMPLE_DELIVERIES}
          note="Sample deliveries — real bounces appear once tracking is wired."
        />
      );
    case 'tracker':
      return <TrackerScreen source={demoSource} />;
  }
}

function HomeScreen({
  onSelect,
  consent,
}: {
  onSelect: (screen: Screen) => void;
  consent: ConsentRecord | null;
}) {
  return (
    <View style={styles.home}>
      <Text style={styles.title}>Snarl</Text>
      <Pressable
        accessibilityRole="button"
        style={styles.tile}
        onPress={() => onSelect('consent')}>
        <Text style={styles.tileText}>
          {consent === null ? 'Consent & age-gate' : `Consent recorded — ${consent.subjectName}`}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        style={styles.tile}
        onPress={() => onSelect('capture')}>
        <Text style={styles.tileText}>Record a delivery</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        style={styles.tile}
        onPress={() => onSelect('calibration')}>
        <Text style={styles.tileText}>Calibrate the pitch</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        style={styles.tile}
        onPress={() => onSelect('pitchmap')}>
        <Text style={styles.tileText}>Pitch map</Text>
      </Pressable>
      {demoSource.frames.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          style={styles.tile}
          onPress={() => onSelect('tracker')}>
          <Text style={styles.tileText}>Ball tracker (demo)</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  back: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backText: {
    fontSize: 16,
  },
  home: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 12,
  },
  tile: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#1d6f3a',
  },
  tileText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default App;
