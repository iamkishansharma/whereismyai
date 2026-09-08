import { useCallback } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Divider, Icon, List, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import SheetBackdrop from '@/shared/ui/sheet-backdrop';
import { formatBytes } from '@/shared/utils/format';
import useChatStore from '@/features/chat/store';
import type { ChatStackNavigation } from '@/navigation/chat-navigator';
import useModelStore, { useInstalledOrder } from '../store';
import { useEffectiveModel } from '../use-effective-model';
import { closeModelPicker, modelPickerSheetRef } from '../use-model-picker';
import BottomSheetHeader from './bottom-sheet-header';

// Keeps the sheet hugging its content for the handful of models most people
// install, without letting a long list cover the whole chat.
const MAX_HEIGHT_RATIO = 0.75;

const ModelPickerSheet = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const navigation = useNavigation<ChatStackNavigation>();

  const order = useInstalledOrder();
  const installed = useModelStore(state => state.installed);
  const chooseModel = useChatStore(state => state.chooseModel);
  const selectedModelId = useEffectiveModel().id;

  const choose = useCallback(
    (modelId: string) => {
      chooseModel(modelId);
      closeModelPicker();
    },
    [chooseModel],
  );

  // Dismiss first — leaving the sheet up behind a pushed screen means it is
  // still sitting there when the user comes back.
  const goTo = useCallback((action: () => void) => {
    closeModelPicker();
    action();
  }, []);

  return (
    <BottomSheetModal
      ref={modelPickerSheetRef}
      enablePanDownToClose
      maxDynamicContentSize={height * MAX_HEIGHT_RATIO}
      backdropComponent={SheetBackdrop}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.outline }}
      topInset={insets.top}
    >
      <BottomSheetView style={{ paddingBottom: insets.bottom + 12 }}>
        <BottomSheetHeader title="Choose model" onClose={closeModelPicker} />

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
                    color={
                      isSelected ? colors.primary : colors.onSurfaceVariant
                    }
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
          left={props => (
            <List.Icon {...props} icon="folder-download-outline" />
          )}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => goTo(() => navigation.navigate('ModelLibrary'))}
        />
        <List.Item
          title="Generation settings"
          description="System prompt and sampling"
          left={props => <List.Icon {...props} icon="tune" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() =>
            goTo(() => navigation.navigate('GenerationSettings', {}))
          }
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyText: {
    textAlign: 'center',
  },
});

export default ModelPickerSheet;
