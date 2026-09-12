import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { useChatStore, useHydrated } from '@/features/chat';
import useModelStore from '@/features/models/store';
import useSettingsStore from '@/features/settings/store';
import { useDatabaseMigrations } from '@/core/db';
import { reconcileAttachments } from '@/core/attachments';

const DatabaseGate = ({ children }: { children: ReactNode }) => {
  const { colors } = useTheme();
  const { success, error } = useDatabaseMigrations();
  const hydrated = useHydrated();
  const hydrate = useChatStore(state => state.hydrate);

  useEffect(() => {
    if (!success || hydrated) {
      return;
    }
    // Everything now comes out of the same database, so nothing may render
    // until the migrations have run and all three stores have read from it.
    void (async () => {
      await Promise.all([
        useSettingsStore.getState().hydrate(),
        useModelStore.getState().hydrate(),
      ]);
      await hydrate();
      void useModelStore.getState().pruneMissingModels();
      void reconcileAttachments();
    })();
  }, [hydrate, hydrated, success]);

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text variant="titleMedium">Could not open your data</Text>
        <Text
          variant="bodySmall"
          style={[styles.detail, { color: colors.onSurfaceVariant }]}
        >
          Reinstalling the app will fix this, but it will clear your
          conversations and downloaded models.
        </Text>
        {/* The failing SQL is developer detail — it should never be the thing
            filling a user's screen. */}
        {__DEV__ && (
          <Text
            variant="bodySmall"
            style={[styles.detail, { color: colors.onSurfaceVariant }]}
            selectable
          >
            {error.message}
          </Text>
        )}
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
