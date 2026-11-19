import { describe, expect, it } from 'vitest';
import { brandWebPage } from '../scripts/webBranding';
const entry = '<html><head><title>Old</title></head><body><canvas id="GameCanvas"></canvas><script>System.import("./index.js")</script></body></html>';
describe('网页品牌加载层', () => {
  it('保留游戏入口并在入口脚本前提供可访问的等待界面', () => {
    const result = brandWebPage(entry);
    expect(result).toContain('System.import("./index.js")');
    expect(result).toContain('role="status"');
    expect(result.indexOf('id="bead-welcome"')).toBeLessThan(result.indexOf('System.import'));
    expect(result).toContain('bead-game-ready');
    expect(result).toContain('拼拼豆豆儿');
  });
  it('同一构建重复处理不产生两个覆盖层', () => {
    expect(brandWebPage(brandWebPage(entry))).toBe(brandWebPage(entry));
  });
  it('没有游戏画布时拒绝生成无法进入游戏的页面', () => {
    expect(() => brandWebPage('<html><body></body></html>')).toThrow('GameCanvas');
  });
});
