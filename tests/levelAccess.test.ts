import { describe, expect, it } from 'vitest';
import { levelStoragePrefix, levelUnlocked, sampleStoragePrefix } from '../assets/scripts/core/LevelAccess';
import { validateLevel } from '../assets/scripts/core/Level';
import { SaveRepository, collectionCandidate, newRecord } from '../assets/scripts/core/SaveRepository';
import { PlaySession } from '../assets/scripts/core/Session';
import levelJson from '../assets/resources/levels/dessert-001.json';
import sampleJson from '../assets/resources/samples/life-011.json';

const first = validateLevel(levelJson);
const second = { ...first, id: 'dessert-002', order: 2 };
const third = { ...first, id: 'dessert-003', order: 3 };
function memory() { const data = new Map<string,string>(); return { get:(k:string)=>data.get(k)??null, set:(k:string,v:string)=>{data.set(k,v);} }; }
describe('multi-level access',()=>{
  it('keeps the original storage namespace and unlocks in sequence',()=>{
    const storage=memory();const levels=[first,second,third];
    expect(levelStoragePrefix(first)).toBe('bead-studio-game-v1');
    expect(levelUnlocked(levels,1,storage)).toBe(false);
    const record=newRecord(first);record.completed=[first.id];
    expect(new SaveRepository(storage,first,levelStoragePrefix(first)).save(record)).toBe(true);
    expect(levelUnlocked(levels,1,storage)).toBe(true);
    expect(levelUnlocked(levels,2,storage)).toBe(false);
  });
  it('does not unlock with a corrupt record',()=>{
    const storage=memory();storage.set('bead-studio-game-v1-0','broken');
    expect(levelUnlocked([first,second],1,storage)).toBe(false);
    expect(storage.get('bead-studio-game-v1-0')).toBe('broken');
  });
});

it('starts on a color actually used by the level',()=>{
  const level = { ...first, cells: first.cells.map(value => value === 1 ? 2 : value) };
  const record = newRecord(level);
  expect(record.session.selectedColor).toBe(2);
});

it('finishes and restores the 14-color sample without changing official progress', () => {
  const sample = validateLevel(sampleJson);
  const storage = memory();
  const official = new SaveRepository(storage, first, levelStoragePrefix(first));
  expect(official.save(newRecord(first))).toBe(true);
  const original = storage.get(levelStoragePrefix(first) + '-0');

  const prefix = sampleStoragePrefix(sample);
  const repo = new SaveRepository(storage, sample, prefix);
  const record = newRecord(sample);
  const session = new PlaySession(sample);
  expect(sample.palette).toHaveLength(14);
  for (const color of sample.palette) {
    expect(session.remaining(color.id)).toBeGreaterThan(0);
    session.selectedColor = color.id;
    for (const index of session.targets.filter(index => sample.cells[index] === color.id)) {
      expect(session.place(index)).toBe('accepted');
    }
  }
  expect(session.startIron()).toBe(true);
  session.heat({ x: 0, y: 3 }, { x: sample.width, y: 3 });
  expect(session.heated.size).toBeGreaterThan(0);
  record.session = session.serialize();
  expect(repo.save(record)).toBe(true);

  const resumedRepo = new SaveRepository(storage, sample, prefix);
  const loaded = resumedRepo.load();
  if (!('record' in loaded)) throw new Error('Sample record did not load');
  const resumed = PlaySession.restore(sample, loaded.record.session);
  expect(resumed.serialize()).toEqual(session.serialize());
  for (let y = 0.5; y < sample.height; y += 4) {
    resumed.heat({ x: 0, y }, { x: sample.width, y });
  }
  expect(resumed.phase).toBe('ready-to-reveal');
  expect(resumedRepo.save(collectionCandidate(loaded.record, resumed))).toBe(true);
  expect(resumedRepo.load()).toMatchObject({
    record: { collected: [sample.id], session: { phase: 'collected' } },
  });
  expect(storage.get(levelStoragePrefix(first) + '-0')).toBe(original);
  expect(levelUnlocked([first, second], 1, storage)).toBe(false);
});
