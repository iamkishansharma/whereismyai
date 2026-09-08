import { StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';

import type { VoicePhase } from './voice-orb';

/**
 * Mute, interrupt and end, plus the caption naming what the orb is doing.
 *
 * The caption is not decoration: a slow local model spends real seconds in
 * "thinking" and "preparing", and silence with no explanation reads as a hang.
 */

const CAPTIONS: Record<VoicePhase, string> = {
  idle: 'Getting ready…',
  listening: 'Listening',
  thinking: 'Thinking…',
  // Named honestly: swapping the chat model out for the voice takes seconds,
  // and pretending otherwise makes the pause feel like a fault.
  preparing: 'Preparing the voice…',
  speaking: 'Speaking',
  error: 'Something went wrong',
};

interface VoiceControlsProps {
  phase: VoicePhase;
  muted: boolean;
  error?: string;
  onToggleMute: () => void;
  onInterrupt: () => void;
  onEnd: () => void;
}

const VoiceControls = ({
  phase,
  muted,
  error,
  onToggleMute,
  onInterrupt,
  onEnd,
}: VoiceControlsProps) => {
  const { colors } = useTheme();
  const speaking = phase === 'speaking';

  return (
    <View style={styles.container}>
      <Text
        accessibilityLiveRegion="polite"
        variant="titleMedium"
        style={{ color: phase === 'error' ? colors.error : colors.onSurface }}
      >
        {phase === 'error' ? error ?? CAPTIONS.error : CAPTIONS[phase]}
      </Text>

      <View style={styles.buttons}>
        <IconButton
          size={26}
          mode="contained"
          icon={muted ? 'microphone-off' : 'microphone'}
          iconColor={muted ? colors.error : undefined}
          onPress={onToggleMute}
          accessibilityLabel={muted ? 'Unmute microphone' : 'Mute microphone'}
        />

        <IconButton
          size={26}
          mode="contained"
          icon="skip-next"
          disabled={!speaking}
          onPress={onInterrupt}
          accessibilityLabel="Interrupt the assistant"
        />

        <IconButton
          size={26}
          mode="contained"
          icon="phone-hangup"
          iconColor={colors.onError}
          containerColor={colors.error}
          onPress={onEnd}
          accessibilityLabel="End the conversation"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 20,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
});

export default VoiceControls;
