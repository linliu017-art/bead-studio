import { describe, it, expect } from 'vitest';
import { homeLayout, pixelSurface, pixelBeadPixels } from '../assets/scripts/core/PixelVisuals';
import { LevelDefinition } from '../assets/scripts/core/Level';
const level:LevelDefinition={schemaVersion:1,id:'pixel',revision:1,order:1,title:'测试',themeId:'personal',width:2,height:1,palette:[{id:1,code:'R',name:'红',hex:'#ff3366'}],cells:[1,0]};
describe('像素视觉布局与图纸',()=>{
 it('不同竖屏尺寸与底部安全区都能完整显示首页操作',()=>{
  for(const height of [560,640,844,920])for(const bottom of [0,34]){
   const layout=homeLayout(height,24,bottom);
   expect(layout.primaryY-30).toBeGreaterThan(layout.titleY+70);
   expect(layout.secondaryY+24).toBeLessThan(height-bottom);
   expect(layout.secondaryY-layout.primaryY).toBeGreaterThan(52);
  }
 });
 it('成品保持原图颜色和空位，不产生圆角透明缺口',()=>{
  const result=pixelSurface(level,8);
  expect([result.width,result.height]).toEqual([16,8]);
  expect([...result.pixels.slice((3*16+3)*4,(3*16+3)*4+4)]).toEqual([255,51,102,255]);
  expect(result.pixels[(3*16+12)*4+3]).toBe(0);
  expect(result.pixels[3]).toBe(255);
 });
 it('像素豆子保留中心通孔并有不透明主体',()=>{
  const {width,pixels}=pixelBeadPixels();
  expect(pixels[(6*width+6)*4+3]).toBe(0);
  expect(pixels[(2*width+6)*4+3]).toBe(255);
 });
});
