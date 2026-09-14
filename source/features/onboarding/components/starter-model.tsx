import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, ProgressBar, Text, useTheme } from 'react-native-paper';

import { STARTER_MODEL } from '@/features/models/catalog';
import useModelStore, { useDownloadTask } from '@/features/models/store';
import useChatStore from '@/features/chat/store';
import { formatBytes } from '@/shared/utils/format';

interface StarterModelProps {
  onReady: () => void;
  onBrowseAll: () => void;
}

const StarterModel = ({ onReady, onBrowseAll }: StarterModelProps) => {
  const { colors } = useTheme();

  const task = useDownloadTask(STARTER_MODEL.id);
  const installed = useModelStore(state => state.installed[STARTER_MODEL.id]);
  const selectedModelId = useModelStore(state => state.selectedModelId);
  const startDownload = useModelStore(state => state.startDownload);
  const chooseModel = useChatStore(state => state.chooseModel);

  // The store only auto-selects when nothing is chosen yet, so make it explicit
  // for the model the user just asked for.
  useEffect(() => {
    if (installed && selectedModelId !== STARTER_MODEL.id) {
      chooseModel(STARTER_MODEL.id);
    }
  }, [chooseModel, installed, selectedModelId]);

  const ratio =
    task && task.contentLength > 0
      ? task.bytesWritten / task.contentLength
      : undefined;

  if (installed) {
    return (
      <View style={styles.block}>
        <Button mode="contained" icon="check" onPress={onReady}>
          Start chatting
        </Button>
        <Text
          variant="bodySmall"
          style={[styles.note, { color: colors.onSurfaceVariant }]}
        >
          {STARTER_MODEL.name} is ready on your device.
        </Text>
      </View>
    );
  }

  if (task) {
    const failed = task.status === 'failed';
    return (
      <View style={styles.block}>
        {failed ? (
          <Button
            mode="contained"
            icon="refresh"
            onPress={() => startDownload(STARTER_MODEL)}
          >
            Try again
          </Button>
        ) : (
          <>
            <ProgressBar
              progress={ratio ?? 0}
              indeterminate={ratio === undefined}
              style={styles.progress}
            />
            <Text
              variant="bodySmall"
              style={[styles.note, { color: colors.onSurfaceVariant }]}
            >
              {`Downloading ${formatBytes(task.bytesWritten)} of ${formatBytes(
                task.contentLength || STARTER_MODEL.sizeBytes,
              )}`}
            </Text>
          </>
        )}
        {failed && (
          <Text
            variant="bodySmall"
            style={[styles.note, { color: colors.error }]}
          >
            {task.error ?? 'Download failed'}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <Button
        mode="contained"
        icon="download"
        onPress={() => startDownload(STARTER_MODEL)}
      >
        {`Get ${STARTER_MODEL.name}`}
      </Button>
      <Text
        variant="bodySmall"
        style={[styles.note, { color: colors.onSurfaceVariant }]}
      >
        {`${formatBytes(
          STARTER_MODEL.sizeBytes,
        )} · downloads once, then works offline`}
      </Text>
      <Button compact onPress={onBrowseAll}>
        Skip
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  block: {
    alignSelf: 'stretch',
    gap: 8,
  },
  progress: {
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },
  note: {
    textAlign: 'center',
  },
});

export default StarterModel;
