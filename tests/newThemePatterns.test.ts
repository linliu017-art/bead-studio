import { readFileSync, readdirSync } from 'node:fs';
import { describe,it,expect } from 'vitest';
import { validateLevel, validateCatalog } from '../assets/scripts/core/Level';
import { PlaySession } from '../assets/scripts/core/Session';
import { collectionCandidate, newRecord, SaveRepository } from '../assets/scripts/core/SaveRepository';
import { levelStoragePrefix } from '../assets/scripts/core/LevelAccess';
const levels=readdirSync('assets/resources/levels').filter(p=>p.endsWith('.json')).map(p=>validateLevel(JSON.parse(readFileSync('assets/resources/levels/'+p,'utf8')))).sort((a,b)=>a.order-b.order);
describe('新主题图纸可完整制作',()=>{
 it('两组新图纸加入完整目录且所有色号都可拼',()=>{
  const fresh=levels.filter(l=>l.themeId==='animal'||l.themeId==='daily');expect(fresh).toHaveLength(12);validateCatalog(levels);
  expect(new Set(fresh.map(l=>JSON.stringify(l.cells))).size).toBe(12);
  for(const theme of ['animal','daily'])expect(fresh.filter(l=>l.themeId===theme)).toHaveLength(6);
  for(const l of fresh){expect(l.cells.filter(Boolean).length).toBeGreaterThan(250);expect(l.palette.length).toBeLessThanOrEqual(10);expect(l.palette.every(c=>l.cells.includes(c.id))).toBe(true);}
 });
 it('12张图都能落豆、续做、熨烫、收藏，原甜品进度保持原值',()=>{
  const fresh=levels.filter(l=>l.themeId==='animal'||l.themeId==='daily');expect(fresh).toHaveLength(12);
  const data=new Map<string,string>(),storage={get:(k:string)=>data.get(k)??null,set:(k:string,v:string)=>{data.set(k,v);}};
  const dessert=levels.find(l=>l.id==='dessert-001')!;
  new SaveRepository(storage,dessert,levelStoragePrefix(dessert)).save(newRecord(dessert));
  const original=data.get('bead-studio-game-v1-0');
  for(const l of fresh){
   const s=new PlaySession(l);for(const i of s.targets)expect(s.place(i,l.cells[i])).toBe('accepted');
   const r=newRecord(l);r.session=s.serialize();const repo=new SaveRepository(storage,l,levelStoragePrefix(l));expect(repo.save(r)).toBe(true);
   const loaded=repo.load();if(!('record'in loaded))throw new Error('Failed to restore '+l.id);
   const resumed=PlaySession.restore(l,loaded.record.session);expect(resumed.startIron()).toBe(true);
   for(let y=.5;y<l.height;y+=3)resumed.heat({x:0,y},{x:l.width,y});
   expect(resumed.phase).toBe('ready-to-reveal');expect(repo.save(collectionCandidate(loaded.record,resumed))).toBe(true);
   expect(repo.load()).toMatchObject({record:{collected:[l.id],session:{phase:'collected'}}});
  }
  expect(data.get('bead-studio-game-v1-0')).toBe(original);
 });
});
