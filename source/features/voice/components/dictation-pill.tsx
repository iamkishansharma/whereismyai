import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { DictationState } from '../use-dictation';

/**
 * The "we are listening" strip above the composer input.
 *
 * Bars react to the microphone rather than looping on their own, so silence
 * looks like silence — which is the fastest way to notice a dead mic or a
 * muted headset before talking through a whole sentence.
 */

const BARS = [0, 1, 2, 3, 4];
const BAR_MIN = 3;
const BAR_MAX = 18;
// Each bar reaches a different fraction of the level so the group reads as a
// waveform instead of five identical bars moving as one.
const BAR_WEIGHTS = [0.55, 0.85, 1, 0.8, 0.5];

const Bar = ({ index, level }: { index: number; level: number }) => {
  const { colors } = useTheme();
  const height = useSharedValue(BAR_MIN);

  useEffect(() => {
    height.value = withTiming(
      BAR_MIN + (BAR_MAX - BAR_MIN) * level * BAR_WEIGHTS[index],
      { duration: 110 },
    );
  }, [height, index, level]);

  const style = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View
      style={[style, styles.bar, { backgroundColor: colors.primary }]}
    />
  );
};

const Starting = () => {
  const { colors } = useTheme();
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 520 }),
        withTiming(0.4, { duration: 520 }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[style, styles.dot, { backgroundColor: colors.primary }]}
    />
  );
};

interface DictationPillProps {
  state: DictationState;
  level: number;
  error?: string;
}

const DictationPill = ({ state, level, error }: DictationPillProps) => {
  const { colors } = useTheme();

  if (state === 'idle') {
    return null;
  }

  const failed = state === 'error';

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityLabel={
        failed ? `Dictation failed. ${error ?? ''}` : 'Listening'
      }
      style={[
        styles.container,
        {
          backgroundColor: failed
            ? colors.errorContainer
            : colors.secondaryContainer,
        },
      ]}
    >
      {failed ? null : state === 'starting' ? (
        <Starting />
      ) : (
        <View style={styles.bars}>
          {BARS.map(index => (
            <Bar key={index} index={index} level={level} />
          ))}
        </View>
      )}

      <Text
        variant="labelMedium"
        numberOfLines={2}
        style={{
          color: failed ? colors.onErrorContainer : colors.onSecondaryContainer,
          flex: 1,
        }}
      >
        {failed
          ? error ?? 'Could not hear you'
          : state === 'starting'
          ? 'Getting ready…'
          : 'Listening — tap the stop button when you are done'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: BAR_MAX,
    width: 34,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

export default DictationPill;
