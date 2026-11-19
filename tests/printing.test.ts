import { describe, it, expect } from 'vitest';
import { patternSvg, patternPrintDocument } from '../assets/scripts/core/PatternPrint';
import { LevelDefinition } from '../assets/scripts/core/Level';
const level:LevelDefinition={schemaVersion:1,id:'print',revision:1,order:1,title:'<图纸 & 豆>',themeId:'personal',width:2,height:2,palette:[{id:1,code:'A1',name:'红',hex:'#ff0000'}],cells:[1,0,1,1]};
describe('实物尺寸打印',()=>{
  it('5mm 孔距对应精确纸面尺寸和豆子中心',()=>{
    const svg=patternSvg(level,5);
    expect(svg).toContain('width="10mm" height="10mm"');
    expect(svg).toContain('cx="2.5" cy="2.5"');
    expect(svg).toContain('cx="7.5" cy="7.5"');
  });
  it('拒绝无效的孔距',()=>{
    expect(()=>patternSvg(level,0)).toThrow();
    expect(()=>patternSvg(level,NaN)).toThrow();
  });
  it('打印页包含不缩放样式、50mm 校准尺、用豆清单及转义标题',()=>{
    const html=patternPrintDocument(level,5);
    expect(html).toContain('width:50mm');
    expect(html).toContain('100%');
    expect(html).toContain('3 颗');
    expect(html).toContain('&lt;图纸 &amp; 豆&gt;');
    expect(html).not.toContain('<图纸 & 豆>');
    expect(html).toContain('@page');
  });
});
