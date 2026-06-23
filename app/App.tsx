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
import {CalibrationScreen} from './src/screens/CalibrationScreen';
import {CaptureScreen} from './src/screens/CaptureScreen';

type Screen = 'home' | 'capture' | 'calibration';

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
          {screen === 'capture' ? <CaptureScreen /> : <CalibrationScreen />}
        </View>
      )}
    </View>
  );
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
