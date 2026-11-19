import { Graphics, Texture2D, SpriteFrame } from 'cc';
import { pixelBeadPixels } from '../core/PixelVisuals';
import { color, theme } from './Theme';

/** Chunky stepped corners and two-tone bevel, shared by all controls and panels. */
export function pixelBox(g:Graphics,w:number,h:number,fill:string,edge=theme.line):void {
 g.clear();const a=-w/2,b=-h/2,c=Math.min(6,w/6,h/6);
 const shape=(x:number,y:number,width:number,height:number,cut:number,hex:string)=>{
  g.fillColor=color(hex);g.moveTo(x+cut,y);g.lineTo(x+width-cut,y);g.lineTo(x+width-cut,y+cut);g.lineTo(x+width,y+cut);g.lineTo(x+width,y+height-cut);g.lineTo(x+width-cut,y+height-cut);g.lineTo(x+width-cut,y+height);g.lineTo(x+cut,y+height);g.lineTo(x+cut,y+height-cut);g.lineTo(x,y+height-cut);g.lineTo(x,y+cut);g.lineTo(x+cut,y+cut);g.close();g.fill();
 };
 if(h<12||fill.length===9){g.fillColor=color(fill);g.rect(a,b,w,h);g.fill();if(fill.length===9&&w<380){g.strokeColor=color(edge);g.lineWidth=3;g.rect(a,b,w,h);g.stroke();}return;}
 shape(a,b-3,w,h,c,theme.shadow);shape(a,b,w,h,c,edge);
 shape(a+3,b+3,w-6,h-6,Math.max(1,c-2),fill);
 if(h>24){g.fillColor=color('#ffffff',105);g.rect(a+c+3,b+h-6,w-2*c-6,3);g.fill();g.fillColor=color('#132b69',40);g.rect(a+c+3,b+3,w-2*c-6,3);g.fill();}
}
export function makePixelBead():SpriteFrame {
 const data=pixelBeadPixels(),texture=new Texture2D();texture.reset({width:data.width,height:data.height,format:Texture2D.PixelFormat.RGBA8888});texture.setFilters(Texture2D.Filter.NEAREST,Texture2D.Filter.NEAREST);texture.uploadData(data.pixels);
 const frame=new SpriteFrame();frame.texture=texture;return frame;
}
export function pixelStar(g:Graphics,x:number,y:number,size:number,fill=theme.yellow):void {
 g.fillColor=color(fill);g.rect(x-size*.2,y-size*.5,size*.4,size);g.fill();g.rect(x-size*.5,y-size*.2,size,size*.4);g.fill();
}

/** Reference-style raised game button: stepped silhouette, thick rim, highlight and depth. */
export function pixelButton(g:Graphics,w:number,h:number,primary=false):void {
 g.clear();const cut=Math.max(4,Math.min(h*.26,16)),depth=Math.max(4,Math.min(8,h*.12));
 const shape=(x:number,y:number,width:number,height:number,c:number,fill:string)=>{
  const d=c/2;g.fillColor=color(fill);g.moveTo(x+c,y);g.lineTo(x+width-c,y);g.lineTo(x+width-c,y+d);g.lineTo(x+width-d,y+d);g.lineTo(x+width-d,y+c);g.lineTo(x+width,y+c);g.lineTo(x+width,y+height-c);g.lineTo(x+width-d,y+height-c);g.lineTo(x+width-d,y+height-d);g.lineTo(x+width-c,y+height-d);g.lineTo(x+width-c,y+height);g.lineTo(x+c,y+height);g.lineTo(x+c,y+height-d);g.lineTo(x+d,y+height-d);g.lineTo(x+d,y+height-c);g.lineTo(x,y+height-c);g.lineTo(x,y+c);g.lineTo(x+d,y+c);g.lineTo(x+d,y+d);g.lineTo(x+c,y+d);g.close();g.fill();
 };
 const x=-w/2,y=-h/2;
 shape(x,y-depth,w,h,cut,primary?'#34154f':'#09276a');
 shape(x,y,w,h,cut,primary?'#912d43':'#12338b');
 shape(x+4,y+4,w-8,h-8,Math.max(2,cut-2),primary?'#ffba4c':'#38c9ff');
 shape(x+8,y+8,w-16,h-16,Math.max(2,cut-4),primary?'#ff753b':'#fff5d1');
 g.fillColor=color(primary?'#ffdb78':'#ffffff');g.rect(x+cut+4,y+h-8,w-2*cut-8,4);g.fill();
 g.fillColor=color(primary?'#df493c':'#069ee7');g.rect(x+cut+4,y+4,w-2*cut-8,4);g.fill();
 if(w>90){g.fillColor=color('#fff9df');g.rect(x+cut+1,y+h-15,6,6);g.fill();g.rect(x+cut+7,y+h-10,7,5);g.fill();}
}
