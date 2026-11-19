import { describe,it,expect } from 'vitest';
import { coverSize } from '../assets/scripts/core/PixelVisuals';
import { centeredUiPoint } from '../assets/scripts/core/Geometry';
describe('完整封面与宽窗口输入',()=>{
 it('封面覆盖竖屏、16:9 与超宽窗口，保持原图比例',()=>{
  for(const [w,h] of [[390,844],[1280,800],[1920,1080],[3440,1440]]){
   const image=w>h?[1672,941]:[941,1672],result=coverSize(image[0],image[1],w,h);
   expect(result.width).toBeGreaterThanOrEqual(w-.001);expect(result.height).toBeGreaterThanOrEqual(h-.001);
   expect(result.width/result.height).toBeCloseTo(image[0]/image[1]);
  }
 });
 it('宽窗口中央的点击仍映射到工作台中央',()=>{
  expect(centeredUiPoint({x:675,y:422},1350,844)).toEqual({x:0,y:0});
 });
 it('拒绝无效图片或窗口尺寸',()=>{expect(()=>coverSize(0,844,390,844)).toThrow();});
});
