import { LevelDefinition } from './Level';
import { LoadResult, SaveRepository, StoragePort } from './SaveRepository';

/** The first level retains its original storage keys. */
export function levelStoragePrefix(level: LevelDefinition): string {
  return level.order === 1 ? 'bead-studio-game-v1' : `bead-studio-game-v1-${level.id}`;
}
export function loadLevel(storage: StoragePort, level: LevelDefinition): LoadResult {
  return new SaveRepository(storage, level, levelStoragePrefix(level)).load();
}
/** A broken prior record must never unlock a subsequent level. */
export function levelUnlocked(levels: LevelDefinition[], index: number, storage: StoragePort): boolean {
  if (index < 0 || index >= levels.length) return false;
  if (index === 0) return true;
  for (let i = 0; i < index; i++) {
    const prior = loadLevel(storage, levels[i]);
    if (!('record' in prior) || !prior.record.completed.includes(levels[i].id)) return false;
  }
  return true;
}
