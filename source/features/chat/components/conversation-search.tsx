import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { List, Searchbar, Text, useTheme } from 'react-native-paper';

import { searchMessages, type SearchHit } from '@/core/db/search-repository';

const DEBOUNCE_MS = 200;

interface ConversationSearchProps {
  autoFocus?: boolean;
  onOpen: (conversationId: string) => void;
  /** Lets the drawer swap the history list out while results are showing. */
  onSearchingChange?: (searching: boolean) => void;
}

/**
 * The snippet arrives with matches wrapped in guillemets by FTS5, which is
 * cheaper and more accurate than re-finding the term in JS — SQLite already
 * knows exactly which token matched after stemming.
 */
const Snippet = ({ text }: { text: string }) => {
  const { colors } = useTheme();

  return (
    <Text variant="bodySmall" numberOfLines={2}>
      {text.split(/«|»/).map((part, index) => (
        <Text
          key={`${index}-${part}`}
          variant="bodySmall"
          style={
            index % 2
              ? { color: colors.primary, fontWeight: '600' }
              : { color: colors.onSurfaceVariant }
          }
        >
          {part}
        </Text>
      ))}
    </Text>
  );
};

const ConversationSearch = ({
  autoFocus,
  onOpen,
  onSearchingChange,
}: ConversationSearchProps) => {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>();

  const searching = hits !== undefined;
  useEffect(() => {
    onSearchingChange?.(searching);
  }, [onSearchingChange, searching]);

  useEffect(() => {
    if (!query.trim()) {
      setHits(undefined);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void searchMessages(query)
        .then(results => !cancelled && setHits(results))
        .catch(() => !cancelled && setHits([]));
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <View style={styles.container}>
      <Searchbar
        autoFocus={autoFocus}
        value={query}
        onChangeText={setQuery}
        placeholder="Search chats"
        style={styles.search}
        inputStyle={styles.searchInput}
      />

      {hits !== undefined && (
        <ScrollView
          style={styles.results}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {hits.length === 0 ? (
            <Text
              variant="bodySmall"
              style={[styles.empty, { color: colors.onSurfaceVariant }]}
            >
              {`No messages match “${query.trim()}”`}
            </Text>
          ) : (
            hits.map(hit => (
              <List.Item
                key={hit.messageId}
                title={hit.conversationTitle}
                titleNumberOfLines={1}
                description={() => <Snippet text={hit.snippet} />}
                onPress={() => onOpen(hit.conversationId)}
                left={props => (
                  <List.Icon
                    {...props}
                    icon={
                      hit.role === 'user' ? 'account-outline' : 'robot-outline'
                    }
                  />
                )}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    // paddingVertical: 8,
  },
  search: {
    height: 44,
  },
  searchInput: {
    minHeight: 0,
    fontSize: 14,
  },
  results: {
    maxHeight: 320,
    marginTop: 4,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default ConversationSearch;
