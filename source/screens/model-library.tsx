import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Divider,
  Icon,
  List,
  SegmentedButtons,
  Searchbar,
  Text,
  useTheme,
} from 'react-native-paper';

import ModelRow from '@/components/models/model-row';
import { CATALOG, VISION_CATALOG } from '@/models/catalog';
import {
  displayNameForRepo,
  isPhoneViable,
  listRepoContents,
  modelIdFor,
  quantFromFilename,
  type RepoContents,
  searchGgufRepos,
} from '@/models/huggingface';
import useModelStore, { useInstalledOrder } from '@/stores/model-store';
import type { HfRepo } from '@/types';
import type { ModelLibraryScreenProps } from '@/navigation/types';
import { formatCount } from '@/utils/format';

type Tab = 'installed' | 'recommended' | 'search';

const TABS = [
  { value: 'installed', label: 'Installed' },
  { value: 'recommended', label: 'Suggested' },
  { value: 'search', label: 'Search' },
];

const EmptyState = ({ icon, text }: { icon: string; text: string }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Icon source={icon} size={30} color={colors.onSurfaceVariant} />
      <Text
        variant="bodyMedium"
        style={[styles.emptyText, { color: colors.onSurfaceVariant }]}
      >
        {text}
      </Text>
    </View>
  );
};

const InstalledTab = ({ onOpen }: { onOpen: (modelId: string) => void }) => {
  const order = useInstalledOrder();
  const installed = useModelStore(state => state.installed);

  if (!order.length) {
    return (
      <EmptyState
        icon="cube-outline"
        text="No models yet. Pick one from Suggested to get started."
      />
    );
  }

  return (
    <>
      {order.map(id => {
        const model = installed[id];
        if (!model) {
          return null;
        }
        return (
          <ModelRow
            key={id}
            id={id}
            name={model.name}
            subtitle={model.repo.split('/')[0]}
            file={model}
            onPress={() => onOpen(id)}
          />
        );
      })}
    </>
  );
};

const RecommendedTab = ({ onOpen }: { onOpen: (modelId: string) => void }) => (
  <>
    <List.Subheader>Text</List.Subheader>
    {CATALOG.map(model => (
      <ModelRow
        key={model.id}
        id={model.id}
        name={model.name}
        subtitle={`${model.params} · ${model.quant}`}
        file={model}
        onPress={() => onOpen(model.id)}
      />
    ))}

    <List.Subheader>Vision — can read images</List.Subheader>
    {VISION_CATALOG.map(model => (
      <ModelRow
        key={model.id}
        id={model.id}
        name={model.name}
        subtitle={`${model.params} · ${model.quant} · + projector`}
        file={model}
        onPress={() => onOpen(model.id)}
      />
    ))}
  </>
);

const RepoFiles = ({ repo }: { repo: string }) => {
  const { colors } = useTheme();
  const [contents, setContents] = useState<RepoContents>();
  const [error, setError] = useState<string>();
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setShowAll(false);
    listRepoContents(repo, controller.signal)
      .then(setContents)
      .catch((cause: Error) => {
        if (cause.name !== 'AbortError') {
          setError(cause.message);
        }
      });
    return () => controller.abort();
  }, [repo]);

  const name = useMemo(() => displayNameForRepo(repo), [repo]);

  if (error) {
    return <List.Item title={error} titleNumberOfLines={2} />;
  }

  if (!contents) {
    return (
      <View style={styles.inlineLoader}>
        <ActivityIndicator size={18} />
      </View>
    );
  }

  if (!contents.models.length) {
    return <List.Item title="No usable models here" />;
  }

  const viable = contents.models.filter(isPhoneViable);
  // Never show an empty list just because a repo uses unusual quant names.
  const shown = showAll || !viable.length ? contents.models : viable;
  const hidden = contents.models.length - shown.length;

  return (
    <>
      {contents.isVision && (
        <View style={styles.badgeRow}>
          <Icon source="image-outline" size={14} color={colors.primary} />
          <Text variant="labelSmall" style={{ color: colors.primary }}>
            Reads images · downloads include the extra vision file
          </Text>
        </View>
      )}

      {shown.map(file => (
        <ModelRow
          key={file.filename}
          id={modelIdFor(file.repo, file.filename)}
          name={name}
          subtitle={quantFromFilename(file.filename) ?? 'GGUF'}
          file={file}
        />
      ))}

      {hidden > 0 && (
        <List.Item
          title={`Show all ${contents.models.length} variants`}
          titleStyle={{ color: colors.primary }}
          left={props => <List.Icon {...props} icon="tune" />}
          onPress={() => setShowAll(true)}
        />
      )}
    </>
  );
};

const SearchTab = () => {
  const [query, setQuery] = useState('');
  const [repos, setRepos] = useState<HfRepo[]>();
  const [error, setError] = useState<string>();
  const [expanded, setExpanded] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setError(undefined);
      searchGgufRepos(query, controller.signal)
        .then(setRepos)
        .catch((cause: Error) => {
          if (cause.name !== 'AbortError') {
            setError(cause.message);
          }
        });
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <>
      <Searchbar
        value={query}
        onChangeText={setQuery}
        placeholder="Search in Hugging Face"
        style={styles.searchbar}
      />
      <View>{/* // add filters */}</View>

      {error && <EmptyState icon="cloud-off-outline" text={error} />}

      {!error && !repos && (
        <View style={styles.inlineLoader}>
          <ActivityIndicator />
        </View>
      )}

      {repos?.map(repo => (
        <View key={repo.id}>
          <List.Item
            title={repo.id}
            titleNumberOfLines={2}
            description={`${formatCount(
              repo.downloads,
            )} downloads · ${formatCount(repo.likes)} likes`}
            onPress={() =>
              setExpanded(current =>
                current === repo.id ? undefined : repo.id,
              )
            }
            right={props => (
              <List.Icon
                {...props}
                icon={expanded === repo.id ? 'chevron-up' : 'chevron-down'}
              />
            )}
          />
          {expanded === repo.id && <RepoFiles repo={repo.id} />}
          <Divider />
        </View>
      ))}
    </>
  );
};

const ModelLibrary = ({ navigation }: ModelLibraryScreenProps) => {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('installed');
  const order = useInstalledOrder();

  const initialTab = useMemo<Tab>(
    () => (order.length ? 'installed' : 'recommended'),
    [order.length],
  );

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const openDetail = useCallback(
    (modelId: string) => navigation.navigate('ModelDetail', { modelId }),
    [navigation],
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <SegmentedButtons
        style={styles.tabs}
        value={tab}
        onValueChange={value => setTab(value as Tab)}
        buttons={TABS}
      />

      {tab === 'installed' && <InstalledTab onOpen={openDetail} />}
      {tab === 'recommended' && <RecommendedTab onOpen={openDetail} />}
      {tab === 'search' && <SearchTab />}

      {tab === 'recommended' && (
        <Text
          variant="labelSmall"
          style={[styles.note, { color: colors.onSurfaceVariant }]}
        >
          Sizes are the download. Running a model needs roughly the same again
          in free memory.
        </Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingBottom: 40,
  },
  tabs: {
    margin: 16,
  },
  searchbar: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 56,
    paddingHorizontal: 32,
  },
  emptyText: {
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  inlineLoader: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  note: {
    marginTop: 16,
    marginHorizontal: 16,
    textAlign: 'center',
  },
});

export default ModelLibrary;
