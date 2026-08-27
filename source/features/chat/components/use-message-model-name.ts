import useModelStore from '@/features/models/store';

/**
 * The display name of the model that produced a message.
 *
 * Subscribes to that one name rather than the whole model store: every row in
 * the transcript calls this, and a download in progress writes to the store
 * many times a second.
 */
export function useMessageModelName(modelId?: string): string {
  return useModelStore(state =>
    modelId ? state.installed[modelId]?.name ?? modelId : '',
  );
}
