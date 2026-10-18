import { Node, UITransform, Graphics, Sprite, SpriteFrame, Mask, Vec3, tween, Tween } from 'cc';
import { LevelDefinition } from '../core/Level';
import { PlaySession } from '../core/Session';
import { Point, viewportForCell } from '../core/Geometry';
import { color, theme } from './Theme';
import { FusedArtwork } from './FusedArtwork';
export class BoardView {
  readonly frame: Node;
  readonly board: Node;
  readonly transform: UITransform;
  private pegs: Graphics;
  private paper: Graphics;
  private targets: Graphics;
  private fused:FusedArtwork;
  private pieces = new Map<number,Sprite>();
  private statuses = new Map<number,string>();
  private marker: Node;
  private markerGraphic: Graphics;
  private markedIndex: number|null=null;
  private viewportTween: Tween<{zoom:number;x:number;y:number}>|null=null;
  get focusing():boolean {return this.viewportTween!==null;}
  unit = 10;
  zoom = 1;
  get beadSize():number {return this.unit*.95;}
  offset: Point = { x:0,y:0 };
  constructor(parent: Node, readonly level: LevelDefinition, private beadFrame: SpriteFrame, private meltedFrame: SpriteFrame, finishedFrame?:SpriteFrame) {
    this.frame=new Node('BoardViewport');parent.addChild(this.frame);this.frame.layer=parent.layer;
    this.frame.addComponent(UITransform);
    this.frame.addComponent(Mask).type=Mask.Type.GRAPHICS_RECT;
    this.board=new Node('Board');this.frame.addChild(this.board);this.board.layer=parent.layer;
    this.transform=this.board.addComponent(UITransform);
    this.paper=this.board.addComponent(Graphics);
    const pegs=new Node('Pegs');pegs.layer=parent.layer;this.board.addChild(pegs);this.pegs=pegs.addComponent(Graphics);
    level.cells.forEach((id,index)=>{if(!id)return;const node=new Node(`Bead-${index}`);node.layer=parent.layer;this.board.addChild(node);node.addComponent(UITransform);const sprite=node.addComponent(Sprite);sprite.spriteFrame=beadFrame;sprite.sizeMode=Sprite.SizeMode.CUSTOM;this.pieces.set(index,sprite);});
    this.fused=FusedArtwork.create(this.board,level,this.unit,finishedFrame);this.fused.showCells(new Set());
    const targets=new Node('SelectedTargets');targets.layer=parent.layer;this.board.addChild(targets);this.targets=targets.addComponent(Graphics);
    this.marker=new Node('HintTarget');this.marker.layer=parent.layer;this.board.addChild(this.marker);this.markerGraphic=this.marker.addComponent(Graphics);this.marker.active=false;
  }
  layout(x:number,y:number,width:number,height:number):void {
    this.frame.setPosition(x,y);this.frame.getComponent(UITransform)!.setContentSize(width,height);
    this.unit=Math.min((width-18)/this.level.width,(height-24)/this.level.height);
    const bw=this.level.width*this.unit,bh=this.level.height*this.unit;
    this.transform.setContentSize(bw,bh);
    this.paper.clear();this.paper.fillColor=color('#b69a8540');this.paper.roundRect(-bw/2-7,-bh/2-10,bw+14,bh+14,8);this.paper.fill();
    this.paper.fillColor=color(theme.paper);this.paper.roundRect(-bw/2-7,-bh/2-5,bw+14,bh+14,8);this.paper.fill();
    this.pegs.clear();this.pegs.fillColor=color('#cfbba0');
    for(let row=0;row<this.level.height;row++)for(let col=0;col<this.level.width;col++){const cx=(col+.5)*this.unit-bw/2,cy=bh/2-(row+.5)*this.unit;this.pegs.circle(cx,cy,this.unit*.1);this.pegs.fill();}
    for(const [i,sprite] of this.pieces){sprite.node.setPosition((i%this.level.width+.5)*this.unit-bw/2,bh/2-(Math.floor(i/this.level.width)+.5)*this.unit);sprite.node.getComponent(UITransform)!.setContentSize(this.beadSize,this.beadSize);}
    this.fused.setUnit(this.unit);this.statuses.clear();this.resetViewport();
  }
  refresh(session:PlaySession,hintTarget:number|null=null):void {
    this.pegs.node.active=session.phase!=='collected';
    this.fused.showCells(session.phase==='collected'?null:session.heated);
    const focus=hintTarget!==null&&!session.filled.has(hintTarget)?hintTarget:null;
    for(const [i,sprite] of this.pieces){const done=session.filled.has(i),melted=session.heated.has(i)||session.phase==='collected',selected=this.level.cells[i]===session.selectedColor;
      const status=`${done}-${melted}-${selected}-${i===focus}`;
      if(this.statuses.get(i)===status)continue;
      const prior=this.statuses.get(i);this.statuses.set(i,status);
      sprite.node.active=!melted;
      sprite.spriteFrame=this.beadFrame;
      const tint=color(this.level.palette.find(c=>c.id===this.level.cells[i])!.hex);
      if(!done&&!melted){
        // Keep target colors readable; outlines separate active empty positions from placed beads.
        const gray=tint.r*.299+tint.g*.587+tint.b*.114;
        const saturation=selected?.65:.5;
        tint.r=Math.round((gray+(tint.r-gray)*saturation)*.88+255*.12);
        tint.g=Math.round((gray+(tint.g-gray)*saturation)*.88+248*.12);
        tint.b=Math.round((gray+(tint.b-gray)*saturation)*.88+233*.12);
        tint.a=i===focus?220:selected?195:125;
      }
      sprite.color=tint;
      if(done&&prior?.startsWith('false')){sprite.node.setScale(.65,.65,1);tween(sprite.node).to(.12,{scale:new Vec3(1,1,1)}).start();}
    }
    const g=this.targets;g.clear();
    if(session.phase==='placing'&&session.selectedColor!==null){
      const edge=color(this.level.palette.find(c=>c.id===session.selectedColor)!.hex,190);
      edge.r=Math.round(edge.r*.58);edge.g=Math.round(edge.g*.58);edge.b=Math.round(edge.b*.58);
      g.strokeColor=edge;g.lineWidth=Math.max(.6,this.unit*.055);
      for(const [i,sprite] of this.pieces){
        if(!session.filled.has(i)&&this.level.cells[i]===session.selectedColor){
          const p=sprite.node.position;g.circle(p.x,p.y,this.unit*.465);g.stroke();
        }
      }
    }
    this.showMarker(focus);
  }
  private showMarker(index:number|null):void {
    if(index===this.markedIndex)return;
    Tween.stopAllByTarget(this.marker);this.markedIndex=index;this.marker.active=index!==null;
    if(index===null)return;
    this.marker.setPosition(this.pieces.get(index)!.node.position);this.marker.setScale(1,1,1);
    const g=this.markerGraphic,u=this.unit,r=u*.72;
    g.clear();g.lineWidth=u*.23;g.strokeColor=color('#ffffff');g.roundRect(-r,-r,r*2,r*2,u*.35);g.stroke();
    g.lineWidth=u*.1;g.strokeColor=color(theme.accent);g.roundRect(-r,-r,r*2,r*2,u*.35);g.stroke();
    g.fillColor=color(theme.accent);g.moveTo(0,u*.92);g.lineTo(-u*.35,u*1.45);g.lineTo(u*.35,u*1.45);g.close();g.fill();
    tween(this.marker).repeatForever(tween<Node>().to(.42,{scale:new Vec3(1.16,1.16,1)}).to(.42,{scale:new Vec3(1,1,1)})).start();
  }
  focusCell(index:number):void {
    const target=viewportForCell(index,this.level.width,this.level.height,this.unit,this.zoom);
    this.stopFocus();const state={zoom:this.zoom,x:this.offset.x,y:this.offset.y};
    this.viewportTween=tween(state).to(.32,{zoom:target.zoom,x:target.offset.x,y:target.offset.y},{easing:'quadOut',onUpdate:()=>this.applyViewport(state.zoom,{x:state.x,y:state.y})}).call(()=>{this.viewportTween=null;}).start();
  }
  stopFocus():void {this.viewportTween?.stop();this.viewportTween=null;}
  local(ui:Point):Point {
    const p=this.transform.convertToNodeSpaceAR(new Vec3(ui.x,ui.y,0));
    return {x:p.x/this.unit+this.level.width/2,y:this.level.height/2-p.y/this.unit};
  }
  resetViewport():void {this.setViewport(1,{x:0,y:0});}
  setViewport(zoom:number,offset:Point):void {
    this.stopFocus();this.applyViewport(zoom,offset);
  }
  private applyViewport(zoom:number,offset:Point):void {
    this.zoom=Math.max(1,Math.min(3,zoom));
    const frame=this.frame.getComponent(UITransform)!;
    // Short preview windows can have a board narrower than the viewport even after zooming.
    // Allow it to move toward either edge as well as allowing oversized boards to pan.
    const bw=this.level.width*this.unit*this.zoom,bh=this.level.height*this.unit*this.zoom;
    const bx=Math.max(Math.abs(bw-frame.width)/2+35,(this.level.width-1)*this.unit*this.zoom/2),by=Math.max(Math.abs(bh-frame.height)/2+35,(this.level.height-1)*this.unit*this.zoom/2);
    this.offset={x:Math.max(-bx,Math.min(bx,offset.x)),y:Math.max(-by,Math.min(by,offset.y))};
    if(this.zoom===1)this.offset={x:0,y:0};
    this.board.setScale(this.zoom,this.zoom,1);this.board.setPosition(this.offset.x,this.offset.y,0);
  }
}
