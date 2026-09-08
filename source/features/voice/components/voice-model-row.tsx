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
import type { VoiceAsset } from '@/types';
import useVoiceStore from '../store';

/**
 * A download row for a voice file.
 *
 * Deliberately close to `model-row.tsx` but not shared with it: that row's job
 * is picking the model that answers, and every affordance on it — the tick, the
 * "Use" button, the detail chevron — routes through `chooseModel`. A speech
 * model is chosen for a different purpose and a vocoder is never chosen at all.
 */

interface VoiceModelRowProps {
  asset: VoiceAsset;
  /** Whether choosing this asset is meaningful — false for VAD and vocoder. */
  selectable?: boolean;
}

const VoiceModelRow = ({ asset, selectable = false }: VoiceModelRowProps) => {
  const { colors } = useTheme();
  const task = useDownloadTask(asset.id);
  const installed = useModelStore(state => state.voiceInstalled[asset.id]);
  const startVoiceDownload = useModelStore(state => state.startVoiceDownload);
  const cancelDownload = useModelStore(state => state.cancelDownload);
  const deleteVoiceAsset = useModelStore(state => state.deleteVoiceAsset);

  const speechAssetId = useVoiceStore(state => state.speechAssetId);
  const setSpeechAssetId = useVoiceStore(state => state.setSpeechAssetId);
  const isSelected = selectable && speechAssetId === asset.id;

  const ratio =
    task && task.contentLength > 0
      ? task.bytesWritten / task.contentLength
      : undefined;

  const description = task
    ? task.status === 'failed'
      ? task.error ?? 'Download failed'
      : `${formatBytes(task.bytesWritten)} of ${formatBytes(
          task.contentLength || asset.sizeBytes,
        )}`
    : `${asset.blurb} · ${formatBytes(asset.sizeBytes)}`;

  return (
    <View>
      <List.Item
        style={{
          backgroundColor: isSelected ? colors.surfaceVariant : undefined,
        }}
        title={asset.name}
        description={description}
        titleNumberOfLines={1}
        descriptionNumberOfLines={2}
        descriptionStyle={
          task?.status === 'failed' ? { color: colors.error } : undefined
        }
        onPress={
          installed && selectable ? () => setSpeechAssetId(asset.id) : undefined
        }
        left={props =>
          installed && selectable ? (
            <TouchableOpacity
              activeOpacity={0.7}
              {...props}
              onPress={() => setSpeechAssetId(asset.id)}
              accessibilityLabel={`Use ${asset.name}`}
            >
              <List.Icon
                icon={isSelected ? 'check-circle' : 'circle-outline'}
                color={isSelected ? colors.primary : colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          ) : (
            <List.Icon
              {...props}
              icon={installed ? 'check-circle-outline' : 'microphone-outline'}
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
                    accessibilityLabel={`Retry ${asset.name}`}
                    onPress={() => {
                      cancelDownload(asset.id);
                      startVoiceDownload(asset);
                    }}
                  />
                ) : (
                  <ActivityIndicator size={18} />
                )}
                <IconButton
                  icon="close"
                  accessibilityLabel={`Cancel ${asset.name}`}
                  onPress={() => cancelDownload(asset.id)}
                />
              </View>
            );
          }

          if (installed) {
            return (
              <IconButton
                icon="trash-can-outline"
                accessibilityLabel={`Delete ${asset.name}`}
                onPress={() => void deleteVoiceAsset(asset.id)}
              />
            );
          }

          return (
            <IconButton
              icon="download"
              accessibilityLabel={`Download ${asset.name}`}
              onPress={() => startVoiceDownload(asset)}
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

export default memo(VoiceModelRow);
