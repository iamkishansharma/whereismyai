import { useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_GENERATION_SETTINGS } from './constants';
import { fileExists, removeFile } from '@/core/fs';
import {
  assetPath,
  cancelModelDownload,
  modelPath,
  projectorPath,
  startModelDownload,
} from './downloader';
import { describeError, readModelInfo, unload } from '@/core/llama';
import { resolveContextSize } from '@/core/llama';
import type {
  DownloadTask,
  EngineState,
  GenerationSettings,
  InstalledModel,
  InstalledVoiceAsset,
  ModelFile,
  ModelInfo,
  ProjectorFile,
  VoiceAsset,
} from '@/types';

interface ModelStore {
  installed: Record<string, InstalledModel>;
  installedOrder: string[];
  selectedModelId?: string;
  downloads: Record<string, DownloadTask>;
  /** Only the keys the user overrode; everything else is derived per model. */
  settingsByModel: Record<string, Partial<GenerationSettings>>;
  /**
   * Speech, VAD, TTS and vocoder files, kept apart from `installed` on purpose:
   * everything in there is assumed loadable by `initLlama` as a chat model, and
   * a whisper `.bin` would sail through the picker and fail on first use.
   */
  voiceInstalled: Record<string, InstalledVoiceAsset>;

  engineState: EngineState;
  engineError?: string;
  loadProgress: number;
  visionActive: boolean;

  startDownload: (
    model: ModelFile & { id: string; name: string; mmproj?: ProjectorFile },
  ) => void;
  cancelDownload: (modelId: string) => void;
  deleteModel: (modelId: string) => Promise<void>;
  /** One asset, or every file a capability needs, fetched as one download. */
  startVoiceDownload: (assets: VoiceAsset | VoiceAsset[]) => void;
  deleteVoiceAsset: (assetId: string) => Promise<void>;
  getVoiceAsset: (assetId: string) => InstalledVoiceAsset | undefined;
  selectModel: (modelId?: string) => void;
  ensureModelInfo: (modelId: string) => Promise<void>;
  setModelInfo: (modelId: string, info: ModelInfo) => void;
  getModel: (modelId: string) => InstalledModel | undefined;
  getSelectedModel: () => InstalledModel | undefined;
  updateSettings: (modelId: string, patch: Partial<GenerationSettings>) => void;
  resetSettings: (modelId: string) => void;

  setEngineState: (state: EngineState, error?: string) => void;
  setVisionActive: (active: boolean) => void;
  setLoadProgress: (progress: number) => void;
  pruneMissingModels: () => Promise<void>;
}

/**
 * Defaults with the context window derived from what this model declares in its
 * GGUF header, so a 32k model isn't held to a flat 2048. Only keys the user
 * actually changed are stored, which is what lets this stay dynamic.
 */
function resolveSettings(
  model: InstalledModel | undefined,
  stored: Partial<GenerationSettings> | undefined,
): GenerationSettings {
  return {
    ...DEFAULT_GENERATION_SETTINGS,
    ...(model ? { nCtx: resolveContextSize(model) } : null),
    ...stored,
  };
}

