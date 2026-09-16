import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';

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
 * It opens by itself while the model is still thinking — on a slow phone that
 * pause is otherwise dead air that reads as a hang — and folds away once the
 * answer starts, because by then it is a footnote. Touching it at any point
 * takes that decision away from us for the rest of the message.
 */
const ThinkingBlock = ({
  reasoning,
  streaming,
  answerStarted,
}: ThinkingBlockProps) => {
  const { colors } = useTheme();
  const [choice, setChoice] = useState<boolean>();

  const thinkingNow = Boolean(streaming && !answerStarted);
  const open = choice ?? thinkingNow;

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
        onPress={() => setChoice(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Hide reasoning' : 'Show reasoning'}
        style={styles.header}
        hitSlop={8}
      >
        <Icon source="brain" size={14} color={colors.onSurfaceVariant} />
        <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>
          {thinkingNow ? 'Thinking…' : 'Reasoning'}
        </Text>
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
