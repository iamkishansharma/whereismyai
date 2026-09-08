import { memo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  ActivityIndicator,
  IconButton,
  List,
  ProgressBar,
  Text,
  useTheme,
} from 'react-native-paper';

import useModelStore, { useDownloadTask } from '@/features/models/store';
import useChatStore from '@/features/chat/store';
import { useEffectiveModel } from '@/features/models/use-effective-model';
import { formatBytes } from '@/shared/utils/format';
import type { ModelFile, ProjectorFile } from '@/types';

interface ModelRowProps {
  id: string;
  name: string;
  subtitle: string;
  file: ModelFile & { mmproj?: ProjectorFile };
  onPress?: () => void;
  /** What this model is for, e.g. "Chat" — shown so mixed lists stay legible. */
  badge?: string;
}

const ModelRow = ({
  id,
  name,
  subtitle,
  file,
  onPress,
  badge,
}: ModelRowProps) => {
  const { colors } = useTheme();
  const task = useDownloadTask(id);
  const installed = useModelStore(state => state.installed[id]);
  // Compare against what the chat will actually use, not the global selection —
  // otherwise a row reads "active" while the conversation uses another model.
  const isSelected = useEffectiveModel().id === id;

  const startDownload = useModelStore(state => state.startDownload);
  const cancelDownload = useModelStore(state => state.cancelDownload);
  const chooseModel = useChatStore(state => state.chooseModel);

  const totalBytes = file.sizeBytes + (file.mmproj?.sizeBytes ?? 0);

  const ratio =
    task && task.contentLength > 0
      ? task.bytesWritten / task.contentLength
      : undefined;

  const description = task
    ? task.status === 'failed'
      ? task.error ?? 'Download failed'
      : `${formatBytes(task.bytesWritten)} of ${formatBytes(
          task.contentLength || totalBytes,
        )}`
    : `${subtitle} · ${formatBytes(totalBytes)}`;

  return (
    <View>
      <List.Item
        style={{
          backgroundColor:
            installed && isSelected ? colors.surfaceVariant : undefined,
        }}
        title={name}
        description={description}
        titleNumberOfLines={1}
        descriptionNumberOfLines={2}
        descriptionStyle={
          task?.status === 'failed' ? { color: colors.error } : undefined
        }
        onPress={installed && onPress ? onPress : undefined}
        left={props =>
          installed ? (
            <TouchableOpacity
              activeOpacity={0.7}
              {...props}
              onPress={() => {
                if (!isSelected && installed) {
                  chooseModel(id);
                }
              }}
            >
              <List.Icon
                icon={isSelected ? 'check-circle' : 'circle-outline'}
                color={isSelected ? colors.primary : colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          ) : (
            <List.Icon {...props} icon="cube-outline" />
          )
        }
        right={() => {
          if (task) {
            return (
              <View style={styles.trailing}>
                {task.status === 'failed' ? (
                  <IconButton
                    icon="refresh"
                    accessibilityLabel={`Retry ${name}`}
                    onPress={() => {
                      cancelDownload(id);
                      startDownload({ ...file, id, name });
                    }}
                  />
                ) : (
                  <ActivityIndicator size={18} />
                )}
                <IconButton
                  icon="close"
                  accessibilityLabel={`Cancel ${name}`}
                  onPress={() => cancelDownload(id)}
                />
              </View>
            );
          }

          if (installed) {
            return (
              <View style={styles.trailing}>
                {!isSelected && (
                  <IconButton
                    icon="check"
                    accessibilityLabel={`Use ${name}`}
                    onPress={() => chooseModel(id)}
                  />
                )}
                <IconButton
                  icon="chevron-right"
                  accessibilityLabel={`Details for ${name}`}
                  onPress={onPress}
                />
              </View>
            );
          }

          return (
            <IconButton
              icon="download"
              accessibilityLabel={`Download ${name}`}
              onPress={() => startDownload({ ...file, id, name })}
            />
          );
        }}
      />

      {badge && !task && (
        <Text
          variant="labelSmall"
          style={[
            styles.badge,
            {
              backgroundColor: colors.secondaryContainer,
              color: colors.onSecondaryContainer,
            },
          ]}
        >
          {badge}
        </Text>
      )}

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
  badge: {
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
});

// The search tab renders a long list of these and each reads three store
// slices, so re-rendering them all when a sibling expands is wasteful.
export default memo(ModelRow);
