import { useCallback } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Icon, List, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';

import SheetBackdrop from '@/shared/ui/sheet-backdrop';
import BottomSheetHeader from '@/features/models/components/bottom-sheet-header';
import { useInstalledOrder } from '@/features/models/store';
import type { ChatStackNavigation } from '@/navigation/chat-navigator';
import {
  DEFAULT_SPEECH_BUNDLE,
  SPEECH_BUNDLES,
  VOICE_OUTPUT_BUNDLE,
} from '../catalog';
import { useVoiceReadiness } from '../store';
import VoiceBundleRow from './voice-bundle-row';
import {
  closeVoiceSetup,
  useVoiceSetupStore,
  voiceSetupSheetRef,
} from '../use-voice-setup';

/**
 * What voice still needs before it can run, offered inline.
 *
 * Shown instead of silently disabling the microphone and waveform buttons: a
 * button that does nothing teaches the user nothing, and the files are a tap
 * away. Which rows appear depends on what is actually missing, so a user who
 * already dictates is not asked to re-read the speech section.
 */

// A sheet that lists downloads can get tall; leave the screen behind it visible
// so it still reads as a sheet rather than a screen.
const MAX_HEIGHT_RATIO = 0.85;

const VoiceSetupSheet = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const navigation = useNavigation<ChatStackNavigation>();

  const intent = useVoiceSetupStore(state => state.intent);
  const hasChatModel = useInstalledOrder().length > 0;
  const { canDictate, canSpeak, gap } = useVoiceReadiness(hasChatModel);

  // Conversation needs a voice as well as ears; dictation only needs ears.
  const wantsSpeech = !canDictate;
  const wantsVoice = intent === 'conversation' && !canSpeak;

  const openLibrary = useCallback(() => {
    // Dismiss first — leaving the sheet up behind a pushed screen means it is
    // still sitting there when the user comes back.
    closeVoiceSetup();
    navigation.navigate('ModelLibrary');
  }, [navigation]);

  const title =
    intent === 'conversation' ? 'Set up voice chat' : 'Set up dictation';

  const explanation =
    gap === 'chat-model'
      ? 'Voice is ready, but no model is installed to answer you yet.'
      : intent === 'conversation'
      ? 'Talking with the assistant needs a model to hear you and one to speak back. Both run on this device.'
      : 'Dictation needs a speech model. It runs on this device, so what you say never leaves it.';

  return (
    <BottomSheetModal
      ref={voiceSetupSheetRef}
      enablePanDownToClose
      maxDynamicContentSize={height * MAX_HEIGHT_RATIO}
      backdropComponent={SheetBackdrop}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.outline }}
      topInset={insets.top}
    >
      <BottomSheetScrollView
        style={{ maxHeight: height * MAX_HEIGHT_RATIO }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
      >
        <BottomSheetHeader title={title} onClose={closeVoiceSetup} />

        <Text
          variant="bodyMedium"
          style={[styles.explanation, { color: colors.onSurfaceVariant }]}
        >
          {explanation}
        </Text>

        {gap === 'chat-model' && (
          <List.Item
            title="Choose a model"
            description="Pick the model that answers you"
            left={props => <List.Icon {...props} icon="robot-outline" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={openLibrary}
          />
        )}

        {wantsSpeech && (
          <>
            <List.Subheader>To hear you</List.Subheader>
            <VoiceBundleRow bundle={DEFAULT_SPEECH_BUNDLE} selectable />
            <Text
              variant="labelSmall"
              style={[styles.note, { color: colors.onSurfaceVariant }]}
            >
              Includes the speech detector, which knows when you stop talking.
            </Text>
          </>
        )}

        {wantsVoice && (
          <>
            <List.Subheader>To speak back</List.Subheader>
            <VoiceBundleRow bundle={VOICE_OUTPUT_BUNDLE} />
            <View style={styles.warningRow}>
              <Icon
                source="information-outline"
                size={16}
                color={colors.onSurfaceVariant}
              />
              <Text
                variant="labelSmall"
                style={{ color: colors.onSurfaceVariant, flex: 1 }}
              >
                A large download, and speaking is slow on older phones. You can
                start with dictation and add this later.
              </Text>
            </View>
          </>
        )}

        {(wantsSpeech || wantsVoice) && (
          <List.Item
            title="See all voice models"
            description={`${SPEECH_BUNDLES.length} speech models to choose from`}
            left={props => <List.Icon {...props} icon="tune" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={openLibrary}
          />
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  explanation: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  note: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
});

export default VoiceSetupSheet;
