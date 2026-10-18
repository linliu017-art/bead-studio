import { game, Graphics, Node, Sprite, SpriteFrame, Tween, tween, UITransform } from 'cc';
import { Point } from '../core/Geometry';
import { color } from './Theme';

/** Screen-space tool: its bead centre is the input hotspot, regardless of board zoom. */
export class TweezersCursor {
  private node:Node;
  private tool:Graphics;
  private bead:Sprite;
  private size=0;
  private hex='';
  private loaded=true;
  private motion={open:0,lift:0};
  private animation:Tween<{open:number;lift:number}>|null=null;
  private canvas=game.canvas;
  private previousCursor:string|null=null;
  constructor(parent:Node,frame:SpriteFrame,private leave:()=>void) {
    this.node=new Node('BeadTweezersCursor');parent.addChild(this.node);this.node.layer=parent.layer;
    const beadNode=new Node('HeldBead');this.node.addChild(beadNode);beadNode.layer=parent.layer;
    beadNode.addComponent(UITransform);this.bead=beadNode.addComponent(Sprite);this.bead.spriteFrame=frame;this.bead.sizeMode=Sprite.SizeMode.CUSTOM;
    const arms=new Node('PastelPlasticTweezers');this.node.addChild(arms);arms.layer=parent.layer;this.tool=arms.addComponent(Graphics);
    this.node.active=false;
    this.canvas?.addEventListener?.('mouseleave',this.leave);
  }
  show(point:Point,hex:string,size:number,zoom:number,loaded:boolean):void {
    // Keep the jaw geometry in unzoomed coordinates; scale the complete tool and bead together.
    this.node.setPosition(point.x,point.y,0);this.node.setScale(zoom,zoom,1);this.node.active=true;
    if(this.canvas?.style&&this.previousCursor===null){this.previousCursor=this.canvas.style.cursor;this.canvas.style.cursor='none';}
    if(this.hex!==hex){this.hex=hex;this.bead.color=color(hex);}
    if(this.size!==size||this.loaded!==loaded){this.size=size;this.loaded=loaded;this.draw();}
  }
  hide():void {
    if(!this.node.active&&this.previousCursor===null)return;
    this.node.active=false;
    if(this.canvas?.style&&this.previousCursor!==null){this.canvas.style.cursor=this.previousCursor;this.previousCursor=null;}
    this.animation?.stop();this.animation=null;this.motion.open=0;this.motion.lift=0;
    this.draw();
  }
  release():void {
    if(!this.node.active)return;
    this.animation?.stop();this.motion.open=0;this.motion.lift=0;
    this.animation=tween(this.motion).to(.065,{open:1,lift:2},{onUpdate:()=>this.draw()})
      .to(.12,{open:0,lift:0},{onUpdate:()=>this.draw()}).call(()=>{this.animation=null;}).start();
  }
  private draw():void {
    const g=this.tool,spread=this.size*.43+this.motion.open*3,lift=this.motion.lift;
    const px=-spread*.5,py=spread*.866,qx=-px,qy=-py;
    g.node.setPosition(0,lift,0);
    g.clear();
    // Broad, bent plastic jaws follow the reference; their tips stay around the bead hotspot.
    g.fillColor=color('#9a65bd');
    g.moveTo(qx-1,qy-1);g.bezierCurveTo(9,-7,19,-2,25,3);
    g.lineTo(77,33);g.bezierCurveTo(82,36,84,39,80,44);
    g.lineTo(74,41);g.lineTo(18,7);g.bezierCurveTo(11,3,qx+2,qy+4,qx-1,qy-1);g.close();g.fill();
    g.fillColor=color('#bd8bdd');
    g.moveTo(qx-1,qy+1);g.bezierCurveTo(10,-3,17,1,23,6);
    g.lineTo(77,39);g.lineTo(76,45);g.bezierCurveTo(73,47,70,38,68,37);
    g.lineTo(19,9);g.bezierCurveTo(12,4,qx+1,qy+5,qx-1,qy+1);g.close();g.fill();
    g.lineWidth=1.4;g.strokeColor=color('#ddbcf0');
    g.moveTo(qx,qy+2);g.bezierCurveTo(10,-1,16,3,21,8);g.lineTo(72,40);g.stroke();
    // Raised grip ribs on the purple arm.
    g.lineWidth=2.4;g.strokeColor=color('#e7caf5');
    for(let i=0;i<5;i++){const x=38+i*3.2,y=15+i*1.98;g.moveTo(x,y);g.lineTo(x-2.2,y+4.4);g.stroke();}
    // Upper pink arm overlaps the joined end and curves down to the other jaw.
    g.fillColor=color('#eaa0ca');
    g.moveTo(px-1,py-1);g.bezierCurveTo(1,12,7,20,14,23);
    g.lineTo(69,47);g.bezierCurveTo(74,50,79,47,80,43);
    g.bezierCurveTo(79,39,77,38,74,37);g.lineTo(17,16);
    g.bezierCurveTo(10,12,px+4,py-1,px-1,py-1);g.close();g.fill();
    g.fillColor=color('#f6c0df');
    g.moveTo(px-1,py+1);g.bezierCurveTo(2,14,8,21,15,24);
    g.lineTo(70,47);g.bezierCurveTo(74,49,78,47,79,44);
    g.bezierCurveTo(77,42,75,41,72,40);g.lineTo(17,19);
    g.bezierCurveTo(10,15,px+3,py+1,px-1,py+1);g.close();g.fill();
    g.lineWidth=1.5;g.strokeColor=color('#fce0ef');
    g.moveTo(px,py+2);g.bezierCurveTo(3,15,9,22,16,25);g.lineTo(69,47);g.stroke();
    this.bead.node.active=this.loaded&&this.motion.open<.55;
    this.bead.node.getComponent(UITransform)!.setContentSize(this.size,this.size);
    this.bead.node.setPosition(0,lift,0);
  }
  destroy():void {this.hide();this.canvas?.removeEventListener?.('mouseleave',this.leave);this.node.destroy();}
}
