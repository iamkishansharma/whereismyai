import { desc, eq } from 'drizzle-orm';

import { toAbsolute, toRelative } from '@/core/paths';
import type { GenerationSettings, InstalledModel, ModelInfo } from '@/types';
import { atomically, db } from './client';
import { appState, modelSettings, models } from './schema';
import type { ModelRow, ModelSettingsRow } from './schema';

function toInstalledModel(row: ModelRow): InstalledModel {
  const info: ModelInfo = {
    architecture: row.architecture ?? undefined,
    paramCount: row.paramCount ?? undefined,
    contextLength: row.contextLength ?? undefined,
    quant: row.quant ?? undefined,
  };
  const hasInfo = Object.values(info).some(value => value !== undefined);

  return {
    id: row.id,
    name: row.name,
    repo: row.repo,
    filename: row.filename,
    sizeBytes: row.sizeBytes,
    // Rebuilt from the relative path so a restored backup still resolves.
    path: toAbsolute(row.relPath),
    downloadedAt: row.downloadedAt,
    info: hasInfo ? info : undefined,
    mmproj: row.mmprojFilename
      ? {
          filename: row.mmprojFilename,
          sizeBytes: row.mmprojSizeBytes ?? 0,
        }
      : undefined,
    mmprojPath: row.mmprojRelPath ? toAbsolute(row.mmprojRelPath) : undefined,
  };
}

/** Only the keys the user actually overrode; NULL means "use the default". */
function toSettings(row: ModelSettingsRow): Partial<GenerationSettings> {
  const entries: [keyof GenerationSettings, unknown][] = [
    ['systemPrompt', row.systemPrompt],
    ['temperature', row.temperature],
    ['topP', row.topP],
    ['topK', row.topK],
    ['repeatPenalty', row.repeatPenalty],
    ['nPredict', row.nPredict],
    ['nCtx', row.nCtx],
    ['nGpuLayers', row.nGpuLayers],
    ['enableThinking', row.enableThinking],
  ];

  return Object.fromEntries(
    entries.filter(([, value]) => value !== null && value !== undefined),
  ) as Partial<GenerationSettings>;
}

/** Newest first — this replaces the hand-maintained `installedOrder` array. */
export async function loadModels(): Promise<InstalledModel[]> {
  const rows = await db
    .select()
    .from(models)
    .orderBy(desc(models.downloadedAt));
  return rows.map(toInstalledModel);
}

export async function loadAllSettings(): Promise<
  Record<string, Partial<GenerationSettings>>
> {
  const rows = await db.select().from(modelSettings);
  return Object.fromEntries(rows.map(row => [row.modelId, toSettings(row)]));
}

export async function insertModel(model: InstalledModel): Promise<void> {
  await db
    .insert(models)
    .values({
      id: model.id,
      name: model.name,
      repo: model.repo,
      filename: model.filename,
      sizeBytes: model.sizeBytes,
      relPath: toRelative(model.path),
      mmprojFilename: model.mmproj?.filename ?? null,
      mmprojSizeBytes: model.mmproj?.sizeBytes ?? null,
      mmprojRelPath: model.mmprojPath ? toRelative(model.mmprojPath) : null,
      architecture: model.info?.architecture ?? null,
      paramCount: model.info?.paramCount ?? null,
      contextLength: model.info?.contextLength ?? null,
      quant: model.info?.quant ?? null,
      downloadedAt: model.downloadedAt,
    })
    .onConflictDoUpdate({
      target: models.id,
      set: {
        downloadedAt: model.downloadedAt,
        relPath: toRelative(model.path),
      },
    });
}

export async function updateModelInfo(
  modelId: string,
  info: ModelInfo,
): Promise<void> {
  await db
    .update(models)
    .set({
      architecture: info.architecture ?? null,
      paramCount: info.paramCount ?? null,
      contextLength: info.contextLength ?? null,
      quant: info.quant ?? null,
    })
    .where(eq(models.id, modelId));
}

/** Settings and any conversation pins fall away with the row, by cascade. */
export async function deleteModel(modelId: string): Promise<void> {
  await db.delete(models).where(eq(models.id, modelId));
}

export async function saveSettings(
  modelId: string,
  patch: Partial<GenerationSettings>,
): Promise<void> {
  const columns = {
    systemPrompt: patch.systemPrompt ?? null,
    temperature: patch.temperature ?? null,
    topP: patch.topP ?? null,
    topK: patch.topK ?? null,
    repeatPenalty: patch.repeatPenalty ?? null,
    nPredict: patch.nPredict ?? null,
    nCtx: patch.nCtx ?? null,
    nGpuLayers: patch.nGpuLayers ?? null,
  };

  await db
    .insert(modelSettings)
    .values({ modelId, ...columns })
    .onConflictDoUpdate({ target: modelSettings.modelId, set: columns });
}

export async function resetSettings(modelId: string): Promise<void> {
  await db.delete(modelSettings).where(eq(modelSettings.modelId, modelId));
}

export async function setSelectedModel(modelId?: string): Promise<void> {
  await db
    .update(appState)
    .set({ selectedModelId: modelId ?? null })
    .where(eq(appState.id, 1));
}

/**
 * Registers a finished download and makes it the selection when nothing else
 * is chosen, in one transaction so a kill mid-write cannot leave a model
 * installed but unselectable, or selected but not installed.
 */
export async function installModel(
  model: InstalledModel,
  selectIfUnset: boolean,
): Promise<void> {
  const insert = db
    .insert(models)
    .values({
      id: model.id,
      name: model.name,
      repo: model.repo,
      filename: model.filename,
      sizeBytes: model.sizeBytes,
      relPath: toRelative(model.path),
      mmprojFilename: model.mmproj?.filename ?? null,
      mmprojSizeBytes: model.mmproj?.sizeBytes ?? null,
      mmprojRelPath: model.mmprojPath ? toRelative(model.mmprojPath) : null,
      downloadedAt: model.downloadedAt,
    })
    .onConflictDoUpdate({
      target: models.id,
      set: {
        downloadedAt: model.downloadedAt,
        relPath: toRelative(model.path),
      },
    });

  if (!selectIfUnset) {
    await insert;
    return;
  }

  await atomically(
    insert,
    db
      .update(appState)
      .set({ selectedModelId: model.id })
      .where(eq(appState.id, 1)),
  );
}
