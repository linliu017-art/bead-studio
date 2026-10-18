import { Color } from 'cc';
export const theme = {
  background:'#fff7f0', text:'#59413e', muted:'#8a7065', accent:'#d94d65',
  pale:'#ffebe7', board:'#f3d8d5', boardEdge:'#dfb7ae', paper:'#fff8e9',
  surface:'#fffaf3', line:'#ecdcd1', shadow:'#dfb8a7', disabled:'#f2d8cf',
};
export function color(hex: string, alpha?: number): Color { const c=new Color();Color.fromHEX(c,hex);if(alpha!==undefined)c.a=alpha;return c; }
