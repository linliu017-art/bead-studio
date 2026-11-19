import { describe, expect, it } from 'vitest';
import { imageToLevel } from '../assets/scripts/core/ImagePattern';
import { patternSvg } from '../assets/scripts/core/PatternPrint';
import { levelStoragePrefix } from '../assets/scripts/core/LevelAccess';
import { PersonalPatterns } from '../assets/scripts/core/PersonalPatterns';
import { collectionCandidate, newRecord, SaveRepository } from '../assets/scripts/core/SaveRepository';
import { PlaySession } from '../assets/scripts/core/Session';

const ink = [24, 22, 24, 255];
const white = [253, 253, 253, 255];
const gold = [251, 224, 140, 255];
const tan = [220, 173, 143, 255];
const pink = [244, 168, 184, 255];
const clear = [255, 255, 255, 0];

function picture(rows: string[]) {
  const colors = { '.': white, K: ink, Y: gold, B: tan, P: pink, ' ': clear };
  return {
    width: rows[0].length, height: rows.length,
    data: Uint8Array.from(rows.flatMap(row => [...row].flatMap(symbol => colors[symbol as keyof typeof colors]))),
  };
}

function thinDiagonal(size = 140) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const on = Math.abs(x - y) <= 1;
    const offset = (y * size + x) * 4;
    data[offset] = on ? 230 : 253;
    data[offset + 1] = on ? 80 : 253;
    data[offset + 2] = on ? 90 : 253;
    data[offset + 3] = 255;
  }
  return { width: size, height: size, data };
}

