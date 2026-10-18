import { LevelDefinition } from './Level';

/** A thin, sealed craft: soft color joins and restrained texture, never individual domed tiles. */
export function fusedSurface(level:LevelDefinition,pixelsPerCell=24):{width:number;height:number;pixels:Uint8Array} {
  const width=level.width*pixelsPerCell,height=level.height*pixelsPerCell,pixels=new Uint8Array(width*height*4);
  const palette=new Map(level.palette.map(c=>[c.id,[1,3,5].map(start=>parseInt(c.hex.slice(start,start+2),16))]));
  const cell=(x:number,y:number):number=>x>=0&&x<level.width&&y>=0&&y<level.height?level.cells[y*level.width+x]:0;
  const radius=pixelsPerCell*.3,blendWidth=pixelsPerCell*.075;
  const noise=(x:number,y:number):number=>{let h=Math.imul(x+19,374761393)^Math.imul(y+71,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
  const smooth=(t:number):number=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  for(let row=0;row<level.height;row++)for(let col=0;col<level.width;col++){
    const id=cell(col,row);if(!id)continue;
    const rgb=palette.get(id)!,neighbors=[cell(col-1,row),cell(col+1,row),cell(col,row-1),cell(col,row+1)];
    const [left,right,top,bottom]=neighbors.map(id=>!id);
    for(let py=0;py<pixelsPerCell;py++)for(let px=0;px<pixelsPerCell;px++){
      const x=px+.5,y=py+.5,gx=col*pixelsPerCell+px,gy=row*pixelsPerCell+py;
      const dx=left&&x<radius?radius-x:right&&x>pixelsPerCell-radius?x-(pixelsPerCell-radius):0;
      const dy=top&&y<radius?radius-y:bottom&&y>pixelsPerCell-radius?y-(pixelsPerCell-radius):0;
      const alpha=dx&&dy?Math.max(0,Math.min(1,radius-Math.hypot(dx,dy)+.5)):1;
      // Blend only occupied color joins. Adjacent cells never acquire transparent seams.
      const warp=(noise(Math.floor(gx/3),Math.floor(gy/3))-.5)*.35;
      const distances=[x+warp,pixelsPerCell-x-warp,y+warp,pixelsPerCell-y-warp];
      const weights=neighbors.map((neighbor,i)=>neighbor&&neighbor!==id?(1-smooth(distances[i]/blendWidth))*.42:0);
      const grain=(noise(gx,gy)-.5)*.028+(noise(Math.floor(gx/2),Math.floor(gy/2))-.5)*.022;
      const glint=noise(gx+391,gy+97)>.98?.013:0;
      // Barely visible fused-cell impressions, without center holes or heavy raised borders.
      const u=x/pixelsPerCell-.48,v=y/pixelsPerCell-.47;
      const impression=-.009*Math.exp(-(u*u+v*v)/.024);
      const bevel=(top&&y<1.5?.025:0)+(left&&x<1?.012:0)-(bottom&&y>pixelsPerCell-1.5?.035:0);
      const offset=(gy*width+gx)*4;
      for(let channel=0;channel<3;channel++){
        let base=rgb[channel];
        for(let side=0;side<4;side++)if(weights[side])base+=(palette.get(neighbors[side])![channel]-base)*weights[side];
        pixels[offset+channel]=Math.max(0,Math.min(255,Math.round(base*(1+grain+bevel+impression)+255*glint)));
      }
      pixels[offset+3]=Math.round(alpha*255);
    }
  }
  return {width,height,pixels};
}