const useModelStore = create<ModelStore>()(
  persist(
    (set, get) => ({
      installed: {},
      installedOrder: [],
      selectedModelId: undefined,
      downloads: {},
      settingsByModel: {},
      voiceInstalled: {},
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

        const patch = (partial: Partial<ModelStore['downloads'][string]>) =>
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
              const remaining = { ...state.downloads };
              delete remaining[model.id];
              return {
                downloads: remaining,
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
                const remaining = { ...state.downloads };
                delete remaining[model.id];
                return { downloads: remaining };
              });
              return;
            }
            patch({ status: 'failed', error: message });
          });
      },

      /**
       * Fetch every file a voice capability needs, as one download.
       *
       * Reuses the same `downloads` map as chat models — ids are globally
       * unique via `modelIdFor`, so `useDownloadTask` and the progress bar work
       * unchanged. Progress is reported against the combined size so the bar
       * never resets between parts, the same way a vision model and its
       * projector behave. Unlike `startDownload` it never touches
       * `selectedModelId`: giving the assistant a voice must not change which
       * model answers.
       */
      startVoiceDownload: assets => {
        const parts = Array.isArray(assets) ? assets : [assets];
        const { downloads, voiceInstalled } = get();
        const primary = parts[0];
        if (!primary || downloads[primary.id]) {
          return;
        }

        // A companion already on disk (the detector shared by every speech
        // model, say) is not worth fetching twice.
        const missing = parts.filter(asset => !voiceInstalled[asset.id]);
        if (!missing.length) {
          return;
        }

        const totalBytes = missing.reduce(
          (total, asset) => total + asset.sizeBytes,
          0,
        );

        set(state => ({
          downloads: {
            ...state.downloads,
            [primary.id]: {
              modelId: primary.id,
              bytesWritten: 0,
              contentLength: totalBytes,
              status: 'queued',
            },
          },
        }));

        const patch = (partial: Partial<DownloadTask>) =>
          set(state => {
            const task = state.downloads[primary.id];
            if (!task) {
              return state;
            }
            return {
              downloads: {
                ...state.downloads,
                [primary.id]: { ...task, ...partial },
              },
            };
          });

        let completedBytes = 0;

        const downloadPart = (asset: VoiceAsset) =>
          startModelDownload({
            target: assetPath(asset.id, asset.extension),
            repo: asset.repo,
            filename: asset.filename,
            onBegin: jobId => patch({ jobId, status: 'downloading' }),
            onProgress: bytesWritten =>
              patch({
                bytesWritten: completedBytes + bytesWritten,
                contentLength: totalBytes,
              }),
          }).then(path => {
            completedBytes += asset.sizeBytes;
            patch({ bytesWritten: completedBytes });
            return { asset, path };
          });

        (async () => {
          const installed: InstalledVoiceAsset[] = [];
          // Sequential rather than parallel: two large files over one
          // connection just make each other slower, and a combined progress
          // bar only reads honestly if parts land in order.
          for (const asset of missing) {
            const { path } = await downloadPart(asset);
            installed.push({ ...asset, path, downloadedAt: Date.now() });
          }
          return installed;
        })()
          .then(installedAssets => {
            set(state => {
              const remaining = { ...state.downloads };
              delete remaining[primary.id];
              const next = { ...state.voiceInstalled };
              installedAssets.forEach(asset => {
                next[asset.id] = asset;
              });
              return { downloads: remaining, voiceInstalled: next };
            });
          })
          .catch(error => {
            // Half a bundle is no use, so nothing partial is left behind.
            missing.forEach(asset =>
              removeFile(assetPath(asset.id, asset.extension)).catch(() => {}),
            );

            const message = describeError(error);
            if (message.includes('aborted') || message.includes('cancel')) {
              set(state => {
                const remaining = { ...state.downloads };
                delete remaining[primary.id];
                return { downloads: remaining };
              });
              return;
            }
            patch({ status: 'failed', error: message });
          });
      },

      /**
       * Remove a voice file from disk.
       *
       * Callers are expected to have stopped any voice session first — nothing
       * here can tell whether whisper or the vocoder still holds the file open.
       */
      deleteVoiceAsset: async assetId => {
        const asset = get().voiceInstalled[assetId];
        if (!asset) {
          return;
        }
        await removeFile(asset.path);
        set(state => {
          const voiceInstalled = { ...state.voiceInstalled };
          delete voiceInstalled[assetId];
          return { voiceInstalled };
        });
      },

      getVoiceAsset: assetId => get().voiceInstalled[assetId],

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

      // The GGUF header carries the model's real context length, and nothing
      // else reads it on the path to a first chat — the detail screen was the
      // only caller, so a model installed from the picker never had it.
      ensureModelInfo: async modelId => {
        const model = get().installed[modelId];
        if (!model || model.info) {
          return;
        }
        try {
          get().setModelInfo(modelId, await readModelInfo(model.path));
        } catch {
          // Metadata is an optimisation, not a requirement — the defaults hold.
        }
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
      // Only the keys the user changed. Storing a full copy of the defaults
      // would freeze nCtx at whatever it was the first time they opened the
      // screen, and the derived context window would never apply again.
      updateSettings: (modelId, patch) =>
        set(state => ({
          settingsByModel: {
            ...state.settingsByModel,
            [modelId]: { ...state.settingsByModel[modelId], ...patch },
          },
        })),

      resetSettings: modelId =>
        set(state => {
          const settingsByModel = { ...state.settingsByModel };
          delete settingsByModel[modelId];
          return { settingsByModel };
        }),

      setEngineState: (engineState, engineError) =>
        set({ engineState, engineError }),

      setVisionActive: visionActive => set({ visionActive }),

      setLoadProgress: loadProgress => set({ loadProgress }),

      pruneMissingModels: async () => {
        const { installed, voiceInstalled } = get();
        const missing: string[] = [];

        for (const model of Object.values(installed)) {
          const present =
            (await fileExists(model.path)) &&
            (!model.mmprojPath || (await fileExists(model.mmprojPath)));
          if (!present) {
            missing.push(model.id);
          }
        }

        // Voice files live in the same directory and vanish the same ways —
        // an OS cleanup, a restore onto a new device, a manual delete.
        const missingVoice: string[] = [];
        for (const asset of Object.values(voiceInstalled)) {
          if (!(await fileExists(asset.path))) {
            missingVoice.push(asset.id);
          }
        }

        if (missingVoice.length) {
          set(state => {
            const next = { ...state.voiceInstalled };
            missingVoice.forEach(id => delete next[id]);
            return { voiceInstalled: next };
          });
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
        voiceInstalled: state.voiceInstalled,
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

export const useVoiceInstalled = () =>
  useModelStore(state => state.voiceInstalled);

export const useInstalledVoiceAsset = (assetId?: string) =>
  useModelStore(state => (assetId ? state.voiceInstalled[assetId] : undefined));

export const useEngineState = () => useModelStore(state => state.engineState);

export function settingsFor(modelId?: string): GenerationSettings {
  if (!modelId) {
    return DEFAULT_GENERATION_SETTINGS;
  }
  const state = useModelStore.getState();
  return resolveSettings(
    state.installed[modelId],
    state.settingsByModel[modelId],
  );
}

export const useSettings = (modelId?: string) => {
  const stored = useModelStore(state =>
    modelId ? state.settingsByModel[modelId] : undefined,
  );
  const model = useModelStore(state =>
    modelId ? state.installed[modelId] : undefined,
  );
  return useMemo(() => resolveSettings(model, stored), [model, stored]);
};
