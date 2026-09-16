import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';

interface ThinkingBlockProps {
  reasoning: string;
  /** Still arriving, so the label reads as present tense. */
  streaming?: boolean;
}

/**
 * A model's narration, kept out of the way. Collapsed by default because it is
 * a footnote to the answer rather than part of it — but shown at all, because
 * on a slow phone a long silent pause with nothing on screen reads as a hang.
 */
const ThinkingBlock = ({ reasoning, streaming }: ThinkingBlockProps) => {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  if (!reasoning) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen(value => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Hide reasoning' : 'Show reasoning'}
        style={styles.header}
        hitSlop={8}
      >
        <Icon source="brain" size={14} color={colors.onSurfaceVariant} />
        <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>
          {streaming ? 'Thinking…' : 'Thought process'}
        </Text>
        <Icon
          source={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.onSurfaceVariant}
        />
      </Pressable>

      {open && (
        <View style={[styles.body, { borderLeftColor: colors.outlineVariant }]}>
          <Text
            variant="bodySmall"
            style={{ color: colors.onSurfaceVariant }}
            selectable
          >
            {reasoning}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 8,
  },
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
});

export default ThinkingBlock;
