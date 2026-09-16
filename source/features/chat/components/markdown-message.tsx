import { memo, useMemo } from 'react';
import { Linking, StyleSheet } from 'react-native';
import type { EnrichedMarkdownTextProps } from 'react-native-enriched-markdown';
import { useTheme } from 'react-native-paper';
import type { MarkdownStyle } from 'react-native-enriched-markdown';
import { StreamdownText } from 'react-native-streamdown';

interface MarkdownMessageProps {
  markdown: string;
  streaming?: boolean;
  /** Secondary text — a model's narration, not its answer. */
  muted?: boolean;
  containerStyle?: EnrichedMarkdownTextProps['containerStyle'];
}

const MarkdownMessage = ({
  markdown,
  streaming,
  muted,
  containerStyle,
}: MarkdownMessageProps) => {
  const { colors, fonts } = useTheme();
  const ink = muted ? colors.onSurfaceVariant : colors.onSurface;
  const body = muted ? fonts.bodySmall : fonts.bodyLarge;

  const markdownStyle = useMemo<MarkdownStyle>(
    () => ({
      paragraph: {
        color: ink,
        fontSize: body.fontSize,
        lineHeight: body.lineHeight,
        marginBottom: muted ? 8 : 12,
      },
      h1: { color: ink, marginTop: 16, marginBottom: 8 },
      h2: { color: ink, marginTop: 16, marginBottom: 8 },
      h3: { color: ink, marginTop: 12, marginBottom: 6 },
      list: {
        color: ink,
        bulletColor: colors.onSurfaceVariant,
        markerColor: colors.onSurfaceVariant,
        itemSpacing: 4,
        marginBottom: muted ? 8 : 12,
      },
      link: { color: colors.primary, underline: false },
      code: {
        color: colors.onSurfaceVariant,
        backgroundColor: colors.surfaceVariant,
      },
      codeBlock: {
        color: colors.onSurfaceVariant,
        backgroundColor: colors.surfaceVariant,
        borderColor: colors.outlineVariant,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        padding: 12,
      },
      blockquote: {
        color: colors.onSurfaceVariant,
        borderColor: colors.outlineVariant,
        borderWidth: 3,
        gapWidth: 12,
      },
      table: {
        color: ink,
        borderColor: colors.outlineVariant,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        headerBackgroundColor: colors.surfaceVariant,
        headerTextColor: colors.onSurfaceVariant,
        cellPaddingHorizontal: 10,
        cellPaddingVertical: 6,
      },
      thematicBreak: { color: colors.outlineVariant, height: 1 },
    }),
    [colors, ink, body, muted],
  );

  if (!markdown) {
    return null;
  }

  return (
    <StreamdownText
      markdown={markdown}
      markdownStyle={markdownStyle}
      streamingAnimation={streaming}
      flavor="github"
      streamingConfig={{
        tableMode: 'progressive',
        codeBlockMode: 'progressive',
      }}
      containerStyle={{ ...styles.container, ...containerStyle }}
      onLinkPress={event => Linking.openURL(event.url)}
      selectable
    />
  );
};

export const PlainMessage = memo(({ text }: { text: string }) => (
  <MarkdownMessage
    markdown={text}
    streaming={false}
    containerStyle={{ width: undefined }}
  />
));

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});

export default memo(MarkdownMessage);
