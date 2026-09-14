import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import GradientText from '@/shared/ui/gradient-text';

import useModelStore from '@/features/models/store';
import { useEffectiveModel } from '@/features/models/use-effective-model';
import { openModelPicker } from '@/features/models/use-model-picker';
import type { ChatStackNavigation } from '@/navigation/chat-navigator';
import { formatBytes } from '@/shared/utils/format';

const ChatWelcome = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<ChatStackNavigation>();

  const selectedModel = useEffectiveModel().model;
  const engineState = useModelStore(state => state.engineState);
  const visionActive = useModelStore(state => state.visionActive);

  const hasProjector = Boolean(selectedModel?.mmprojPath);
  const readsImages = engineState === 'ready' ? visionActive : hasProjector;

  const status = selectedModel
    ? [
        formatBytes(
          selectedModel.sizeBytes + (selectedModel.mmproj?.sizeBytes ?? 0),
        ),
        readsImages ? 'reads images' : 'text only',
      ].join(' · ')
    : 'Tap to choose one';

  return (
    <View style={styles.content}>
      <Animated.View
        entering={FadeInDown.duration(420)}
        style={styles.headline}
      >
        <GradientText fontSize={28}>Where is my AI?</GradientText>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(90).duration(420)}>
        <Text
          variant="bodyMedium"
          style={[styles.subtitle, { color: colors.onSurfaceVariant }]}
        >
          Runs entirely on this device. Nothing you type or attach leaves it.
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(180).duration(420)}
        style={styles.cardWrap}
      >
        <TouchableRipple
          onPress={() => {
            // A model already chosen means the sheet is the quick way to swap;
            // with none installed the library is the only useful destination.
            if (selectedModel) {
              openModelPicker();
            } else {
              navigation.navigate('ModelLibrary');
            }
          }}
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: selectedModel
                ? colors.outlineVariant
                : colors.primary,
              display: selectedModel ? 'none' : 'flex',
            },
          ]}
          accessibilityLabel={
            selectedModel ? 'Change model' : 'Choose a model to get started'
          }
        >
          <View style={styles.cardRow}>
            <Icon
              source={selectedModel ? 'cube-outline' : 'download-outline'}
              size={22}
              color={selectedModel ? colors.onSurfaceVariant : colors.primary}
            />
            <View style={styles.cardText}>
              <Text variant="titleSmall" numberOfLines={1}>
                {selectedModel?.name ?? 'Choose a model'}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: colors.onSurfaceVariant }}
                numberOfLines={1}
              >
                {status}
              </Text>
            </View>
            <Icon
              source="chevron-right"
              size={20}
              color={colors.onSurfaceVariant}
            />
          </View>
        </TouchableRipple>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 72,
  },
  headline: {
    alignSelf: 'stretch',
  },
  cardWrap: {
    alignSelf: 'stretch',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 6,
  },
  card: {
    marginTop: 28,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
});

export default ChatWelcome;
