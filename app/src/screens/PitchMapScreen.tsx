import {useState} from 'react';
import {LayoutChangeEvent, StyleSheet, Text, View} from 'react-native';
import {
  LENGTH_BOUNDS,
  LENGTH_ZONES,
  LENGTH_ZONE_LABELS,
  LengthZone,
  classifyDelivery,
} from '../domain/lineLength';
import {Delivery, summarizeDeliveries, toDiagramPosition} from '../domain/pitchMap';

interface PitchMapScreenProps {
  deliveries: readonly Delivery[];
  note?: string;
}

const DOT_RADIUS = 6;

const LENGTH_COLORS: Record<LengthZone, string> = {
  yorker: '#f4a261',
  full: '#e9c46a',
  good: '#2a9d8f',
  backOfLength: '#577590',
  short: '#e76f51',
};

export function PitchMapScreen({deliveries, note}: PitchMapScreenProps) {
  const [size, setSize] = useState({width: 0, height: 0});
  const summary = summarizeDeliveries(deliveries);

  const onLayout = (event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    setSize({width, height});
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Pitch map</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}

      <View style={styles.pitch} onLayout={onLayout}>
        <View style={[styles.goodBand, goodLengthBand(size.height)]} />
        <View style={[styles.stumpLine, {top: stumpLineTop(size.height)}]} />
        {deliveries.map(delivery => {
          const position = toDiagramPosition(delivery.bounce);
          const zone = classifyDelivery(delivery.bounce, delivery.handedness).length;
          return (
            <View
              key={delivery.id}
              style={[
                styles.dot,
                {
                  backgroundColor: LENGTH_COLORS[zone],
                  left: position.x * size.width - DOT_RADIUS,
                  top: (1 - position.y) * size.height - DOT_RADIUS,
                },
              ]}
            />
          );
        })}
      </View>

      {deliveries.length === 0 ? (
        <Text style={styles.empty}>No deliveries yet. Tracked bounces will appear here.</Text>
      ) : null}

      <View style={styles.legend}>
        {LENGTH_ZONES.map(zone => (
          <View key={zone} style={styles.legendRow}>
            <View style={[styles.swatch, {backgroundColor: LENGTH_COLORS[zone]}]} />
            <Text style={styles.legendText}>
              {`${LENGTH_ZONE_LABELS[zone]} — ${summary.byLength[zone]}`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function stumpLineTop(height: number): number {
  return (1 - toDiagramPosition({x: 0, y: 0}).y) * height;
}

function goodLengthBand(height: number): {top: number; height: number} {
  const top = toDiagramPosition({x: 0, y: LENGTH_BOUNDS.good}).y;
  const bottom = toDiagramPosition({x: 0, y: LENGTH_BOUNDS.full}).y;
  return {top: (1 - top) * height, height: (top - bottom) * height};
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
  pitch: {
    flex: 1,
    marginTop: 12,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#3f7d4e',
  },
  goodBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  stumpLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#f1faee',
  },
  dot: {
    position: 'absolute',
    width: DOT_RADIUS * 2,
    height: DOT_RADIUS * 2,
    borderRadius: DOT_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.4)',
  },
  empty: {
    marginTop: 12,
    fontSize: 14,
    opacity: 0.7,
  },
  legend: {
    marginTop: 16,
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 14,
  },
});
