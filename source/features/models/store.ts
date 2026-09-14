import { useMemo } from 'react';
import { create } from 'zustand';

import * as modelRepo from '@/core/db/model-repository';
import { loadAppState } from '@/core/db/app-state-repository';
import { DEFAULT_GENERATION_SETTINGS, systemPromptFor } from './constants';
import { fileExists, removeFile } from '@/core/fs';
import {
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
  ModelFile,
  ModelInfo,
  ProjectorFile,
} from '@/types';

interface ModelStore {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  installed: Record<string, InstalledModel>;
  installedOrder: string[];
  selectedModelId?: string;
  downloads: Record<string, DownloadTask>;
  /** Only the keys the user overrode; everything else is derived per model. */
  settingsByModel: Record<string, Partial<GenerationSettings>>;

  engineState: EngineState;
  engineError?: string;
  loadProgress: number;
  visionActive: boolean;

  startDownload: (
    model: ModelFile & { id: string; name: string; mmproj?: ProjectorFile },
  ) => void;
  cancelDownload: (modelId: string) => void;
  deleteModel: (modelId: string) => Promise<void>;
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
    ...(model
      ? {
          nCtx: resolveContextSize(model),
          // Small models parrot a long system prompt instead of following it,
          // so how much instruction they are given scales with the model.
          systemPrompt: systemPromptFor(model.sizeBytes),
        }
      : null),
    ...stored,
  };
}

const useModelStore = create<ModelStore>()((set, get) => ({
  hydrated: false,
  installed: {},
  installedOrder: [],
  selectedModelId: undefined,
  downloads: {},
  settingsByModel: {},
  engineState: 'idle',
  engineError: undefined,
  loadProgress: 0,
  visionActive: false,

  /** Reads the inventory, overrides and selection back out of SQLite. */
  hydrate: async () => {
    if (get().hydrated) {
      return;
    }
    const [installedModels, settingsByModel, appState] = await Promise.all([
      modelRepo.loadModels(),
      modelRepo.loadAllSettings(),
      loadAppState(),
    ]);

    set({
      hydrated: true,
      installed: Object.fromEntries(
        installedModels.map(model => [model.id, model]),
      ),
      // Newest first, straight from the indexed query — no stored array.
      installedOrder: installedModels.map(model => model.id),
      settingsByModel,
      selectedModelId: appState.selectedModelId,
    });
  },

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

    const downloadPart = (target: string, filename: string, partSize: number) =>
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

        const selectIfUnset = get().selectedModelId === undefined;
        // Row and selection land together, so a kill here cannot leave a
        // model installed but unselectable.
        void modelRepo.installModel(entry, selectIfUnset);

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

    // Cascades take the per-model settings, and un-pin any conversation
    // that was using it.
    await modelRepo.deleteModel(modelId);

    set(state => {
      const installed = { ...state.installed };
      delete installed[modelId];
      const settingsByModel = { ...state.settingsByModel };
      delete settingsByModel[modelId];

      const installedOrder = state.installedOrder.filter(id => id !== modelId);

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
    void modelRepo.setSelectedModel(modelId);
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
      const info = await readModelInfo(model.path);
      await modelRepo.updateModelInfo(modelId, info);
      get().setModelInfo(modelId, info);
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
  updateSettings: (modelId, patch) => {
    const next = { ...get().settingsByModel[modelId], ...patch };
    void modelRepo.saveSettings(modelId, next);
    set(state => ({
      settingsByModel: { ...state.settingsByModel, [modelId]: next },
    }));
  },

  resetSettings: modelId => {
    void modelRepo.resetSettings(modelId);
    set(state => {
      const settingsByModel = { ...state.settingsByModel };
      delete settingsByModel[modelId];
      return { settingsByModel };
    });
  },

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

    await Promise.all(missing.map(id => modelRepo.deleteModel(id)));

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
}));

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
