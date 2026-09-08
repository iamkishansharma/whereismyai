import { useCallback, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import type { VoiceScreenProps } from '@/navigation/types';
import VoiceControls from '../components/voice-controls';
import VoiceOrb from '../components/voice-orb';
import {
  finishTurn,
  interrupt,
  setMuted,
  startVoice,
  stopVoice,
  testSpeak,
  useVoiceState,
} from '../pipeline';

/**
 * The spoken conversation, full screen.
 *
 * Deliberately quiet: one orb, a caption naming what is happening, and the
 * running transcript. Everything the conversation produces is also written to
 * the ordinary chat, so this screen owns no state of its own — it renders the
 * pipeline and can be torn down at any moment without losing anything.
 */

const VoiceScreen = ({ navigation, route }: VoiceScreenProps) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const phase = useVoiceState(state => state.phase);
  const level = useVoiceState(state => state.level);
  const heard = useVoiceState(state => state.heard);
  const reply = useVoiceState(state => state.reply);
  const error = useVoiceState(state => state.error);
  const muted = useVoiceState(state => state.muted);

  const conversationId = route.params?.conversationId;

  useEffect(() => {
    void startVoice(conversationId);
    // Leaving with the microphone open would keep recording behind a screen the
    // user has already dismissed, so teardown is unconditional.
    return () => {
      void stopVoice();
    };
  }, [conversationId]);

  // A hardware back gesture bypasses the unmount path long enough to leave a
  // completion running, so stop from the navigation event as well.
  useEffect(
    () => navigation.addListener('beforeRemove', () => void stopVoice()),
    [navigation],
  );

  const end = useCallback(() => {
    void stopVoice();
    navigation.goBack();
  }, [navigation]);

  const onOrbPress = useCallback(() => {
    if (phase === 'speaking') {
      void interrupt();
      return;
    }
    if (phase === 'listening') {
      // Tapping while listening is "I am done" — useful when the detector is
      // waiting for a pause the user never quite leaves.
      void finishTurn();
    }
  }, [phase]);

  const orbHint =
    phase === 'speaking'
      ? 'Interrupt'
      : phase === 'listening'
      ? 'Tap when you are done'
      : undefined;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <Animated.View entering={FadeIn.duration(420)} style={styles.orbArea}>
        <Pressable
          onPress={onOrbPress}
          accessibilityRole="button"
          accessibilityLabel={orbHint ?? 'Voice conversation'}
        >
          <VoiceOrb phase={phase} level={level} />
        </Pressable>

        {orbHint && (
          <Text
            variant="labelMedium"
            style={{ color: colors.onSurfaceVariant }}
          >
            {orbHint}
          </Text>
        )}
      </Animated.View>

      <ScrollView
        style={styles.transcript}
        contentContainerStyle={styles.transcriptContent}
        showsVerticalScrollIndicator={false}
      >
        {Boolean(heard) && (
          <Animated.View entering={FadeInDown.duration(280)}>
            <Text
              variant="labelSmall"
              style={{ color: colors.onSurfaceVariant }}
            >
              You
            </Text>
            <Text variant="bodyLarge" style={{ color: colors.onSurface }}>
              {heard}
            </Text>
          </Animated.View>
        )}

        {Boolean(reply) && (
          <Animated.View entering={FadeInDown.duration(280)}>
            <Text
              variant="labelSmall"
              style={{ color: colors.onSurfaceVariant }}
            >
              Assistant
            </Text>
            <Text variant="bodyLarge" style={{ color: colors.onSurface }}>
              {reply}
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      {__DEV__ && (
        <Button
          mode="outlined"
          compact
          onPress={() => void testSpeak()}
          style={styles.testButton}
        >
          Test voice
        </Button>
      )}

      <VoiceControls
        phase={phase}
        muted={muted}
        error={error}
        onToggleMute={() => setMuted(!muted)}
        onInterrupt={() => void interrupt()}
        onEnd={end}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  orbArea: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 24,
  },
  transcript: {
    flex: 1,
    marginVertical: 16,
  },
  transcriptContent: {
    gap: 16,
    paddingVertical: 8,
  },
  testButton: {
    alignSelf: 'center',
    marginBottom: 12,
  },
});

export default VoiceScreen;
