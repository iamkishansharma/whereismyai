import { eq } from 'drizzle-orm';

import type { ThemeMode } from '@/types';
import { db } from './client';
import { appState } from './schema';

export interface AppState {
  selectedModelId?: string;
  themeMode: ThemeMode;
  onboardingDone: boolean;
  showGenerationStats: boolean;
}

const DEFAULTS: AppState = {
  selectedModelId: undefined,
  themeMode: 'system',
  onboardingDone: false,
  showGenerationStats: false,
};

/**
 * The single row, created on first read. Everything the app used to keep in
 * AsyncStorage lives here so there is one store and one migration story.
 */
export async function loadAppState(): Promise<AppState> {
  const [row] = await db.select().from(appState).where(eq(appState.id, 1));

  if (!row) {
    await db.insert(appState).values({ id: 1 }).onConflictDoNothing();
    return DEFAULTS;
  }

  return {
    selectedModelId: row.selectedModelId ?? undefined,
    themeMode: row.themeMode,
    onboardingDone: row.onboardingDone,
    showGenerationStats: row.showGenerationStats,
  };
}

export async function saveAppState(patch: Partial<AppState>): Promise<void> {
  await db
    .update(appState)
    .set({
      ...(patch.selectedModelId !== undefined
        ? { selectedModelId: patch.selectedModelId ?? null }
        : null),
      ...(patch.themeMode !== undefined
        ? { themeMode: patch.themeMode }
        : null),
      ...(patch.onboardingDone !== undefined
        ? { onboardingDone: patch.onboardingDone }
        : null),
      ...(patch.showGenerationStats !== undefined
        ? { showGenerationStats: patch.showGenerationStats }
        : null),
    })
    .where(eq(appState.id, 1));
}
