import { StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { GenerationStats } from '@/types';

/**
 * What the reply cost, shown quietly beside the message actions.
 *
 * On-device speed is the thing a user is really judging — whether a model
 * earns the gigabyte it occupies is a question of tokens per second on their
 * phone, which no spec sheet can answer. Kept to one muted line: useful when
 * looked for, ignorable when not.
 */

/** Seconds below a minute, then minutes — nobody reads "142.8s". */
function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 1) {
    return `${Math.round(ms)}ms`;
  }
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

export function describeStats(stats: GenerationStats): string {
  const parts = [`${stats.tokensPredicted} tokens`];

  if (stats.tokensPerSecond > 0) {
    parts.push(`${stats.tokensPerSecond.toFixed(1)} tok/s`);
  }
  if (stats.totalMs > 0) {
    parts.push(formatDuration(stats.totalMs));
  }

  return parts.join(' · ');
}

const MessageStats = ({ stats }: { stats: GenerationStats }) => {
  const { colors } = useTheme();

  return (
    <Text
      variant="labelSmall"
      style={[styles.text, { color: colors.onSurfaceVariant }]}
      numberOfLines={1}
      accessibilityLabel={`${
        stats.tokensPredicted
      } tokens at ${stats.tokensPerSecond.toFixed(
        1,
      )} tokens per second, taking ${formatDuration(stats.totalMs)}`}
    >
      {describeStats(stats)}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    marginLeft: 'auto',
    paddingRight: 8,
  },
});

export default MessageStats;
