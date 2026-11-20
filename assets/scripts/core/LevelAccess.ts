import { LevelDefinition } from './Level';
import { LoadResult, SaveRepository, StoragePort } from './SaveRepository';

/** The first level retains its original storage keys. */
export function levelStoragePrefix(level: LevelDefinition): string {
  return level.id === 'dessert-001' ? 'bead-studio-game-v1' : `bead-studio-game-v1-${level.id}`;
}
export function sampleStoragePrefix(level: LevelDefinition): string {
  return `bead-studio-dev-v1-${level.id}`;
}
export function loadLevel(storage: StoragePort, level: LevelDefinition): LoadResult {
  return new SaveRepository(storage, level, levelStoragePrefix(level)).load();
}
/** A broken prior record must never unlock a subsequent level. */
export function levelUnlocked(levels: LevelDefinition[], index: number, storage: StoragePort): boolean {
  if (index < 0 || index >= levels.length) return false;
  const current = levels[index];
  for (const level of levels) {
    if (level.themeId !== current.themeId || level.order >= current.order) continue;
    const prior = loadLevel(storage, level);
    if (!('record' in prior) || !prior.record.completed.includes(level.id)) return false;
  }
  return true;
}
