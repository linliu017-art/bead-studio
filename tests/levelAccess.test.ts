import { describe, expect, it } from 'vitest';
import { levelStoragePrefix, levelUnlocked } from '../assets/scripts/core/LevelAccess';
import { validateLevel } from '../assets/scripts/core/Level';
import { SaveRepository, newRecord } from '../assets/scripts/core/SaveRepository';
import levelJson from '../assets/resources/levels/dessert-001.json';

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
