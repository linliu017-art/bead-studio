import { describe,it,expect } from 'vitest';
import { nextThemeLevelIndex, formalLevelPaths } from '../assets/scripts/core/ThemeCatalog';
import { validateLevel } from '../assets/scripts/core/Level';
import { readFileSync } from 'node:fs';
const levels=formalLevelPaths.map(path=>validateLevel(JSON.parse(readFileSync('assets/resources/'+path+'.json','utf8'))));
describe('主题下一关导航',()=>{
 it('动物和日常第一关走向各自第二关',()=>{expect(nextThemeLevelIndex(levels,'animal-001')).toBe(7);expect(nextThemeLevelIndex(levels,'daily-001')).toBe(13);});
 it('三个主题末关都不跨入其他主题',()=>{for(const id of ['dessert-006','animal-006','daily-006'])expect(nextThemeLevelIndex(levels,id)).toBe(-1);});
 it('个人图纸与未知ID没有正式下一关',()=>{expect(nextThemeLevelIndex(levels,'own-test')).toBe(-1);});
});
