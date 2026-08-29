import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { useChatStore, useHydrated } from '@/features/chat';
import { useDatabaseMigrations } from '@/core/db';

const DatabaseGate = ({ children }: { children: ReactNode }) => {
  const { colors } = useTheme();
  const { success, error } = useDatabaseMigrations();
  const hydrated = useHydrated();
  const hydrate = useChatStore(state => state.hydrate);

  useEffect(() => {
    if (success && !hydrated) {
      void hydrate();
    }
  }, [hydrate, hydrated, success]);

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text variant="titleMedium">Could not open the database</Text>
        <Text
          variant="bodySmall"
          style={[styles.detail, { color: colors.onSurfaceVariant }]}
          selectable
        >
          {error.message}
        </Text>
      </View>
    );
  }

  if (!success || !hydrated) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 32,
  },
  detail: {
    textAlign: 'center',
  },
});

export default DatabaseGate;
