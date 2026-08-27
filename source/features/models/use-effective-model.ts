import useChatStore from '@/features/chat/store';
import useModelStore from '@/features/models/store';

/**
 * Which model the open conversation actually uses: its own pin, falling back to
 * the global selection for a chat that has none yet.
 *
 * A hook rather than a store selector because it has to subscribe to both
 * stores — reading one inside the other's selector would not re-render.
 */
export function useEffectiveModel() {
  const pinnedId = useChatStore(state => {
    const activeId = state.activeConversationId;
    return activeId ? state.conversations[activeId]?.modelId : undefined;
  });
  const globalId = useModelStore(state => state.selectedModelId);
  const installed = useModelStore(state => state.installed);

  const id = pinnedId && installed[pinnedId] ? pinnedId : globalId;

  return { id, model: id ? installed[id] : undefined };
}
