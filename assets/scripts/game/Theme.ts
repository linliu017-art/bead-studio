import { Color } from 'cc';
export const theme = {
 background:'#087af3',text:'#253766',muted:'#526c97',accent:'#ff713c',
 pale:'#e4f5ff',board:'#c5ebff',boardEdge:'#1553a4',paper:'#fff9df',
 rose:'#fff1c1',mint:'#45bd62',mintPale:'#d5f6d0',yellow:'#ffdc59',lavender:'#8153bc',
 surface:'#fff9e8',line:'#234a91',shadow:'#172665',disabled:'#9eb4cb',
};
export function color(hex:string,alpha?:number):Color {const c=new Color();Color.fromHEX(c,hex);if(alpha!==undefined)c.a=alpha;return c;}

/** The original physical craft desk, with a slightly brighter rose palette. */
export const craftTheme={background:'#fff8ef',text:'#59413e',muted:'#8a7065',accent:'#e95b7d',pale:'#ffe7ed',board:'#f5cbd4',boardEdge:'#dfabb7',paper:'#fff8e9',surface:'#fffaf3',line:'#ecdcd1',shadow:'#dfb8a7',disabled:'#f2d8cf'};
