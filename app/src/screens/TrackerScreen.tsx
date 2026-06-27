import {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {TrackerSource} from '../domain/clip';
import {Point} from '../domain/cricket';
import {log} from '../infra/log';
import {analyzeClip} from '../ml/analyzeClip';

type Status = 'analyzing' | 'playing' | 'error';

const DOT_RADIUS = 7;

// Playback rate for the frame sequence. Kept below the capture fps because each frame is a base64
// data URI that the image view must decode on every swap; at full capture speed the decode cannot
// keep up and frames blank out. This rate is for viewing only and does not affect tracking.
const PLAYBACK_FPS = 12;

export function TrackerScreen({source}: {source: TrackerSource}) {
  const [status, setStatus] = useState<Status>('analyzing');
  const [track, setTrack] = useState<readonly (Point | null)[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [layoutWidth, setLayoutWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const analyze = async (): Promise<void> => {
      const refined = await analyzeClip(source);
      if (!cancelled) {
        setTrack(refined);
        setStatus('playing');
      }
    };

    analyze().catch((reason: unknown) => {
      if (!cancelled) {
        log.error('tracking failed', {reason: String(reason)});
        setErrorMessage(String(reason));
        setStatus('error');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    if (status !== 'playing' || source.frames.length === 0) {
      return undefined;
    }
    const period = Math.max(1, Math.round(1000 / PLAYBACK_FPS));
    const interval = setInterval(() => {
      setFrameIndex(current => (current + 1) % source.frames.length);
    }, period);
    return () => clearInterval(interval);
  }, [status, source.frames.length]);

  const onLayout = (event: LayoutChangeEvent) => {
    setLayoutWidth(event.nativeEvent.layout.width);
  };

  const scale = layoutWidth > 0 ? layoutWidth / source.width : 0;
  const currentFrame = source.frames[frameIndex];
  const currentPoint = track[frameIndex] ?? null;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Ball tracker</Text>
      <Text style={styles.note}>
        On-device tracking of a sample rally. The dot is the model's per-frame ball position.
      </Text>

      <View
        style={[styles.stage, {aspectRatio: source.width / source.height}]}
        onLayout={onLayout}>
        {currentFrame === undefined ? null : (
          <Image
            style={styles.frame}
            resizeMode="contain"
            fadeDuration={0}
            source={{uri: `data:image/jpeg;base64,${currentFrame}`}}
          />
        )}
        {status === 'playing' && currentPoint !== null && scale > 0 ? (
          <View
            style={[
              styles.dot,
              {
                left: currentPoint.x * scale - DOT_RADIUS,
                top: currentPoint.y * scale - DOT_RADIUS,
              },
            ]}
          />
        ) : null}
        {status === 'analyzing' ? (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.overlayText}>Analyzing {source.frames.length} frames…</Text>
          </View>
        ) : null}
      </View>

      {status === 'error' ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {status === 'playing' ? (
        <Text style={styles.caption}>
          {`frame ${frameIndex + 1} / ${source.frames.length}`}
          {currentPoint === null ? ' · ball not detected' : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
  },
  note: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 4,
  },
  stage: {
    marginTop: 12,
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  frame: {
    width: '100%',
    height: '100%',
  },
  dot: {
    position: 'absolute',
    width: DOT_RADIUS * 2,
    height: DOT_RADIUS * 2,
    borderRadius: DOT_RADIUS,
    backgroundColor: '#ffd166',
    borderWidth: 2,
    borderColor: '#e63946',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  overlayText: {
    color: '#ffffff',
    fontSize: 14,
  },
  error: {
    marginTop: 12,
    fontSize: 13,
    color: '#e63946',
  },
  caption: {
    marginTop: 12,
    fontSize: 14,
    opacity: 0.8,
  },
});
