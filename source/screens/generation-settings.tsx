import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Divider,
  HelperText,
  IconButton,
  List,
  Text,
  useTheme,
} from 'react-native-paper';

import { DEFAULT_GENERATION_SETTINGS } from '@/constants';
import useModelStore, {
  useInstalledModel,
  useSettings,
} from '@/stores/model-store';
import type { GenerationSettings } from '@/types';
import type { GenerationSettingsScreenProps } from '@/navigation/types';
import { EnrichedMarkdownTextInput } from 'react-native-enriched-markdown';

interface Knob {
  key: keyof Omit<GenerationSettings, 'systemPrompt'>;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  decimals?: number;
}

const KNOBS: Knob[] = [
  {
    key: 'temperature',
    label: 'Temperature',
    hint: 'Lower is more predictable, higher more creative.',
    min: 0,
    max: 2,
    step: 0.1,
    decimals: 1,
  },
  {
    key: 'topP',
    label: 'Top P',
    hint: 'Nucleus sampling cutoff.',
    min: 0.05,
    max: 1,
    step: 0.05,
    decimals: 2,
  },
  {
    key: 'topK',
    label: 'Top K',
    hint: 'Consider only the K most likely tokens.',
    min: 0,
    max: 100,
    step: 5,
  },
  {
    key: 'repeatPenalty',
    label: 'Repeat penalty',
    hint: 'Above 1 discourages repeating itself.',
    min: 1,
    max: 1.5,
    step: 0.05,
    decimals: 2,
  },
  {
    key: 'nPredict',
    label: 'Max reply tokens',
    hint: 'Upper bound on reply length.',
    min: 64,
    max: 4096,
    step: 64,
  },
  {
    key: 'nCtx',
    label: 'Context window',
    hint: 'Tokens of history the model sees. Costs memory. Reloads the model.',
    min: 512,
    max: 8192,
    step: 512,
  },
  {
    key: 'nGpuLayers',
    label: 'GPU layers',
    hint: '0 is CPU only. High offloads everything available. Reloads the model.',
    min: 0,
    max: 99,
    step: 1,
  },
];

const round = (value: number, decimals = 0) =>
  Number(value.toFixed(decimals + 2)) === value
    ? Number(value.toFixed(decimals))
    : Number(value.toFixed(decimals));

const KnobRow = ({
  knob,
  value,
  onChange,
}: {
  knob: Knob;
  value: number;
  onChange: (next: number) => void;
}) => {
  const { colors } = useTheme();

  const step = (direction: 1 | -1) => {
    const next = round(value + direction * knob.step, knob.decimals ?? 0);
    onChange(Math.min(knob.max, Math.max(knob.min, next)));
  };

  return (
    <View style={styles.knob}>
      <View style={styles.knobHeader}>
        <View style={styles.knobLabel}>
          <Text variant="bodyLarge">{knob.label}</Text>
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            {knob.hint}
          </Text>
        </View>

        <View style={styles.stepper}>
          <IconButton
            icon="minus"
            size={18}
            mode="outlined"
            disabled={value <= knob.min}
            onPress={() => step(-1)}
            accessibilityLabel={`Decrease ${knob.label}`}
          />
          <Text variant="titleMedium" style={styles.value}>
            {value.toFixed(knob.decimals ?? 0)}
          </Text>
          <IconButton
            icon="plus"
            size={18}
            mode="outlined"
            disabled={value >= knob.max}
            onPress={() => step(1)}
            accessibilityLabel={`Increase ${knob.label}`}
          />
        </View>
      </View>
    </View>
  );
};

const GenerationSettingsScreen = ({ route }: GenerationSettingsScreenProps) => {
  const { colors } = useTheme();
  const selectedModelId = useModelStore(state => state.selectedModelId);
  const modelId = route.params?.modelId ?? selectedModelId;

  const model = useInstalledModel(modelId);
  const settings = useSettings(modelId);
  const updateSettings = useModelStore(state => state.updateSettings);
  const resetSettings = useModelStore(state => state.resetSettings);

  const patch = useCallback(
    (change: Partial<GenerationSettings>) => {
      if (modelId) {
        updateSettings(modelId, change);
      }
    },
    [modelId, updateSettings],
  );

  if (!modelId) {
    return (
      <View style={styles.missing}>
        <Text variant="bodyLarge" style={styles.missingText}>
          Select a model first — settings are saved per model.
        </Text>
      </View>
    );
  }

  const isDefault =
    JSON.stringify(settings) === JSON.stringify(DEFAULT_GENERATION_SETTINGS);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <List.Section>
        <List.Subheader>System prompt</List.Subheader>
        <View style={styles.promptBlock}>
          <EnrichedMarkdownTextInput
            defaultValue={settings.systemPrompt}
            onChangeText={systemPrompt => patch({ systemPrompt })}
            placeholder={DEFAULT_GENERATION_SETTINGS.systemPrompt}
            multiline
            style={{
              ...styles.prompt,
              borderColor: colors.outline,
              color: colors.onSurface,
            }}
          />
          <HelperText type="info" visible>
            Sent ahead of every conversation with this model. Takes effect on
            your next message.
          </HelperText>
        </View>
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Sampling</List.Subheader>
        {KNOBS.map(knob => (
          <KnobRow
            key={knob.key}
            knob={knob}
            value={settings[knob.key]}
            onChange={next => patch({ [knob.key]: next })}
          />
        ))}
      </List.Section>

      <Divider />

      <View style={styles.footer}>
        <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>
          {model ? `Applies to ${model.name}` : 'Applies to the selected model'}
        </Text>
        <Button
          mode="outlined"
          icon="restore"
          disabled={isDefault}
          onPress={() => resetSettings(modelId)}
        >
          Reset to defaults
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingBottom: 40,
  },
  promptBlock: {
    paddingHorizontal: 16,
  },
  prompt: {
    minHeight: 110,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
  },
  knob: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  knobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  knobLabel: {
    flex: 1,
    gap: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    minWidth: 52,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  missingText: {
    textAlign: 'center',
  },
});

export default GenerationSettingsScreen;
