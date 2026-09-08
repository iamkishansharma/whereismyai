import { memo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  ActivityIndicator,
  IconButton,
  List,
  ProgressBar,
  useTheme,
} from 'react-native-paper';

import useModelStore, { useDownloadTask } from '@/features/models/store';
import { formatBytes } from '@/shared/utils/format';
import type { VoiceBundle } from '../catalog';
import { useIsBundleInstalled } from '../store';
import useVoiceStore from '../store';

/**
 * One row per voice capability, not per file.
 *
 * Deliberately close to `model-row.tsx` but not shared with it: that row's
 * affordances all route through `chooseModel`, and a speech model is chosen for
 * a different purpose while a vocoder is never chosen at all.
 */

interface VoiceBundleRowProps {
  bundle: VoiceBundle;
  /** Whether picking this one is meaningful — true only for speech models. */
  selectable?: boolean;
}

const VoiceBundleRow = ({
  bundle,
  selectable = false,
}: VoiceBundleRowProps) => {
  const { colors } = useTheme();
  const task = useDownloadTask(bundle.id);
  const installed = useIsBundleInstalled(bundle);

  const startVoiceDownload = useModelStore(state => state.startVoiceDownload);
  const cancelDownload = useModelStore(state => state.cancelDownload);
  const deleteVoiceAsset = useModelStore(state => state.deleteVoiceAsset);

  const speechAssetId = useVoiceStore(state => state.speechAssetId);
  const setSpeechAssetId = useVoiceStore(state => state.setSpeechAssetId);
  const isSelected = selectable && installed && speechAssetId === bundle.id;

  const ratio =
    task && task.contentLength > 0
      ? task.bytesWritten / task.contentLength
      : undefined;

  const description = task
    ? task.status === 'failed'
      ? task.error ?? 'Download failed'
      : `${formatBytes(task.bytesWritten)} of ${formatBytes(
          task.contentLength || bundle.sizeBytes,
        )}`
    : `${bundle.blurb} · ${formatBytes(bundle.sizeBytes)}`;

  // Deleting the primary file is enough to disable the capability, and the
  // shared detector is left alone so other speech models keep working.
  const remove = () => void deleteVoiceAsset(bundle.assets[0].id);

  return (
    <View>
      <List.Item
        style={{
          backgroundColor: isSelected ? colors.surfaceVariant : undefined,
        }}
        title={bundle.name}
        description={description}
        titleNumberOfLines={1}
        descriptionNumberOfLines={2}
        descriptionStyle={
          task?.status === 'failed' ? { color: colors.error } : undefined
        }
        onPress={
          installed && selectable
            ? () => setSpeechAssetId(bundle.id)
            : undefined
        }
        left={props =>
          installed && selectable ? (
            <TouchableOpacity
              activeOpacity={0.7}
              {...props}
              onPress={() => setSpeechAssetId(bundle.id)}
              accessibilityLabel={`Use ${bundle.name}`}
            >
              <List.Icon
                icon={isSelected ? 'check-circle' : 'circle-outline'}
                color={isSelected ? colors.primary : colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          ) : (
            <List.Icon
              {...props}
              icon={
                bundle.purpose === 'tts'
                  ? 'account-voice'
                  : 'microphone-outline'
              }
              color={installed ? colors.primary : undefined}
            />
          )
        }
        right={() => {
          if (task) {
            return (
              <View style={styles.trailing}>
                {task.status === 'failed' ? (
                  <IconButton
                    icon="refresh"
                    accessibilityLabel={`Retry ${bundle.name}`}
                    onPress={() => {
                      cancelDownload(bundle.id);
                      startVoiceDownload(bundle.assets);
                    }}
                  />
                ) : (
                  <ActivityIndicator size={18} />
                )}
                <IconButton
                  icon="close"
                  accessibilityLabel={`Cancel ${bundle.name}`}
                  onPress={() => cancelDownload(bundle.id)}
                />
              </View>
            );
          }

          if (installed) {
            return (
              <IconButton
                icon="trash-can-outline"
                accessibilityLabel={`Delete ${bundle.name}`}
                onPress={remove}
              />
            );
          }

          return (
            <IconButton
              icon="download"
              accessibilityLabel={`Download ${bundle.name}`}
              onPress={() => startVoiceDownload(bundle.assets)}
            />
          );
        }}
      />

      {task && task.status !== 'failed' && (
        <ProgressBar
          progress={ratio ?? 0}
          indeterminate={ratio === undefined}
          style={styles.progress}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progress: {
    marginHorizontal: 16,
    marginBottom: 8,
    height: 3,
    borderRadius: 2,
  },
});

export default memo(VoiceBundleRow);
