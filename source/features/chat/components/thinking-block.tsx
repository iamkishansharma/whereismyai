import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';

import ShimmerText from '@/shared/ui/shimmer-text';
import MarkdownMessage from './markdown-message';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface ThinkingBlockProps {
  reasoning: string;
  /** Still arriving, so the label reads as present tense. */
  streaming?: boolean;
  /** The answer has begun, so the narration has served its purpose. */
  answerStarted?: boolean;
}

const DURATION = 200;
const EASING = Easing.out(Easing.cubic);

/**
 * A model's narration, kept out of the way.
 *
 * Always collapsed until someone asks for it: opening on its own moves the
 * answer down the screen just as it arrives, and nobody asked to read the
 * monologue. While the model is still thinking the label shimmers instead, so
 * the pause reads as work in progress rather than a hang.
 */
const ThinkingBlock = ({
  reasoning,
  streaming,
  answerStarted,
}: ThinkingBlockProps) => {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  const thinkingNow = Boolean(streaming && !answerStarted);

  const spin = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    spin.value = withTiming(open ? 1 : 0, {
      duration: DURATION,
      easing: EASING,
    });
  }, [open, spin]);

  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 180}deg` }],
  }));

  if (!reasoning) {
    return null;
  }

  return (
    <Animated.View layout={LinearTransition.duration(DURATION).easing(EASING)}>
      <Pressable
        onPress={() => setOpen(value => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Hide reasoning' : 'Show reasoning'}
        style={styles.header}
        hitSlop={8}
      >
        <Icon source="brain" size={14} color={colors.onSurfaceVariant} />
        {thinkingNow ? (
          <ShimmerText>Thinking…</ShimmerText>
        ) : (
          <Text
            variant="labelMedium"
            style={{ color: colors.onSurfaceVariant }}
          >
            Reasoning
          </Text>
        )}
        <Animated.View style={chevron}>
          <Icon
            source="chevron-down"
            size={16}
            color={colors.onSurfaceVariant}
          />
        </Animated.View>
      </Pressable>

      {open && (
        <Animated.View
          entering={FadeIn.duration(DURATION)}
          exiting={FadeOut.duration(DURATION / 2)}
          style={[styles.body, { borderLeftColor: colors.outlineVariant }]}
        >
          {/* Models format their narration too — numbered steps, bold labels.
              Rendering it raw showed the asterisks. */}
          <MarkdownMessage markdown={reasoning} streaming={streaming} muted />
        </Animated.View>
      )}

      <View style={styles.spacer} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  body: {
    marginTop: 6,
    paddingLeft: 12,
    borderLeftWidth: 2,
  },
  spacer: {
    height: 14,
  },
});

export default ThinkingBlock;
