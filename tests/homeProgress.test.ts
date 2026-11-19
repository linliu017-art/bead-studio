import { describe, expect, it } from 'vitest';
import { summarizeHomeProgress } from '../assets/scripts/core/HomeProgress';
import { LevelDefinition } from '../assets/scripts/core/Level';
import { levelStoragePrefix } from '../assets/scripts/core/LevelAccess';
import { newRecord, SaveRepository, StoragePort } from '../assets/scripts/core/SaveRepository';
import { PlaySession } from '../assets/scripts/core/Session';

const level = (index: number): LevelDefinition => ({
  schemaVersion: 1, id: `dessert-00${index}`, revision: 1, order: index, title: `甜品 ${index}`,
  themeId: 'dessert', width: 2, height: 2, palette: [{ id: 1, code: 'R', name: '红', hex: '#e84e5f' }], cells: [1, 1, 1, 1],
});

function storage(): StoragePort {
  const values = new Map<string, string>();
  return { get: key => values.get(key) ?? null, set: (key, value) => void values.set(key, value) };
}

describe('首页进度摘要', () => {
  it('没有关卡时不推荐无效索引', () => {
    expect(summarizeHomeProgress([], storage())).toEqual({ completed: 0, inProgress: 0, unlocked: 0, total: 0, nextIndex: -1 });
  });
  it('损坏的前关记录不会解锁后关', () => {
    const values = storage(), first = level(1);
    values.set(levelStoragePrefix(first) + '-0', '{broken');
    expect(summarizeHomeProgress([first, level(2)], values)).toMatchObject({ completed: 0, unlocked: 1, nextIndex: 0 });
  });
  it('首次打开只解锁第一关，并把第一关作为下一步', () => {
    const levels = [level(1), level(2), level(3)];
    const summary = summarizeHomeProgress(levels, storage());
    expect(summary).toEqual({ completed: 0, inProgress: 0, unlocked: 1, total: 3, nextIndex: 0 });
  });

  it('有进行中作品时优先推荐继续该作品', () => {
    const values = storage();
    const current = level(1), record = newRecord(current), session = new PlaySession(current);
    session.place(0); record.session = session.serialize();
    expect(new SaveRepository(values, current, levelStoragePrefix(current)).save(record)).toBe(true);
    const summary = summarizeHomeProgress([current, level(2), level(3)], values);
    expect(summary).toMatchObject({ completed: 0, inProgress: 1, unlocked: 1, nextIndex: 0 });
  });

  it('完成前一关后推荐下一关，并统计完成数', () => {
    const values = storage();
    const first = level(1), record = newRecord(first);
    record.completed.push(first.id);
    expect(new SaveRepository(values, first, levelStoragePrefix(first)).save(record)).toBe(true);
    const summary = summarizeHomeProgress([first, level(2), level(3)], values);
    expect(summary).toMatchObject({ completed: 1, inProgress: 0, unlocked: 2, nextIndex: 1 });
  });
});
