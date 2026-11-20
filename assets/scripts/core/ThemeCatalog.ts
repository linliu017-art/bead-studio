import { LevelDefinition } from './Level';

export const levelThemes = [
  { id: 'dessert', title: '甜品岛', tab: '甜品岛', subtitle: '沿着星星小路，收集一岛甜蜜', fill: '#FFE8BC' },
  { id: 'animal', title: '萌宠森林', tab: '小动物', subtitle: '和软萌小伙伴，一起住进云上森林', fill: '#D6F4D2' },
  { id: 'daily', title: '日常小物', tab: '日常小物', subtitle: '把平凡的小日子，拼成可爱的宝藏', fill: '#E5DEFF' },
] as const;
export type LevelThemeId = typeof levelThemes[number]['id'];
export const formalLevelPaths: string[] = levelThemes.flatMap(theme =>
  Array.from({length:6}, (_, i) => `levels/${theme.id}-${String(i+1).padStart(3,'0')}`));
export function levelTheme(id: string) { return levelThemes.find(theme => theme.id === id) ?? levelThemes[0]; }
/** Return a global catalog index, never cross into the next theme at the end. */
export function nextThemeLevelIndex(levels: LevelDefinition[], currentId: string): number {
  const current = levels.find(level => level.id === currentId);
  if (!current) return -1;
  let result = -1;
  levels.forEach((level,index) => {
    if (level.themeId === current.themeId && level.order > current.order &&
      (result < 0 || level.order < levels[result].order)) result = index;
  });
  return result;
}
