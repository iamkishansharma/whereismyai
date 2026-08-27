import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const DOTS = [0, 1, 2];
const DOT_SIZE = 7;
const PULSE_MS = 420;

const Dot = ({ index }: { index: number }) => {
  const { colors } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * (PULSE_MS / 2),
      withRepeat(
        withSequence(
          withTiming(1, { duration: PULSE_MS }),
          withTiming(0, { duration: PULSE_MS }),
        ),
        -1,
        false,
      ),
    );
  }, [index, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.3 + progress.value * 0.7,
    transform: [{ scale: 0.8 + progress.value * 0.2 }],
  }));

  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: colors.onSurfaceVariant }, style]}
    />
  );
};

const TypingIndicator = () => (
  <View
    style={styles.row}
    accessibilityRole="progressbar"
    accessibilityLabel="Assistant is replying"
  >
    {DOTS.map(index => (
      <Dot key={index} index={index} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});

export default TypingIndicator;
