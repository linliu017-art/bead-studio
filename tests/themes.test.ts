import { describe, it, expect } from 'vitest';
import { levelUnlocked, levelStoragePrefix } from '../assets/scripts/core/LevelAccess';
import { newRecord, SaveRepository } from '../assets/scripts/core/SaveRepository';
import { summarizeHomeProgress } from '../assets/scripts/core/HomeProgress';
import { LevelDefinition } from '../assets/scripts/core/Level';

const level=(id:string,themeId:string,order:number):LevelDefinition=>({schemaVersion:1,id,themeId,order,revision:1,title:id,width:2,height:1,palette:[{id:1,code:'P1',name:'粉',hex:'#ff7799'}],cells:[1,1]});
const levels=[level('dessert-001','dessert',1),level('dessert-002','dessert',2),level('animal-001','animal',3),level('animal-002','animal',4),level('daily-001','daily',5),level('daily-002','daily',6)];
function memory(){const data=new Map<string,string>();return{get:(k:string)=>data.get(k)??null,set:(k:string,v:string)=>{data.set(k,v);}};}
function finish(storage:ReturnType<typeof memory>,index:number){const l=levels[index],record=newRecord(l);record.completed=[l.id];expect(new SaveRepository(storage,l,levelStoragePrefix(l)).save(record)).toBe(true);}

describe('独立主题进度',()=>{
 it('每个主题首关直接开放，第二关等待本主题首关完成',()=>{const s=memory();expect(levels.map((_,i)=>levelUnlocked(levels,i,s))).toEqual([true,false,true,false,true,false]);});
 it('动物通关只解锁下一动物关，不要求甜品进度',()=>{const s=memory();finish(s,2);expect(levels.map((_,i)=>levelUnlocked(levels,i,s))).toEqual([true,false,true,true,true,false]);});
 it('甜品进度不会解锁其他主题的第二关',()=>{const s=memory();finish(s,0);expect(levels.map((_,i)=>levelUnlocked(levels,i,s))).toEqual([true,true,true,false,true,false]);});
 it('损坏动物进度只锁住动物后关，其他主题首关仍可玩',()=>{const s=memory();s.set(levelStoragePrefix(levels[2])+'-0','broken');expect(levelUnlocked(levels,3,s)).toBe(false);expect(levelUnlocked(levels,4,s)).toBe(true);});
 it('新主题即使使用本地关号1也不能覆盖原来甜品首关的存档',()=>{expect(levelStoragePrefix(levels[0])).toBe('bead-studio-game-v1');expect(levelStoragePrefix({...levels[2],order:1})).toBe('bead-studio-game-v1-animal-001');});
 it('首页推荐可继续的小动物作品',()=>{const s=memory(),r=newRecord(levels[2]);r.session.filled=[0];new SaveRepository(s,levels[2],levelStoragePrefix(levels[2])).save(r);expect(summarizeHomeProgress(levels,s)).toMatchObject({unlocked:3,nextIndex:2,inProgress:1});});
});
