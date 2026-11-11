import { describe, expect, it } from 'vitest';
import cat from '../assets/resources/samples/life-011.json';
import { validateLevel } from '../assets/scripts/core/Level';
import { checkPatternDetails } from '../scripts/check-pattern-details';

describe('图纸细节检查', () => {
  it('发现轮廓仍相连时的一格缺口', () => {
    const level = validateLevel({
      schemaVersion: 1, id: 'diamond', revision: 1, order: 1, title: '菱形', themeId: 'life',
      width: 5, height: 5,
      palette: [{ id: 1, code: 'K', name: '墨黑', hex: '#211B1C' },
        { id: 2, code: 'Y', name: '金黄', hex: '#FBE08C' }],
      cells: [
        0, 0, 1, 0, 0,
        0, 1, 2, 1, 0,
        1, 2, 2, 2, 1,
        0, 1, 2, 1, 0,
        0, 0, 1, 0, 0,
      ],
    });
    const review = {
      levelId: level.id,
      details: [{ label: '菱形', bounds: [0, 0, 5, 5], colors: ['K'],
        parts: [{ label: '四角', anchors: [[2, 0], [0, 2], [4, 2], [2, 4]] }],
        enclosedColors: ['Y'] }],
    };
    expect(checkPatternDetails(level, review)).toEqual([]);
    level.cells[6] = 0;
    expect(checkPatternDetails(level, review)).toContain('菱形：轮廓没有围住填色');
  });

  it('允许围巾小猫原有的表情，并发现斜角粘连的腮红', () => {
    const level = validateLevel({ ...cat, cells: [...cat.cells] });
    const review = {
      levelId: level.id,
      details: [{
        label: '小猫表情', bounds: [6, 13, 20, 7], colors: ['C01', 'C07'],
        parts: [
          { label: '左眼', anchors: [[10, 14]] },
          { label: '右眼', anchors: [[22, 14]] },
          { label: '左腮红', anchors: [[7, 17]] },
          { label: '右腮红', anchors: [[24, 17]] },
          { label: '笑嘴', anchors: [[14, 18], [16, 18], [18, 18]] },
        ],
      }],
    };
    expect(checkPatternDetails(level, review)).toEqual([]);
    level.cells[17 * level.width + 9] = 7;
    expect(checkPatternDetails(level, review)).toContain('小猫表情：左眼和左腮红粘连');
  });
});
