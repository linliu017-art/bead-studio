import { LevelDefinition } from './Level';
import { levelUnlocked, loadLevel } from './LevelAccess';
import { StoragePort } from './SaveRepository';

export function summarizeHomeProgress(levels: LevelDefinition[], storage: StoragePort): {
  completed: number; inProgress: number; unlocked: number; total: number; nextIndex: number;
} {
  const states = levels.map((level, index) => {
    const loaded = loadLevel(storage, level);
    const record = 'record' in loaded ? loaded.record : undefined;
    return {
      unlocked: levelUnlocked(levels, index, storage),
      completed: !!record?.completed.includes(level.id),
      inProgress: !!record?.session.filled.length && record.session.phase !== 'collected',
    };
  });
  const continuing = states.findIndex(state => state.unlocked && state.inProgress);
  const next = states.findIndex(state => state.unlocked && !state.completed);
  return {
    completed: states.filter(state => state.completed).length,
    inProgress: states.filter(state => state.unlocked && state.inProgress).length,
    unlocked: states.filter(state => state.unlocked).length,
    total: levels.length,
    nextIndex: continuing >= 0 ? continuing : next >= 0 ? next : levels.length ? 0 : -1,
  };
}
