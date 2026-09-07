import { isAndroid } from '@/shared/utils';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

const BottomSheetHeader = ({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) => (
  <View style={styles.header}>
    <Text
      variant={isAndroid ? 'titleLarge' : 'titleMedium'}
      style={styles.title}
    >
      {title}
    </Text>
    <IconButton
      icon="close"
      mode="contained"
      size={22}
      onPress={onClose}
      accessibilityLabel="Close"
      style={styles.headerButton}
    />
  </View>
);

const styles = StyleSheet.create({
  header: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerSpacer: {
    width: 38,
  },
  title: {
    flex: 1,
    textAlign: isAndroid ? 'left' : 'center',
  },
  headerButton: {
    position: 'absolute',
    right: 10,
  },
});

export default BottomSheetHeader;
