import { ScrollView, StyleSheet, View } from 'react-native';
import { Divider, Icon, List, Text, useTheme } from 'react-native-paper';

import useModelStore, { useInstalledOrder } from '@/stores/model-store';
import useChatStore, { useConversationModelId } from '@/stores/chat-store';
import type { ModelPickerScreenProps } from '@/navigation/types';
import { formatBytes } from '@/utils/format';

const ModelPicker = ({ navigation }: ModelPickerScreenProps) => {
  const { colors } = useTheme();
  const order = useInstalledOrder();
  const installed = useModelStore(state => state.installed);
  const globalModelId = useModelStore(state => state.selectedModelId);
  const selectModel = useModelStore(state => state.selectModel);

  const conversationId = useChatStore(state => state.activeConversationId);
  const conversationModelId = useConversationModelId(conversationId);
  const setConversationModel = useChatStore(
    state => state.setConversationModel,
  );

  const selectedModelId = conversationModelId ?? globalModelId;

  const choose = (id: string) => {
    selectModel(id);
    if (conversationId) {
      setConversationModel(conversationId, id);
    }
    navigation.goBack();
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      {order.length === 0 ? (
        <View style={styles.empty}>
          <Icon
            source="cube-outline"
            size={30}
            color={colors.onSurfaceVariant}
          />
          <Text
            variant="bodyMedium"
            style={[styles.emptyText, { color: colors.onSurfaceVariant }]}
          >
            No models on this device yet.
          </Text>
        </View>
      ) : (
        order.map(id => {
          const model = installed[id];
          if (!model) {
            return null;
          }
          const isSelected = id === selectedModelId;
          return (
            <List.Item
              key={id}
              title={model.name}
              titleNumberOfLines={1}
              description={`${model.repo.split('/')[0]} · ${formatBytes(
                model.sizeBytes,
              )}`}
              onPress={() => choose(id)}
              left={props => (
                <List.Icon
                  {...props}
                  icon={isSelected ? 'check-circle' : 'circle-outline'}
                  color={isSelected ? colors.primary : colors.onSurfaceVariant}
                />
              )}
            />
          );
        })
      )}

      <Divider />

      <List.Item
        title="Manage models"
        description="Download, inspect and delete"
        left={props => <List.Icon {...props} icon="folder-download-outline" />}
        right={props => <List.Icon {...props} icon="chevron-right" />}
        onPress={() => navigation.replace('ModelLibrary')}
      />

      <List.Item
        title="Generation settings"
        description="System prompt and sampling"
        left={props => <List.Icon {...props} icon="tune" />}
        right={props => <List.Icon {...props} icon="chevron-right" />}
        onPress={() => navigation.replace('GenerationSettings', {})}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyText: {
    textAlign: 'center',
  },
});

export default ModelPicker;
