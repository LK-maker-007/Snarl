import {useState} from 'react';
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Delivery} from './src/domain/pitchMap';
import {demoSource} from './src/ml/demoSource';
import {CalibrationScreen} from './src/screens/CalibrationScreen';
import {CaptureScreen} from './src/screens/CaptureScreen';
import {PitchMapScreen} from './src/screens/PitchMapScreen';
import {TrackerScreen} from './src/screens/TrackerScreen';

type Screen = 'home' | 'capture' | 'calibration' | 'pitchmap' | 'tracker';

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

  return (
    <View style={[styles.container, {paddingTop: insets.top, paddingBottom: insets.bottom}]}>
      {screen === 'home' ? (
        <HomeScreen onSelect={setScreen} />
      ) : (
        <View style={styles.screen}>
          <Pressable
            accessibilityRole="button"
            style={styles.back}
            onPress={() => setScreen('home')}>
            <Text style={styles.backText}>{'< Back'}</Text>
          </Pressable>
          <ActiveScreen screen={screen} />
        </View>
      )}
    </View>
  );
}

function ActiveScreen({screen}: {screen: Exclude<Screen, 'home'>}) {
  switch (screen) {
    case 'capture':
      return <CaptureScreen />;
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

function HomeScreen({onSelect}: {onSelect: (screen: Screen) => void}) {
  return (
    <View style={styles.home}>
      <Text style={styles.title}>Snarl</Text>
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