describe('个人图纸', () => {
  it('默认小板铺满为196颗，游戏目标数与图纸一致', () => {
    const level = imageToLevel(picture(['YY', 'YY']), 'own-small', '小板');
    expect([level.width, level.height, level.cells.length]).toEqual([14, 14, 196]);
    expect(level.cells.filter(Boolean)).toHaveLength(196);
    expect(new PlaySession(level).targets).toHaveLength(196);
  });

  it.each([
    [14, 196], [21, 441], [29, 841],
  ] as const)('%i格板的满板豆数为%i', (boardSize, total) => {
    const level = imageToLevel(picture(['YY', 'YY']), 'own-board', '板尺寸', {
      cropToSubject: true, removeWhiteBackground: true, boardSize,
    });
    expect([level.width, level.height]).toEqual([boardSize, boardSize]);
    expect(level.cells).toHaveLength(total);
    expect(new PlaySession(level).targets).toHaveLength(total);
  });

  it('长方形图案等比居中放在方板，留空不计入豆数', () => {
    const level = imageToLevel(picture(['YY']), 'own-wide', '横向图案');
    expect([level.width, level.height]).toEqual([14, 14]);
    expect(level.cells.slice(0, 42).every(id => id === 0)).toBe(true);
    expect(level.cells.slice(42, 140).every(Boolean)).toBe(true);
    expect(level.cells.slice(140).every(id => id === 0)).toBe(true);
    expect(new PlaySession(level).targets).toHaveLength(98);
  });

  it('切换尺寸重新采样，切回小板仍得到同一张图纸', () => {
    const image = picture(['Y ', 'YY']);
    const options = { cropToSubject: false, removeWhiteBackground: true };
    const small = imageToLevel(image, 'own-resize', '切换尺寸', { ...options, boardSize: 14 });
    const large = imageToLevel(image, 'own-resize', '切换尺寸', { ...options, boardSize: 29 });
    expect(new PlaySession(small).targets).toHaveLength(147);
    expect(new PlaySession(large).targets.length).toBeGreaterThan(147);
    expect(imageToLevel(image, 'own-resize', '切换尺寸', { ...options, boardSize: 14 })).toEqual(small);
  });

  it('小板保留两像素细线的完整轮廓', () => {
    const level = imageToLevel(thinDiagonal(), 'own-line', '细线', {
      cropToSubject: true, removeWhiteBackground: true, boardSize: 14,
    });
    expect(level.cells.filter(Boolean).length).toBeGreaterThanOrEqual(14);
    for (let index = 0; index < 14; index++) {
      expect(level.cells[index * 14 + index]).toBeGreaterThan(0);
    }
  });

  it('打印图纸使用真实豆距并让每颗豆与格线对齐', () => {
    const level = imageToLevel(picture(['YY']), 'own-print', '打印', {
      cropToSubject: true, removeWhiteBackground: true, boardSize: 14,
    });
    const svg = patternSvg(level);
    expect(svg).toContain('width="36.4mm" height="36.4mm"');
    expect(svg).toContain('viewBox="0 0 36.4 36.4"');
    expect((svg.match(/<circle /g) ?? []).length).toBe(level.cells.filter(Boolean).length);
  });

  it('去掉外部白底，保住封闭轮廓里的白色并保留透明留空', () => {
    const source = picture(['.......', '.KKKKK.', '.K...K.', '.KKKKK.', '.......']);
    const level = imageToLevel(source, 'own-test', '白色主体');
    expect([level.width, level.height]).toEqual([14, 14]);
    expect(level.cells[7 * level.width + 7]).toBe(level.palette.find(color => color.hex === '#FDFDFD')!.id);
    const transparent = imageToLevel(picture(['YY ', 'YY ']), 'own-transparent', '透明背景', {
      cropToSubject: false, removeWhiteBackground: false,
    });
    expect(transparent.cells.at(-1)).toBe(0);
  });

  it('全白图可切换为保留背景，空透明图返回错误', () => {
    expect(() => imageToLevel(picture(['..']), 'own-test', '全白')).toThrow('没有找到可拼的图案');
    expect(imageToLevel(picture(['..', '..']), 'own-test', '全白', {
      cropToSubject: true, removeWhiteBackground: false,
    }).cells.every(Boolean)).toBe(true);
    expect(() => imageToLevel(picture(['  ']), 'own-test', '透明')).toThrow('没有找到可拼的图案');
  });

  it('保留原图的浅棕和粉色，格内少量邻色不会把浅棕混成杂色', () => {
    const rows = Array<string>(96).fill('B'.repeat(96));
    rows[0] = 'Y' + rows[0].slice(1);
    for (let y = 40; y < 48; y++) rows[y] = 'PPPPPPPP' + rows[y].slice(8);
    const source = picture(rows);
    const level = imageToLevel(source, 'own-cone', '浅棕甜筒');
    expect(level.palette.map(color => color.hex)).toEqual(['#DCAD8F', '#F4A8B8']);
    expect(level.cells[0]).toBe(level.palette[0].id);
    expect(level.cells[6 * level.width]).toBe(level.palette[1].id);
    expect(imageToLevel(source, 'own-cone', '浅棕甜筒')).toEqual(level);
  });

  it('重复确认不会产生重复作品，个人制作和正式关卡进度隔离', () => {
    const values = new Map<string, string>();
    const storage = { get: (key: string) => values.get(key) ?? null, set: (key: string, value: string) => void values.set(key, value) };
    const level = imageToLevel(picture(['Y']), 'own-test', '测试图纸');
    const formal = { ...level, id: 'dessert-001', themeId: 'dessert' };
    const officialRepo = new SaveRepository(storage, formal, levelStoragePrefix(formal));
    expect(officialRepo.save(newRecord(formal))).toBe(true);
    const patterns = new PersonalPatterns(storage);
    patterns.save(level);
    patterns.save(level);
    expect(patterns.list()).toEqual([level]);
    expect(() => patterns.save({ ...level, title: '覆盖测试' })).toThrow('这张图纸已存在');
    const ownRepo = patterns.session(level);
    const session = new PlaySession(level);
    for (const i of session.targets) expect(session.place(i)).toBe('accepted');
    expect(session.startIron()).toBe(true);
    for (let y = 0; y < level.height; y += 3) session.heat({ x: 0, y }, { x: level.width, y });
    expect(ownRepo.save(collectionCandidate(newRecord(level), session))).toBe(true);
    expect(patterns.session(level).load()).toMatchObject({ record: { collected: [level.id] } });
    expect(officialRepo.load()).toMatchObject({ record: { completed: [], collected: [] } });
  });
});
