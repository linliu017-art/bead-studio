export interface PaletteColor { id: number; code: string; name: string; hex: string }
export interface Region { id: string; title: string; indices: number[] }
export interface LevelDefinition {
  schemaVersion: 1; id: string; revision: number; order: number; title: string;
  themeId: string; width: number; height: number; palette: PaletteColor[];
  cells: number[]; regions?: Region[];
}
export function validateLevel(value: unknown): LevelDefinition {
  if (!value || typeof value !== 'object') throw new Error('关卡格式无效');
  const d = value as LevelDefinition;
  const fail = (condition: boolean, message: string): void => { if (condition) throw new Error(message); };
  fail(d.schemaVersion !== 1, '不支持的关卡版本');
  for (const key of ['id', 'title', 'themeId'] as const) fail(typeof d[key] !== 'string' || !d[key].trim(), `缺少 ${key}`);
  fail(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.id), '关卡 ID 无效');
  for (const n of [d.width, d.height]) fail(!Number.isInteger(n) || n < 1 || n > 48, '底板尺寸无效');
  fail(!Number.isSafeInteger(d.revision) || d.revision < 1 || !Number.isSafeInteger(d.order) || d.order < 1, '关卡顺序或版本无效');
  fail(!Array.isArray(d.palette) || d.palette.length < 1 || d.palette.length > 14, '色板无效');
  const ids = new Set<number>(), codes = new Set<string>();
  for (const color of d.palette) {
    fail(!color || !Number.isSafeInteger(color.id) || color.id < 1 || ids.has(color.id), '色号重复或无效');
    fail(typeof color.code !== 'string' || !color.code.trim() || codes.has(color.code), '颜色编号重复或无效');
    fail(typeof color.name !== 'string' || !color.name.trim() || !/^#[0-9a-f]{6}$/i.test(color.hex), '颜色信息无效');
    ids.add(color.id); codes.add(color.code);
  }
  fail(!Array.isArray(d.cells) || d.cells.length !== d.width * d.height, '格子数组与尺寸不一致');
  fail(d.cells.some(id => !Number.isInteger(id) || (id !== 0 && !ids.has(id))), '格子包含未知色号');
  fail(!d.cells.some(Boolean), '图案不能为空');
  if (d.regions) {
    fail(!Array.isArray(d.regions), '区域格式无效');
    const seen = new Set<number>(), names = new Set<string>();
    for (const region of d.regions) {
      fail(!region || typeof region.id !== 'string' || names.has(region.id) || !Array.isArray(region.indices), '区域定义无效');
      names.add(region.id);
      for (const i of region.indices) {
        fail(!Number.isInteger(i) || !d.cells[i] || seen.has(i), '区域越界、重复或包含空白'); seen.add(i);
      }
    }
    fail(seen.size !== d.cells.filter(Boolean).length, '区域没有覆盖所有有效位置');
  }
  return d;
}
export function validateCatalog(levels: LevelDefinition[]): void {
  const ids = new Set<string>();
  levels.forEach((level, i) => {
    validateLevel(level);
    if (ids.has(level.id) || level.order !== i + 1) throw new Error('关卡目录重复或顺序不连续');
    ids.add(level.id);
  });
}
