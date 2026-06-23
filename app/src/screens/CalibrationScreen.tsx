import {useEffect, useMemo, useState} from 'react';
import {GestureResponderEvent, Pressable, StyleSheet, Text, View} from 'react-native';
import {Correspondence, Homography, meanResidual, solveHomography} from '../domain/calibration';
import {
  CALIBRATION_SEQUENCE,
  Point,
  REFERENCE_LABELS,
  REFERENCE_POINTS,
} from '../domain/cricket';

interface CalibrationScreenProps {
  onCalibrated?: (homography: Homography) => void;
}

type CalibrationResult =
  | {kind: 'ok'; residualMeters: number; homography: Homography}
  | {kind: 'error'; message: string};

const MARK_RADIUS = 8;

export function CalibrationScreen({onCalibrated}: CalibrationScreenProps) {
  const [marks, setMarks] = useState<readonly Point[]>([]);

  const result = useMemo<CalibrationResult | undefined>(() => {
    const correspondences = buildCorrespondences(marks);
    if (!correspondences) {
      return undefined;
    }
    try {
      const homography = solveHomography(correspondences);
      return {kind: 'ok', residualMeters: meanResidual(homography, correspondences), homography};
    } catch (caught) {
      return {kind: 'error', message: caught instanceof Error ? caught.message : 'calibration failed'};
    }
  }, [marks]);

  useEffect(() => {
    if (result?.kind === 'ok') {
      onCalibrated?.(result.homography);
    }
  }, [result, onCalibrated]);

  const done = marks.length >= CALIBRATION_SEQUENCE.length;

  const handleTap = (event: GestureResponderEvent) => {
    if (done) {
      return;
    }
    const {locationX, locationY} = event.nativeEvent;
    setMarks(current => [...current, {x: locationX, y: locationY}]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Calibrate the pitch</Text>
      <Text style={styles.note}>
        {done
          ? 'All points marked. Reset and re-mark if the creases shift.'
          : `Tap the ${nextReferenceLabel(marks.length)}.`}
      </Text>

      <Pressable style={styles.surface} onPress={handleTap}>
        {marks.map((mark, index) => (
          <View
            key={`${mark.x}:${mark.y}:${index}`}
            style={[styles.mark, {left: mark.x - MARK_RADIUS, top: mark.y - MARK_RADIUS}]}
          />
        ))}
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.progress}>
          {`${marks.length} / ${CALIBRATION_SEQUENCE.length} points`}
        </Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setMarks([])}>
          <Text style={styles.buttonText}>Reset</Text>
        </Pressable>
      </View>

      {result ? <Text style={styles.result}>{describeResult(result)}</Text> : null}
    </View>
  );
}

function buildCorrespondences(marks: readonly Point[]): Correspondence[] | undefined {
  const correspondences: Correspondence[] = [];
  for (let index = 0; index < CALIBRATION_SEQUENCE.length; index++) {
    const image = marks[index];
    const id = CALIBRATION_SEQUENCE[index];
    if (image === undefined || id === undefined) {
      return undefined;
    }
    correspondences.push({image, world: REFERENCE_POINTS[id]});
  }
  return correspondences;
}

function nextReferenceLabel(markCount: number): string {
  const id = CALIBRATION_SEQUENCE[markCount];
  return id ? REFERENCE_LABELS[id] : 'next point';
}

function describeResult(result: CalibrationResult): string {
  if (result.kind === 'error') {
    return result.message;
  }
  return `Calibrated. Mean error ${(result.residualMeters * 100).toFixed(1)} cm.`;
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
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
    marginBottom: 12,
  },
  surface: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#888',
    backgroundColor: '#11161c',
  },
  mark: {
    position: 'absolute',
    width: MARK_RADIUS * 2,
    height: MARK_RADIUS * 2,
    borderRadius: MARK_RADIUS,
    borderWidth: 2,
    borderColor: '#ffd166',
    backgroundColor: 'rgba(255, 209, 102, 0.3)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  progress: {
    fontSize: 14,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#2a3340',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  result: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
  },
});
