import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useDefaultStore from '@/stores/default-store';

const Onboarding = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const setShowOnboarding = useDefaultStore(state => state.setShowOnboarding);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 48,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <View style={styles.hero}>
        <View style={[styles.glyph, { backgroundColor: colors.surfaceVariant }]}>
          <Icon source="robot-happy-outline" size={40} color={colors.primary} />
        </View>
        <Text variant="headlineMedium" style={styles.title}>
          Where is my AI?
        </Text>
        <Text
          variant="bodyLarge"
          style={[styles.subtitle, { color: colors.onSurfaceVariant }]}
        >
          Your conversations, on your device.
        </Text>
      </View>

      <Button mode="contained" onPress={() => setShowOnboarding(false)}>
        Get started
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 8,
  },
});

export default Onboarding;
