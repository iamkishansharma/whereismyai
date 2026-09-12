import {
  forwardRef,
  useCallback,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import {
  Alert,
  Keyboard,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {
  Button,
  Divider,
  Icon,
  IconButton,
  List,
  Switch,
  Text,
  Tooltip,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDarkMode } from '@/features/settings/store';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import SheetBackdrop from '@/shared/ui/sheet-backdrop';
import { useNavigation } from '@react-navigation/native';
import { ChatStackNavigation } from '@/navigation/chat-navigator';
import { isIOS } from '@/shared/utils';
import useModelStore, { useInstalledOrder } from '@/features/models/store';
import { useEffectiveModel } from '@/features/models/use-effective-model';
import { capturePhoto, pickFromLibrary } from '@/core/attachments';
import { deleteAttachments } from '@/core/attachments';
import AttachmentStrip from './attachment-strip';
import type { Attachment } from '@/types';

// Starting estimate for the whole composer, used by the keyboard inset hook.
export const COMPOSER_MIN_HEIGHT = 52;
// One line of text plus padding — the input's own floor, not the composer's.
const INPUT_MIN_HEIGHT = 44;
const INPUT_MAX_HEIGHT = 200;

interface ChatComposerProps {
  onSend: (text: string, files?: Attachment[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
}

export type ChatComposerHandle = ComponentRef<typeof View>;

const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(
  ({ onSend, onStop, isStreaming, onLayout }, ref) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const isDarkMode = useIsDarkMode();
    const [text, setText] = useState('');
    const [webSearchEnabled, setWebSearchEnabled] = useState(false);
    const navigation = useNavigation<ChatStackNavigation>();

    // The model this chat will actually use, so the chip can never disagree
    // with what generates the reply.
    const selectedModel = useEffectiveModel().model;
    const [files, setFiles] = useState<Attachment[]>([]);

    const engineState = useModelStore(state => state.engineState);
    const visionActive = useModelStore(state => state.visionActive);

    // Having a projector only means it *should* see. Whether it can is known
    // once the model has loaded, so stay optimistic until then.
    const hasProjector = Boolean(selectedModel?.mmprojPath);
    const canSeeImages = engineState === 'ready' ? visionActive : hasProjector;
    const blindWithImages = files.length > 0 && !canSeeImages;

    // With nothing installed the library is the useful destination; otherwise
    // the quick picker. Same rule the welcome card uses.
    const installedCount = useInstalledOrder().length;
    const modelRoute = installedCount ? 'ModelPicker' : 'ModelLibrary';

    const hasModel = selectedModel !== undefined;
    const canSend = (text.trim().length > 0 || files.length > 0) && hasModel;

    const handleSend = useCallback(() => {
      const trimmed = text.trim();
      if (!trimmed && !files.length) {
        return;
      }
      setText('');
      setFiles([]);
      onSend(trimmed, files.length ? files : undefined);
    }, [files, onSend, text]);

    const bottomSheetRef = useRef<BottomSheetModal>(null);

    const handleOpenBottomSheet = useCallback(() => {
      bottomSheetRef.current?.present();
    }, []);

    const handleCloseBottomSheet = useCallback(() => {
      bottomSheetRef.current?.close();
    }, []);

    const addFiles = useCallback(
      async (pick: () => Promise<Attachment[]>) => {
        handleCloseBottomSheet();
        try {
          const picked = await pick();
          if (picked.length) {
            setFiles(current => [...current, ...picked]);
          }
        } catch (error) {
          Alert.alert(
            'Could not attach image',
            error instanceof Error ? error.message : 'Unknown error',
          );
        }
      },
      [handleCloseBottomSheet],
    );

    const removeFileAt = useCallback((id: string) => {
      setFiles(current => {
        const target = current.find(file => file.id === id);
        if (target) {
          // Never picked up by a message, so the copy on disk is ours to drop.
          void deleteAttachments([target]);
        }
        return current.filter(file => file.id !== id);
      });
    }, []);

    return (
      <>
        <View
          ref={ref}
          onLayout={onLayout}
          style={[
            styles.container,
            {
              backgroundColor: 'transparent',
              // borderTopColor: colors.outlineVariant,
              paddingBottom: insets.bottom + 8,
            },
          ]}
        >
          <View
            style={[
              styles.inputRow,
              {
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            {blindWithImages && (
              <TouchableRipple
                onPress={() => navigation.navigate(modelRoute)}
                style={[
                  styles.warning,
                  { backgroundColor: colors.errorContainer },
                ]}
                accessibilityLabel="Choose a model that can read images"
              >
                <View style={styles.warningRow}>
                  <Icon
                    source="image-off-outline"
                    size={18}
                    color={colors.onErrorContainer}
                  />
                  <Text
                    variant="bodySmall"
                    style={[
                      styles.warningText,
                      { color: colors.onErrorContainer },
                    ]}
                  >
                    {selectedModel?.name ?? 'This model'} can't read images —
                    choose a vision model
                  </Text>
                  <Icon
                    source="chevron-right"
                    size={18}
                    color={colors.onErrorContainer}
                  />
                </View>
              </TouchableRipple>
            )}

            <AttachmentStrip files={files} onRemove={removeFileAt} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type to chat..."
              placeholderTextColor={colors.onSurfaceVariant}
              style={[styles.input, { color: colors.onSurface }]}
              multiline
              submitBehavior="newline"
              textAlignVertical="top"
              keyboardAppearance={isDarkMode ? 'dark' : 'light'}
              accessibilityLabel="Message input"
            />

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <IconButton
                  size={22}
                  mode="contained"
                  icon="paperclip"
                  onPress={() => {
                    Keyboard.dismiss();
                    handleOpenBottomSheet();
                  }}
                  accessibilityLabel="Add attachment"
                  style={styles.button}
                />

                <Button
                  onPress={() => navigation.navigate(modelRoute)}
                  mode="contained-tonal"
                  compact
                  style={{ maxWidth: 250 }}
                  contentStyle={{
                    paddingHorizontal: 6,
                  }}
                  labelStyle={{
                    fontSize: 13,
                    lineHeight: 16,
                    fontWeight: 'normal',
                  }}
                >
                  {selectedModel?.name || 'Select Model'}
                </Button>
              </View>

              <IconButton
                size={22}
                mode="contained"
                icon={isStreaming ? 'stop' : 'arrow-up'}
                iconColor={isStreaming ? colors.error : colors.primary}
                // disabled={!isStreaming }
                onPress={() => {
                  if (isStreaming) {
                    onStop();
                  } else if (canSend) {
                    handleSend();
                  } else if (!hasModel) {
                    navigation.navigate(modelRoute);
                  }
                }}
                accessibilityLabel={
                  isStreaming ? 'Stop generating' : 'Send message'
                }
                style={[styles.button, { alignSelf: 'flex-end' }]}
              />

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  display: 'none',
                }}
              >
                {/* TODO:: Voice input */}
                <Tooltip title="Coming soon!" enterTouchDelay={0}>
                  <IconButton
                    size={22}
                    mode="contained"
                    icon="microphone"
                    style={[styles.button, { alignSelf: 'flex-end' }]}
                  />
                </Tooltip>
                {text.trim().length > 0 || isStreaming ? (
                  <IconButton
                    size={22}
                    mode="contained"
                    icon={isStreaming ? 'stop' : 'arrow-up'}
                    iconColor={isStreaming ? colors.error : colors.primary}
                    // disabled={!isStreaming }
                    onPress={() => {
                      if (isStreaming) {
                        onStop();
                      } else if (canSend) {
                        handleSend();
                      } else if (!hasModel) {
                        navigation.navigate(modelRoute);
                      }
                    }}
                    accessibilityLabel={
                      isStreaming ? 'Stop generating' : 'Send message'
                    }
                    style={[styles.button, { alignSelf: 'flex-end' }]}
                  />
                ) : (
                  <Tooltip title="Coming soon!" enterTouchDelay={0}>
                    {/* TODO:: Voice conversation */}
                    <IconButton
                      size={22}
                      mode="contained"
                      icon="waveform"
                      style={[styles.button, { alignSelf: 'flex-end' }]}
                    />
                  </Tooltip>
                )}
              </View>
            </View>
          </View>
        </View>

        <BottomSheetModal
          ref={bottomSheetRef}
          onDismiss={handleCloseBottomSheet}
          enablePanDownToClose
          backdropComponent={SheetBackdrop}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          backgroundStyle={{ backgroundColor: colors.surface }}
          handleIndicatorStyle={{
            backgroundColor: colors.outline,
          }}
          snapPoints={['50%', '70%']}
          topInset={insets.top}
        >
          <BottomSheetView style={{ paddingBottom: insets.bottom }}>
            <Text
              variant="titleLarge"
              style={{ marginBottom: 8, marginLeft: 16 }}
            >
              Attachments
            </Text>

            <View
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                flexDirection: 'row',
              }}
            >
              <List.Item
                style={{ width: '50%' }}
                title="Photos"
                description="Select a photo"
                left={props => <List.Icon {...props} icon="image-outline" />}
                onPress={() => void addFiles(pickFromLibrary)}
              />
              <List.Item
                style={{ width: '50%' }}
                title="Camera"
                description="Take a new photo"
                left={props => <List.Icon {...props} icon="camera-outline" />}
                onPress={() => void addFiles(capturePhoto)}
              />
            </View>
            <Divider style={{ marginVertical: 8 }} />

            {/* TODO :: coming soon */}
            <List.Item
              style={{ display: 'none' }}
              title="Web search"
              description="Search the web for information"
              left={props => <List.Icon {...props} icon="web" />}
              right={props => (
                <Switch
                  value={webSearchEnabled}
                  onValueChange={value => setWebSearchEnabled(value)}
                  {...props}
                />
              )}
            />

            <List.Item
              title="Models"
              description="Change the model used for generating responses"
              left={props => <List.Icon {...props} icon="robot-outline" />}
              onPress={() => {
                navigation.navigate('ModelPicker');
                handleCloseBottomSheet();
              }}
            />
          </BottomSheetView>
        </BottomSheetModal>
      </>
    );
  },
);

ChatComposer.displayName = 'ChatComposer';

const styles = StyleSheet.create({
  container: {
    // borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  inputRow: {
    // flexDirection: 'row',
    // alignItems: 'flex-end',
    borderRadius: 24,
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 6,
    // minHeight: COMPOSER_MIN_HEIGHT - 12,
  },
  input: {
    // No explicit height and no flex. Fabric measures the intrinsic content
    // size, so the input grows on its own between these two bounds and starts
    // scrolling once it hits the cap.
    fontSize: 16,
    paddingHorizontal: 6,
    paddingTop: isIOS ? 9 : 6,
    paddingBottom: isIOS ? 9 : 6,
    minHeight: INPUT_MIN_HEIGHT,
    maxHeight: INPUT_MAX_HEIGHT,
  },
  warning: {
    borderRadius: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningText: {
    flex: 1,
  },
  button: {
    margin: 0,
  },
});

export default ChatComposer;
