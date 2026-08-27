import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Divider, List, Text, useTheme } from 'react-native-paper';
import dayjs from 'dayjs';

import { readModelInfo } from '@/llama/engine';
import { repoUrl } from '@/models/huggingface';
import useModelStore, { useInstalledModel } from '@/stores/model-store';
import type { ModelDetailScreenProps } from '@/navigation/types';
import { formatBytes, formatParams } from '@/utils/format';

const Row = ({ label, value }: { label: string; value?: string }) =>
  value ? <List.Item title={value} description={label} /> : null;

const ModelDetail = ({ navigation, route }: ModelDetailScreenProps) => {
  const { modelId } = route.params;
  const { colors } = useTheme();
  const model = useInstalledModel(modelId);
  const isSelected = useModelStore(state => state.selectedModelId === modelId);
  const selectModel = useModelStore(state => state.selectModel);
  const deleteModel = useModelStore(state => state.deleteModel);
  const setModelInfo = useModelStore(state => state.setModelInfo);

  const [infoError, setInfoError] = useState<string>();

  useEffect(() => {
    if (!model || model.info) {
      return;
    }
    readModelInfo(model.path)
      .then(info => setModelInfo(model.id, info))
      .catch((cause: Error) => setInfoError(cause.message));
  }, [model, setModelInfo]);

  if (!model) {
    return (
      <View style={styles.missing}>
        <Text variant="bodyLarge">This model is no longer installed.</Text>
      </View>
    );
  }

  const confirmDelete = () =>
    Alert.alert(model.name, 'Delete this model from your device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteModel(model.id);
          navigation.goBack();
        },
      },
    ]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text variant="headlineSmall">{model.name}</Text>
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          {model.repo}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          mode={isSelected ? 'outlined' : 'contained'}
          icon={isSelected ? 'check' : 'play'}
          onPress={() => selectModel(model.id)}
          disabled={isSelected}
        >
          {isSelected ? 'Active model' : 'Use this model'}
        </Button>
        <Button
          mode="text"
          icon="tune"
          onPress={() =>
            navigation.navigate('GenerationSettings', { modelId: model.id })
          }
        >
          Settings
        </Button>
      </View>

      <Divider />

      <List.Section>
        <List.Subheader>Model</List.Subheader>
        <Row label="Architecture" value={model.info?.architecture} />
        <Row label="Parameters" value={formatParams(model.info?.paramCount)} />
        <Row
          label="Trained context length"
          value={
            model.info?.contextLength
              ? `${model.info.contextLength.toLocaleString()} tokens`
              : undefined
          }
        />
        <Row label="Quantisation" value={model.info?.quant} />
        {infoError && (
          <List.Item
            title="Could not read GGUF metadata"
            description={infoError}
            descriptionNumberOfLines={3}
          />
        )}
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>On this device</List.Subheader>
        <Row
          label="Size on disk"
          value={formatBytes(
            model.sizeBytes + (model.mmproj?.sizeBytes ?? 0),
          )}
        />
        <Row label="File" value={model.filename} />
        <Row
          label="Reads images"
          value={model.mmprojPath ? 'Yes' : 'No'}
        />
        {model.mmproj && (
          <Row
            label="Vision projector"
            value={`${model.mmproj.filename} · ${formatBytes(
              model.mmproj.sizeBytes,
            )}`}
          />
        )}
        <Row
          label="Downloaded"
          value={dayjs(model.downloadedAt).format('MMM D, YYYY [at] h:mm A')}
        />
        <Row label="Source" value={repoUrl(model.repo)} />
      </List.Section>

      <Divider />

      <List.Item
        title="Delete model"
        titleStyle={{ color: colors.error }}
        left={props => (
          <List.Icon {...props} icon="trash-can-outline" color={colors.error} />
        )}
        onPress={confirmDelete}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
});

export default ModelDetail;
