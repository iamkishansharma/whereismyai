import { useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_GENERATION_SETTINGS } from '@/constants';
import {
  cancelModelDownload,
  fileExists,
  modelPath,
  projectorPath,
  removeFile,
  startModelDownload,
} from '@/models/downloader';
import { describeError, unload } from '@/llama/engine';
import type {
  GenerationSettings,
  InstalledModel,
  ModelStoreProps,
} from '@/types';

const useModelStore = create<ModelStoreProps>()(
  persist(
    (set, get) => ({
      installed: {},
      installedOrder: [],
      selectedModelId: undefined,
      downloads: {},
      settingsByModel: {},
      engineState: 'idle',
      engineError: undefined,
      loadProgress: 0,
      visionActive: false,

      startDownload: model => {
        const { downloads, installed } = get();
        if (downloads[model.id] || installed[model.id]) {
          return;
        }

        // A vision model is two files. Progress is reported against their
        // combined size so the bar never resets between parts.
        const totalBytes = model.sizeBytes + (model.mmproj?.sizeBytes ?? 0);

        set(state => ({
          downloads: {
            ...state.downloads,
            [model.id]: {
              modelId: model.id,
              bytesWritten: 0,
              contentLength: totalBytes,
              status: 'queued',
            },
          },
        }));

        const patch = (
          partial: Partial<ModelStoreProps['downloads'][string]>,
        ) =>
          set(state => {
            const task = state.downloads[model.id];
            if (!task) {
              return state;
            }
            return {
              downloads: {
                ...state.downloads,
                [model.id]: { ...task, ...partial },
              },
            };
          });

        let completedBytes = 0;

        const downloadPart = (
          target: string,
          filename: string,
          partSize: number,
        ) =>
          startModelDownload({
            target,
            repo: model.repo,
            filename,
            onBegin: jobId => patch({ jobId, status: 'downloading' }),
            onProgress: bytesWritten =>
              patch({
                bytesWritten: completedBytes + bytesWritten,
                contentLength: totalBytes,
              }),
          }).then(path => {
            completedBytes += partSize;
            patch({ bytesWritten: completedBytes });
            return path;
          });

        (async () => {
          const path = await downloadPart(
            modelPath(model.id),
            model.filename,
            model.sizeBytes,
          );

          // Only register once both parts have landed — a model whose
          // projector is missing loads fine and then fails on the first image.
          let mmprojPath: string | undefined;
          if (model.mmproj) {
            mmprojPath = await downloadPart(
              projectorPath(model.id),
              model.mmproj.filename,
              model.mmproj.sizeBytes,
            );
          }

          return { path, mmprojPath };
        })()
          .then(({ path, mmprojPath }) => {
            const entry: InstalledModel = {
              id: model.id,
              name: model.name,
              repo: model.repo,
              filename: model.filename,
              sizeBytes: model.sizeBytes,
              path,
              downloadedAt: Date.now(),
              mmproj: model.mmproj,
              mmprojPath,
            };

            set(state => {
              const downloads = { ...state.downloads };
              delete downloads[model.id];
              return {
                downloads,
                installed: { ...state.installed, [model.id]: entry },
                installedOrder: [
                  model.id,
                  ...state.installedOrder.filter(id => id !== model.id),
                ],
                selectedModelId: state.selectedModelId ?? model.id,
              };
            });
          })
          .catch(error => {
            // A cancelled or failed pair must not leave half of itself behind.
            void removeFile(modelPath(model.id));
            void removeFile(projectorPath(model.id));

            const message = describeError(error);
            if (message.includes('aborted') || message.includes('cancel')) {
              set(state => {
                const downloads = { ...state.downloads };
                delete downloads[model.id];
                return { downloads };
              });
              return;
            }
            patch({ status: 'failed', error: message });
          });
      },

      cancelDownload: modelId => {
        const task = get().downloads[modelId];
        if (task?.jobId !== undefined) {
          cancelModelDownload(task.jobId);
        }
        set(state => {
          const downloads = { ...state.downloads };
          delete downloads[modelId];
          return { downloads };
        });
      },

      deleteModel: async modelId => {
        const model = get().installed[modelId];
        if (!model) {
          return;
        }

        if (get().selectedModelId === modelId) {
          await unload();
        }
        await removeFile(model.path);
        if (model.mmprojPath) {
          await removeFile(model.mmprojPath);
        }

        set(state => {
          const installed = { ...state.installed };
          delete installed[modelId];
          const settingsByModel = { ...state.settingsByModel };
          delete settingsByModel[modelId];

          const installedOrder = state.installedOrder.filter(
            id => id !== modelId,
          );

          return {
            installed,
            settingsByModel,
            installedOrder,
            selectedModelId:
              state.selectedModelId === modelId
                ? installedOrder[0]
                : state.selectedModelId,
            engineState:
              state.selectedModelId === modelId ? 'idle' : state.engineState,
            visionActive:
              state.selectedModelId === modelId ? false : state.visionActive,
          };
        });
      },

      selectModel: modelId => {
        if (get().selectedModelId === modelId) {
          return;
        }
        void unload();
        set({
          selectedModelId: modelId,
          engineState: 'idle',
          engineError: undefined,
          loadProgress: 0,
          visionActive: false,
        });
      },

      setModelInfo: (modelId, info) =>
        set(state => {
          const model = state.installed[modelId];
          if (!model) {
            return state;
          }
          return {
            installed: {
              ...state.installed,
              [modelId]: { ...model, info },
            },
          };
        }),
      getModel: modelId => get().installed[modelId],
      getSelectedModel: () => {
        const selectedModelId = get().selectedModelId;
        return selectedModelId ? get().installed[selectedModelId] : undefined;
      },
      updateSettings: (modelId, patch) =>
        set(state => ({
          settingsByModel: {
            ...state.settingsByModel,
            [modelId]: {
              ...DEFAULT_GENERATION_SETTINGS,
              ...state.settingsByModel[modelId],
              ...patch,
            },
          },
        })),

      resetSettings: modelId =>
        set(state => ({
          settingsByModel: {
            ...state.settingsByModel,
            [modelId]: { ...DEFAULT_GENERATION_SETTINGS },
          },
        })),

      setEngineState: (engineState, engineError) =>
        set({ engineState, engineError }),

      setVisionActive: visionActive => set({ visionActive }),

      setLoadProgress: loadProgress => set({ loadProgress }),

      pruneMissingModels: async () => {
        const { installed } = get();
        const missing: string[] = [];

        for (const model of Object.values(installed)) {
          const present =
            (await fileExists(model.path)) &&
            (!model.mmprojPath || (await fileExists(model.mmprojPath)));
          if (!present) {
            missing.push(model.id);
          }
        }

        if (!missing.length) {
          return;
        }

        set(state => {
          const next = { ...state.installed };
          missing.forEach(id => delete next[id]);
          const installedOrder = state.installedOrder.filter(
            id => !missing.includes(id),
          );
          return {
            installed: next,
            installedOrder,
            selectedModelId:
              state.selectedModelId && missing.includes(state.selectedModelId)
                ? installedOrder[0]
                : state.selectedModelId,
          };
        });
      },
    }),
    {
      name: 'model-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        installed: state.installed,
        installedOrder: state.installedOrder,
        selectedModelId: state.selectedModelId,
        settingsByModel: state.settingsByModel,
      }),
      onRehydrateStorage: () => rehydrated => {
        void rehydrated?.pruneMissingModels();
      },
    },
  ),
);

export default useModelStore;

export const useInstalledOrder = () =>
  useModelStore(state => state.installedOrder);

export const useInstalledModel = (modelId?: string) =>
  useModelStore(state => (modelId ? state.installed[modelId] : undefined));

export const useSelectedModel = () =>
  useModelStore(state =>
    state.selectedModelId ? state.installed[state.selectedModelId] : undefined,
  );

export const useDownloadTask = (modelId: string) =>
  useModelStore(state => state.downloads[modelId]);

export const useEngineState = () => useModelStore(state => state.engineState);

export function settingsFor(modelId?: string): GenerationSettings {
  if (!modelId) {
    return DEFAULT_GENERATION_SETTINGS;
  }
  return {
    ...DEFAULT_GENERATION_SETTINGS,
    ...useModelStore.getState().settingsByModel[modelId],
  };
}

export const useSettings = (modelId?: string) => {
  const stored = useModelStore(state =>
    modelId ? state.settingsByModel[modelId] : undefined,
  );
  return useMemo(
    () => ({ ...DEFAULT_GENERATION_SETTINGS, ...stored }),
    [stored],
  );
};
