import { Graphics, Layers, Node } from 'cc';
import { Animal, illustration } from '../core/CartoonArt';
import { color } from './Theme';

/** Art is non-interactive; the game's existing buttons retain their hit areas. */
export function cartoonArtwork(parent:Node, type:Animal|'party'|'flower'|'beads', scale=1):Node {
  const node=new Node('Cartoon-'+type);parent.addChild(node);node.layer=Layers.Enum.UI_2D;
  node.setScale(scale,scale,1);
  const g=node.addComponent(Graphics);
  illustration(type).forEach(s=>{
    g.lineWidth=s.kind==='path'?s.width??1.7:1.7;
    g.fillColor=color(s.fill??'#ffffff');g.strokeColor=color(s.stroke??'#ffffff');
    if(s.kind==='ellipse')g.ellipse(s.x,-s.y,s.rx,s.ry);
    else if(s.kind==='box')g.roundRect(s.x,-s.y-s.h,s.w,s.h,s.r);
    else {s.points.forEach(([x,y],i)=>i?g.lineTo(x,-y):g.moveTo(x,-y));if(s.closed)g.close();}
    if(s.fill)g.fill();if(s.stroke)g.stroke();
  });
  return node;
}
