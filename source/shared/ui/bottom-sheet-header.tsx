import { StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

/**
 * The title bar every bottom sheet shares.
 *
 * Lives here rather than in either feature because the sheets are opened from
 * unrelated places and are only recognisable as the same kind of surface if
 * they are topped identically.
 */

interface BottomSheetHeaderProps {
  title: string;
  onClose: () => void;
}

const BottomSheetHeader = ({ title, onClose }: BottomSheetHeaderProps) => (
  <View style={styles.container}>
    <Text variant="titleLarge" style={styles.title}>
      {title}
    </Text>
    <IconButton
      icon="close"
      size={22}
      mode="contained"
      onPress={onClose}
      accessibilityLabel="Close"
      style={styles.close}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 12,
    paddingBottom: 8,
  },
  title: {
    flex: 1,
  },
  close: {
    margin: 0,
  },
});

export default BottomSheetHeader;
