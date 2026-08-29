import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';

import type { Attachment } from '@/types';

const THUMB_SIZE = 64;

interface AttachmentStripProps {
  files: Attachment[];
  onRemove: (id: string) => void;
}

const AttachmentStrip = ({ files, onRemove }: AttachmentStripProps) => {
  const { colors } = useTheme();

  if (!files.length) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {files.map(file => (
        <View key={file.id} style={styles.item}>
          <Image
            source={{ uri: file.uri }}
            style={[styles.thumb, { borderColor: colors.outlineVariant }]}
          />
          <IconButton
            icon="close"
            size={16}
            mode="contained-tonal"
            containerColor={colors.inverseSurface}
            iconColor={colors.inverseOnSurface}
            onPress={() => onRemove(file.id)}
            accessibilityLabel="Remove attachment"
            style={styles.remove}
          />
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  item: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -8,
    margin: 0,
    padding: 0,
    width: 24,
    height: 24,
  },
});

export default AttachmentStrip;
