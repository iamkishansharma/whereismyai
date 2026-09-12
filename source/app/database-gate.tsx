import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { useChatStore, useHydrated } from '@/features/chat';
import useModelStore from '@/features/models/store';
import useSettingsStore from '@/features/settings/store';
import { useDatabaseMigrations } from '@/core/db';
import { reconcileAttachments } from '@/core/attachments';

// Matches bootsplash_background and the logo's own background exactly.
const SPLASH_BACKGROUND = '#000000';
const SPLASH_TEXT = '#FFFFFF';
const SPLASH_MUTED = 'rgba(255, 255, 255, 0.6)';

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
    // Continues the native splash rather than replacing it, so its colours are
    // fixed rather than themed: the splash behind it is black either way, and
    // the logo is a light mark on its own black square.
    return (
      <View style={styles.splash}>
        {/* Last mounted wins, so this reverts to the themed bar on unmount. */}
        <StatusBar barStyle="light-content" />

        <View style={styles.splashCentre}>
          <Image
            source={require('@/assets/wima-logo.png')}
            style={styles.logo}
            accessibilityIgnoresInvertColors
          />
        </View>

        <View style={styles.splashFooter}>
          <Text variant="titleMedium" style={styles.splashTitle}>
            Where Is My AI
          </Text>
          <Text variant="bodySmall" style={styles.tagline}>
            It's right here on your phone.
          </Text>
          <ActivityIndicator
            style={styles.splashSpinner}
            size="small"
            color={SPLASH_TEXT}
          />
        </View>
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
  splash: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 64,
    backgroundColor: SPLASH_BACKGROUND,
  },
  splashCentre: {
    flex: 1,
    justifyContent: 'center',
  },
  // Matches the native splash's logo width, and square like it — the corners
  // are the logo's own black, invisible against the background.
  logo: {
    width: 120,
    height: 120,
  },
  splashFooter: {
    alignItems: 'center',
    gap: 4,
  },
  splashTitle: {
    color: SPLASH_TEXT,
  },
  tagline: {
    textAlign: 'center',
    color: SPLASH_MUTED,
  },
  splashSpinner: {
    marginTop: 20,
  },
});

export default DatabaseGate;
