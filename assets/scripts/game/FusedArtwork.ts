import { _decorator, Component, Node, UITransform, Sprite, SpriteFrame, Texture2D, Color } from 'cc';
import { LevelDefinition } from '../core/Level';
import { fusedSurface } from '../core/FusedSurface';
const {ccclass}=_decorator;

/** Shared by the board and collection preview so both show the same sealed finish. */
@ccclass('FusedArtwork')
export class FusedArtwork extends Component {
  private texture!:Texture2D;
  private frame!:SpriteFrame;
  private level!:LevelDefinition;
  private surface!:ReturnType<typeof fusedSurface>;
  private lastCount=-2;
  private surfaceNode!:Node;private shadowNode!:Node;private finishedNode:Node|null=null;
  private readonly density=24;
  static create(parent:Node,level:LevelDefinition,unit:number,finishedFrame?:SpriteFrame):FusedArtwork {
    const node=new Node('FusedArtwork');node.layer=parent.layer;parent.addChild(node);
    node.addComponent(UITransform);
    const artwork=node.addComponent(FusedArtwork);artwork.level=level;artwork.surface=fusedSurface(level,artwork.density);
    artwork.texture=new Texture2D();artwork.texture.reset({width:artwork.surface.width,height:artwork.surface.height,format:Texture2D.PixelFormat.RGBA8888});
    artwork.texture.setFilters(Texture2D.Filter.LINEAR,Texture2D.Filter.LINEAR);
    artwork.frame=new SpriteFrame();artwork.frame.texture=artwork.texture;
    artwork.shadowNode=new Node('ThinContactShadow');artwork.shadowNode.layer=node.layer;node.addChild(artwork.shadowNode);
    const shadow=artwork.shadowNode.addComponent(Sprite);shadow.spriteFrame=artwork.frame;shadow.sizeMode=Sprite.SizeMode.CUSTOM;shadow.color=new Color(70,48,36,32);
    artwork.surfaceNode=new Node('SealedSurface');artwork.surfaceNode.layer=node.layer;node.addChild(artwork.surfaceNode);
    const sprite=artwork.surfaceNode.addComponent(Sprite);sprite.spriteFrame=artwork.frame;sprite.sizeMode=Sprite.SizeMode.CUSTOM;
    if(finishedFrame){
      const finished=new Node('ApprovedFinishedImage');finished.layer=node.layer;node.addChild(finished);artwork.finishedNode=finished;
      const image=finished.addComponent(Sprite);image.spriteFrame=finishedFrame;image.sizeMode=Sprite.SizeMode.CUSTOM;
    }
    artwork.setUnit(unit);return artwork;
  }
  setUnit(unit:number):void {
    const width=this.level.width*unit,height=this.level.height*unit;
    for(const node of [this.node,this.surfaceNode,this.shadowNode])node.getComponent(UITransform)!.setContentSize(width,height);
    this.shadowNode.setPosition(unit*.025,-unit*.09,0);
    if(this.finishedNode){
      const occupied=this.level.cells.flatMap((id,i)=>id?[i]:[]);
      const minX=Math.min(...occupied.map(i=>i%this.level.width)),maxX=Math.max(...occupied.map(i=>i%this.level.width));
      const minY=Math.min(...occupied.map(i=>Math.floor(i/this.level.width))),maxY=Math.max(...occupied.map(i=>Math.floor(i/this.level.width)));
      const rect=this.finishedNode.getComponent(Sprite)!.spriteFrame!.rect;
      const scale=Math.min((maxX-minX+1)*unit/rect.width,(maxY-minY+1)*unit/rect.height);
      this.finishedNode.getComponent(UITransform)!.setContentSize(rect.width*scale,rect.height*scale);
      this.finishedNode.setPosition((minX+maxX+1-this.level.width)*unit/2,(this.level.height-minY-maxY-1)*unit/2,0);
    }
  }
  showCells(cells:ReadonlySet<number>|null):void {
    const count=cells===null?-1:cells.size;this.node.active=count!==0;if(count===this.lastCount)return;this.lastCount=count;
    const finished=!!this.finishedNode&&(cells===null||cells.size===this.level.cells.filter(Boolean).length);
    if(this.finishedNode)this.finishedNode.active=finished;
    this.surfaceNode.active=!finished;this.shadowNode.active=!finished;
    if(finished)return;
    if(cells===null){this.texture.uploadData(this.surface.pixels);return;}
    const pixels=this.surface.pixels.slice(),width=this.surface.width;
    for(let row=0;row<this.level.height;row++)for(let col=0;col<this.level.width;col++){
      if(cells.has(row*this.level.width+col))continue;
      for(let y=0;y<this.density;y++)for(let x=0;x<this.density;x++)pixels[((row*this.density+y)*width+col*this.density+x)*4+3]=0;
    }
    this.texture.uploadData(pixels);
  }
  onDestroy():void {this.frame?.destroy();this.texture?.destroy();}
}
