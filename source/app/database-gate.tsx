import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';

import { useChatStore, useHydrated } from '@/features/chat';
import useModelStore from '@/features/models/store';
import useSettingsStore from '@/features/settings/store';
import { useDatabaseMigrations } from '@/core/db';
import { reconcileAttachments } from '@/core/attachments';

const DatabaseGate = ({ children }: { children: ReactNode }) => {
  const { colors } = useTheme();
  const { success, error: migrationError } = useDatabaseMigrations();
  const hydrated = useHydrated();
  const hydrate = useChatStore(state => state.hydrate);
  const [hydrationError, setHydrationError] = useState<Error>();

  // A failure reading the database is as fatal as a failure migrating it, and
  // has the same remedy.
  const error = migrationError ?? hydrationError;

  useEffect(() => {
    if (!success || hydrated) {
      return;
    }
    // Everything now comes out of the same database, so nothing may render
    // until the migrations have run and all three stores have read from it.
    void (async () => {
      try {
        await Promise.all([
          useSettingsStore.getState().hydrate(),
          useModelStore.getState().hydrate(),
        ]);
        await hydrate();
      } catch (cause) {
        // Unhandled, this left `hydrated` false and a spinner on screen
        // forever with nothing explaining why.
        setHydrationError(
          cause instanceof Error ? cause : new Error(String(cause)),
        );
        return;
      }
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
    // Just a loader, not the logo again: the native splash already showed the
    // mark, and redrawing it here read as a flash followed by a second splash.
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="small" />
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
