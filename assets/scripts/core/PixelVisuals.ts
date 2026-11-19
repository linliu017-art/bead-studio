import { LevelDefinition } from './Level';
export function homeLayout(height:number,top=0,bottom=0):{titleY:number;primaryY:number;secondaryY:number;footerY:number} {
 return {titleY:top+(height-top-bottom)*.16,primaryY:height-bottom-146,secondaryY:height-bottom-79,footerY:height-bottom-26};
}
/** Hard-edged pixel colors; empty board cells remain transparent. */
export function pixelSurface(level:LevelDefinition,density=24):{width:number;height:number;pixels:Uint8Array} {
 const width=level.width*density,height=level.height*density,pixels=new Uint8Array(width*height*4);
 const palette=new Map(level.palette.map(c=>[c.id,[1,3,5].map(i=>parseInt(c.hex.slice(i,i+2),16))]));
 for(let row=0;row<level.height;row++)for(let col=0;col<level.width;col++){
  const rgb=palette.get(level.cells[row*level.width+col]);if(!rgb)continue;
  for(let y=0;y<density;y++)for(let x=0;x<density;x++){
   const offset=((row*density+y)*width+col*density+x)*4;
   for(let c=0;c<3;c++)pixels[offset+c]=rgb[c];pixels[offset+3]=255;
  }
 }
 return {width,height,pixels};
}
export function pixelBeadPixels():{width:number;height:number;pixels:Uint8Array} {
 const width=12,pixels=new Uint8Array(width*width*4);
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){
  if((x<2||x>9)&&(y<2||y>9)||x>=5&&x<=6&&y>=5&&y<=6)continue;
  const value=x<2||y>9?165:x>9||y<2?220:x<4&&y<5?255:240;
  const i=(y*width+x)*4;pixels[i]=value;pixels[i+1]=value;pixels[i+2]=value;pixels[i+3]=255;
 }
 return {width,height:width,pixels};
}

/** Preserve aspect ratio while covering the entire visible camera, including wide browsers. */
export function coverSize(imageWidth:number,imageHeight:number,width:number,height:number):{width:number;height:number} {
 if([imageWidth,imageHeight,width,height].some(n=>!Number.isFinite(n)||n<=0))throw new Error('Invalid cover dimensions');
 const scale=Math.max(width/imageWidth,height/imageHeight);return {width:imageWidth*scale,height:imageHeight*scale};
}
