import {
  _decorator, Component, Node, Canvas, UITransform, Camera, Color, Graphics,
  Label, Layers, view, ResolutionPolicy, resources, JsonAsset, SpriteFrame, Sprite, Mask, ScrollView,
  EventTouch, EventMouse, EventKeyboard, input, Input, KeyCode, sys, game, Game, profiler, AudioSource, AudioClip, BlockInputEvents, Vec3, tween, Tween,
} from 'cc';
import { validateLevel, LevelDefinition } from '../core/Level';
import { PlaySession } from '../core/Session';
import { PlayerRecord, SaveRepository, newRecord, collectionCandidate } from '../core/SaveRepository';
import { levelStoragePrefix, levelUnlocked, loadLevel } from '../core/LevelAccess';
import { Point, GestureState, BoardPanGesture, traverseGrid, centeredUiPoint } from '../core/Geometry';
import { PlatformStorage } from '../platform/Platform';
import { BoardView } from './BoardView';
import { FusedArtwork } from './FusedArtwork';
import { TweezersCursor } from './TweezersCursor';
import { color, theme } from './Theme';
const { ccclass }=_decorator;
interface Action { title:string; run:()=>void; primary?:boolean }
@ccclass('BeadGame')
export class BeadGame extends Component {
  private root!:Node;private hud!:Node;private overlay!:Node;private worldHeight=844;
  private levels:LevelDefinition[]=[];private level!:LevelDefinition;private session!:PlaySession;private record!:PlayerRecord;private repo!:SaveRepository;
  private storage=new PlatformStorage();private board!:BoardView;private bead!:SpriteFrame;private melted!:SpriteFrame;private finished!:SpriteFrame;private finishedFrames:SpriteFrame[]=[];
  private guide!:Label;private progress!:Label;private counter!:Label;private actionText!:Label;private boardSizeText!:Label;
  private steps:Label[]=[];private stepDots:Graphics[]=[];private palette:Node[]=[];private paletteCounts:Label[]=[];private paletteFrames:Graphics[]=[];
  private paletteStock:Node[][]=[];private paletteGlass:Graphics[]=[];
  private openDrawerColor:number|null=null;
  private paletteDrawers:Node[]=[];private paletteDrawerStates:{amount:number;open:boolean}[]=[];
  private progressGraphic!:Graphics;private actionGraphic!:Graphics;private actionNode!:Node;private shade!:Graphics;private iron!:Node;
  private gesture=new GestureState();private touches=new Map<number,Point>();private last:Point|null=null;
  private panDrag=new BoardPanGesture();private panModifier=false;private rightPanning=false;
  private pendingStart:{id:number;point:Point}|null=null;
  private pinch:{distance:number;zoom:number;mid:Point;offset:Point}|null=null;
  private activeModal=false;private hintTarget:number|null=null;private lastHintTarget:number|null=null;private dirty=false;private elapsed=0;private ready=false;private blocked=false;private saveFailed=false;private wasHidden=false;private collectedBusy=false;
  private audio!:AudioSource;private clip:AudioClip|null=null;private lastSound=0;private lastActionEnabled=false;private stageTop=96;private stageHeight=390;private boardCenterY=0;private bottom=0;
  private toastNode:Node|null=null;private screen: 'home'|'levels'|'collection'|'game'='game';
  private tweezers:TweezersCursor|null=null;private mousePoint:Point|null=null;
  start():void {
    profiler.hideStats();
    view.setDesignResolutionSize(390,844,ResolutionPolicy.FIXED_WIDTH);
    this.worldHeight=view.getVisibleSize().height;
    this.root=new Node('GameCanvas');this.node.addChild(this.root);this.root.layer=Layers.Enum.UI_2D;
    this.root.addComponent(UITransform).setContentSize(390,this.worldHeight);
    const canvas=this.root.addComponent(Canvas);
    const camNode=new Node('UICamera');this.root.addChild(camNode);camNode.layer=Layers.Enum.UI_2D;camNode.setPosition(0,0,1000);
    const camera=camNode.addComponent(Camera);camera.projection=Camera.ProjectionType.ORTHO;camera.orthoHeight=this.worldHeight/2;camera.visibility=Layers.Enum.UI_2D;camera.clearFlags=Camera.ClearFlag.SOLID_COLOR;camera.clearColor=color(theme.background);canvas.cameraComponent=camera;
    this.hud=this.container('HUD',this.root);this.overlay=this.container('Overlays',this.root);
    this.audio=this.node.addComponent(AudioSource);
    resources.load('audio/bead',AudioClip,(err,clip)=>{if(!err)this.clip=clip;});
    this.label(this.hud,'正在打开你的拼豆桌…',195,this.worldHeight/2,18,theme.text,340);
    Promise.all([Promise.all(['dessert-001','dessert-002','dessert-003','dessert-004','dessert-005','dessert-006'].map(id=>this.load<JsonAsset>('levels/'+id,JsonAsset))),this.load<SpriteFrame>('art/bead/spriteFrame',SpriteFrame),this.load<SpriteFrame>('art/melted/spriteFrame',SpriteFrame),Promise.all(['finished-cake','finished-soda','finished-pudding','finished-pancake','finished-sandwich','finished-cat-cup'].map(name=>this.load<SpriteFrame>('art/'+name+'/spriteFrame',SpriteFrame)))]).then(([asset,bead,melted,finished])=>{
      this.levels=asset.map(item=>validateLevel(item.json));this.level=this.levels[0];try{const recent=this.storage.get('bead-studio-recent-level');const index=this.levels.findIndex(level=>level.id===recent);if(index>0&&levelUnlocked(this.levels,index,this.storage))this.level=this.levels[index];}catch{}this.bead=bead;this.melted=melted;this.finishedFrames=finished;this.finished=finished[0];
      this.repo=new SaveRepository(this.storage,this.level,levelStoragePrefix(this.level));
      const loaded=this.repo.load();
      this.record=('record' in loaded)?loaded.record:newRecord(this.level);
      this.session=PlaySession.restore(this.level,this.record.session);this.openDrawerColor=this.session.selectedColor;
      this.build();this.ready=true;this.refresh();
      if(loaded.kind==='invalid'||loaded.kind==='storage-error'){this.blocked=true;this.recovery(loaded.kind);}
      else { if(loaded.kind==='empty'){this.dirty=true;this.flush();} this.showHome(); if(loaded.kind==='backup')this.toast('已从备用记录恢复进度'); }
    }).catch((error:unknown)=>{console.error("First level initialization failed",error);this.hud.destroyAllChildren();this.label(this.hud,'作品暂时没打开',195,this.worldHeight/2-25,22,theme.text,330);this.button(this.hud,'重试',195,this.worldHeight/2+35,180,46,()=>{this.ready=false;this.startAgain();},true);});
    game.on(Game.EVENT_HIDE,this.onHide,this);game.on(Game.EVENT_SHOW,this.onShow,this);view.on('canvas-resize',this.onResize,this);
    input.on(Input.EventType.KEY_DOWN,this.keyDown,this);input.on(Input.EventType.KEY_UP,this.keyUp,this);
    input.on(Input.EventType.MOUSE_MOVE,this.mouseMove,this);input.on(Input.EventType.MOUSE_UP,this.mouseUp,this);
    input.on(Input.EventType.MOUSE_DOWN,this.trackMouse,this);
  }
  private startAgain():void {
    Promise.all([Promise.all(['dessert-001','dessert-002','dessert-003','dessert-004','dessert-005','dessert-006'].map(id=>this.load<JsonAsset>('levels/'+id,JsonAsset))),this.load<SpriteFrame>('art/bead/spriteFrame',SpriteFrame),this.load<SpriteFrame>('art/melted/spriteFrame',SpriteFrame),Promise.all(['finished-cake','finished-soda','finished-pudding','finished-pancake','finished-sandwich','finished-cat-cup'].map(name=>this.load<SpriteFrame>('art/'+name+'/spriteFrame',SpriteFrame)))]).then(([assets,bead,melted,finished])=>{
      this.levels=assets.map(item=>validateLevel(item.json));this.level=this.levels[0];this.bead=bead;this.melted=melted;this.finishedFrames=finished;this.finished=finished[0];
      this.repo=new SaveRepository(this.storage,this.level,levelStoragePrefix(this.level));const r=this.repo.load();this.record='record'in r?r.record:newRecord(this.level);this.session=PlaySession.restore(this.level,this.record.session);this.openDrawerColor=this.session.selectedColor;this.build();this.ready=true;this.refresh();
      if(r.kind==='invalid'||r.kind==='storage-error'){this.blocked=true;this.recovery(r.kind);}else this.showHome();
    }).catch(()=>this.toast('资源读取失败，请重试'));
  }
  private load<T>(path:string,type:typeof JsonAsset|typeof SpriteFrame):Promise<T>{return new Promise((resolve,reject)=>{resources.load(path,type as typeof JsonAsset,(err,asset)=>{if(err)reject(err);else resolve(asset as unknown as T);});});}
  private container(name:string,parent:Node):Node {const n=new Node(name);parent.addChild(n);n.layer=Layers.Enum.UI_2D;return n;}
  private position(n:Node,x:number,y:number):void {n.setPosition(x-195,this.worldHeight/2-y,0);}
  private panel(parent:Node,x:number,y:number,w:number,h:number,fill:string,stroke?:string,r=16):Graphics {
    const n=this.container('Surface',parent);this.position(n,x,y);n.addComponent(UITransform).setContentSize(w,h);const g=n.addComponent(Graphics);this.box(g,w,h,fill,stroke,r);return g;
  }
  private box(g:Graphics,w:number,h:number,fill:string,stroke?:string,r=14):void {g.clear();g.fillColor=color(fill);g.roundRect(-w/2,-h/2,w,h,Math.min(r,w/2,h/2));g.fill();if(stroke){g.strokeColor=color(stroke);g.lineWidth=1;g.stroke();}}
  private label(parent:Node,text:string,x:number,y:number,size=13,fill=theme.text,width=350,bold=false):Label {
    const n=this.container('Text',parent);this.position(n,x,y);n.addComponent(UITransform).setContentSize(width,size*2.5);const l=n.addComponent(Label);l.string=text;l.fontFamily='PingFang SC';l.useSystemFont=true;l.fontSize=size;l.lineHeight=size*1.5;l.color=color(fill);l.isBold=bold;l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;l.overflow=Label.Overflow.SHRINK;l.enableWrapText=true;return l;
  }
  private button(parent:Node,text:string,x:number,y:number,w:number,h:number,run:()=>void,primary=false):{node:Node;label:Label;graphic:Graphics} {
    const n=this.container('Button',parent);this.position(n,x,y);n.addComponent(UITransform).setContentSize(w,h);
    const g=n.addComponent(Graphics);this.box(g,w,h,primary?theme.accent:theme.pale,primary?'#bd3d55':'#e5c4b9',13);
    const label=this.label(n,text,195,this.worldHeight/2,13,primary?'#ffffff':theme.text,w-12,true);
    n.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{e.propagationStopped=true;run();});return{node:n,label,graphic:g};
  }
  private build():void {
    this.tweezers?.destroy();this.tweezers=null;this.mousePoint=null;
    this.board?.stopFocus();this.clearHint(true);
    this.paletteDrawerStates.forEach(state=>Tween.stopAllByTarget(state));
    this.paletteDrawers=[];this.paletteDrawerStates=[];
    this.hud.destroyAllChildren();this.closeModal();this.palette=[];this.paletteCounts=[];this.paletteFrames=[];this.paletteStock=[];this.paletteGlass=[];this.steps=[];this.stepDots=[];this.clearInput();
    this.worldHeight=view.getVisibleSize().height;const H=this.worldHeight;this.root.getComponent(UITransform)!.setContentSize(390,H);
    const insets=this.storage.safeInsets(390);this.bottom=insets.bottom;
    const top=insets.top;this.stageTop=top+96;this.stageHeight=Math.max(160,H-this.stageTop-178-this.bottom);
    this.button(this.hud,'‹',37,top+29,38,38,()=>this.showExit());
    this.label(this.hud,String(this.level.order).padStart(2,'0')+'关 '+this.level.title,195,top+29,18,theme.text,252,true);
    this.button(this.hud,'···',350,top+29,44,34,()=>this.showSettings());
    ['拼豆','熨烫','收藏'].forEach((text,i)=>{
      const x=110+i*84;const dot=this.panel(this.hud,x-19,top+70,19,19,theme.pale,undefined,10);this.stepDots.push(dot);
      this.label(this.hud,String(i+1),x-19,top+70,10,'#ffffff',18,true);
      this.steps.push(this.label(this.hud,text,x+7,top+70,11,theme.muted,48,true));
    });
    const boardTop=this.stageTop+44,boardHeight=this.stageHeight-52,centerY=boardTop+boardHeight/2;this.boardCenterY=centerY;
    const workHeight=H-this.bottom-68-this.stageTop,workCenter=this.stageTop+workHeight/2;
    this.panel(this.hud,195,workCenter+3,370,workHeight,theme.shadow,undefined,21);
    this.panel(this.hud,195,workCenter,370,workHeight,theme.board,theme.boardEdge,21);
    this.board=new BoardView(this.hud,this.level,this.bead,this.melted,this.finishedFrames[this.level.order-1]);
    this.board.layout(0,H/2-centerY,358,boardHeight);
    this.boardSizeText=this.label(this.hud,`${this.level.width}×${this.level.height}`,338,this.stageTop+this.stageHeight-15,10,theme.muted,52,true);
    this.shade=this.panel(this.hud,195,centerY,350,boardHeight-6,'#fff6e379',undefined,8);this.shade.node.active=false;
    this.iron=this.container('Iron',this.hud);this.position(this.iron,195,centerY);const ironG=this.iron.addComponent(Graphics);this.box(ironG,54,72,'#fff8ee','#c38b79',22);ironG.strokeColor=color(theme.accent);ironG.lineWidth=7;ironG.roundRect(-10,-15,20,37,8);ironG.stroke();this.iron.active=false;
    const find=this.button(this.hud,'',345,this.stageTop+22,40,36,()=>this.findRemaining());
    find.node.name='FindRemainingButton';find.label.node.destroy();find.node.getComponent(UITransform)!.setContentSize(44,44);
    const lens=this.container('MagnifierIcon',find.node).addComponent(Graphics);
    lens.lineWidth=2.6;lens.strokeColor=color(theme.text);lens.fillColor=color('#fff8f2');
    lens.circle(-2,2,7);lens.fill();lens.stroke();
    lens.lineWidth=3;lens.moveTo(3,-3);lens.lineTo(9,-9);lens.stroke();
    lens.fillColor=color(theme.text);lens.circle(9,-9,1.5);lens.fill();
    const paletteTop=H-this.bottom-207;
    this.level.palette.forEach((c,i)=>{
      const x=40+i*51.5,n=this.container('Color-'+c.code,this.hud);this.position(n,x,paletteTop+64);n.addComponent(UITransform).setContentSize(48,90);
      const g=n.addComponent(Graphics);this.paletteFrames.push(g);
      const drawer=this.container('SlidingDrawer',n);this.paletteDrawers.push(drawer);this.paletteDrawerStates.push({amount:0,open:false});
      const tray=drawer.addComponent(Graphics);
      tray.fillColor=color('#fff8f2',80);tray.strokeColor=color('#ffffff',230);tray.lineWidth=1.2;
      tray.roundRect(-20,-8,40,35,4);tray.fill();tray.stroke();
      const stock:Node[]=[];
      // A fixed scatter avoids the pile jumping when a bead is consumed.
      const scatter=[[-12,-5,21],[-3,-6,-28],[7,-5,38],[13,-1,-15],[-13,3,-33],[-4,2,12],[5,3,-19],[13,6,25],[-12,11,30],[-3,10,-24],[7,11,16],[13,15,-35],[-10,17,-16],[-1,18,33],[8,19,-26],[-5,24,18],[4,25,-18]];
      scatter.forEach(([x,y,angle],j)=>{
        const bead=this.container('StockBead-'+j,drawer);bead.setPosition(x,11+(y+6)*.38);bead.setScale(.9,.72,1);bead.angle=angle;
        const b=bead.addComponent(Graphics),base=color(c.hex);
        const shade=new Color(Math.round(base.r*.72),Math.round(base.g*.72),Math.round(base.b*.72),255);
        b.fillColor=shade;b.roundRect(-4,-4,8,6,2);b.fill();b.ellipse(0,-3,4,2.6);b.fill();
        b.fillColor=base;b.ellipse(0,2,4,3);b.fill();
        b.strokeColor=color('#ffffff',110);b.lineWidth=.6;b.ellipse(0,2.3,3.4,2.4);b.stroke();
        b.fillColor=shade;b.ellipse(0,2,1.65,1.3);b.fill();
        b.fillColor=color('#ffffff',55);b.roundRect(-3.1,-2.8,.8,3.5,.4);b.fill();
        stock.push(bead);
      });
      this.paletteStock.push(stock);
      this.paletteGlass.push(this.container('DrawerFront',drawer).addComponent(Graphics));
      const lid=this.container('FixedCabinetTop',n).addComponent(Graphics);
      // A clear fixed top keeps the stored beads visible while the tray is closed.
      lid.fillColor=color('#ffffff',28);lid.strokeColor=color('#ffffff',225);lid.lineWidth=1.3;
      lid.roundRect(-22,8,44,23,5);lid.fill();lid.stroke();
      lid.fillColor=color('#ffffff',32);lid.roundRect(-19,12,38,16,3);lid.fill();
      lid.fillColor=color('#ffffff',90);lid.moveTo(-17,12);lid.lineTo(-8,12);lid.lineTo(4,28);lid.lineTo(-5,28);lid.close();lid.fill();
      lid.strokeColor=color('#c7adb1',130);lid.lineWidth=.7;lid.moveTo(-18,10);lid.lineTo(18,10);lid.stroke();
      lid.strokeColor=color('#ffffff',190);lid.lineWidth=1.5;lid.moveTo(-15,26);lid.lineTo(9,26);lid.stroke();
      this.paletteCounts.push(this.label(n,'',195,H/2+40,9.5,theme.text,48));this.palette.push(n);
      n.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{e.propagationStopped=true;if(this.activeModal||this.blocked||!['placing','ready-to-iron'].includes(this.session.phase))return;this.openDrawerColor=this.openDrawerColor===c.id?null:c.id;this.session.selectedColor=this.openDrawerColor;this.clearHint(true);this.dirty=true;this.refresh();if(this.record.tutorialStep===0)this.record.tutorialStep=1;});
    });
    this.guide=this.label(this.hud,'',195,paletteTop+123,10,theme.muted,350);
    this.progress=this.label(this.hud,'0%',46,H-this.bottom-43,21,'#c05665',75,true);
    this.counter=this.label(this.hud,'',150,H-this.bottom-42,10,theme.muted,140);
    this.progressGraphic=this.panel(this.hud,134,H-this.bottom-23,224,6,'#eedacf',undefined,3);
    const action=this.button(this.hud,'',315,H-this.bottom-36,112,46,()=>this.next(),true);this.actionNode=action.node;this.actionText=action.label;this.actionGraphic=action.graphic;
    this.bindBoard();
    if(sys.isBrowser&&!sys.isMobile)this.tweezers=new TweezersCursor(this.root,this.bead,()=>{this.mousePoint=null;this.tweezers?.hide();});
  }
  private drawBeadBox(back:Graphics,front:Graphics,selected:boolean,hex:string):void {
    back.clear();front.clear();
    back.fillColor=color('#825e67',20);back.ellipse(0,-16,22,4);back.fill();
    back.fillColor=color('#ffffff',22);back.strokeColor=color('#ffffff',210);back.lineWidth=1.2;
    back.roundRect(-22,-14,44,44,5);back.fill();back.stroke();
    back.fillColor=color('#a48b92',24);back.roundRect(-19,-10,38,20,3);back.fill();
    // A color-matched front identifies even an empty, closed drawer.
    const base=color(hex),edge=new Color(Math.round(base.r*.65),Math.round(base.g*.65),Math.round(base.b*.65),selected?255:180);
    front.fillColor=color(hex,235);front.strokeColor=edge;front.lineWidth=selected?1.8:1;
    front.roundRect(-21,-12,42,21,4);front.fill();front.stroke();
    front.strokeColor=color('#ffffff',220);front.lineWidth=1.6;front.moveTo(-17,6);front.lineTo(16,6);front.stroke();
    front.lineWidth=1;front.moveTo(-17,3);front.lineTo(-17,-7);front.stroke();
    front.fillColor=color('#ffffff',100);front.roundRect(-9,-5,18,8,3);front.fill();
    front.strokeColor=color('#ffffff',245);front.lineWidth=1.2;front.roundRect(-9,-5,18,8,3);front.stroke();
    front.fillColor=color('#ffffff',230);front.roundRect(-6,-2.8,12,3.3,1.6);front.fill();
  }
  private setDrawerOpen(index:number,open:boolean):void {
    const state=this.paletteDrawerStates[index];if(state.open===open)return;
    state.open=open;Tween.stopAllByTarget(state);
    tween(state).to(.24,{amount:open?1:0},{easing:'quadOut',onUpdate:()=>{
      const node=this.paletteDrawers[index];if(node?.isValid)node.setPosition(0,-18*state.amount,0);
    }}).start();
  }
  private bindBoard():void {
    this.board.frame.on(Node.EventType.TOUCH_START,this.touchStart,this);this.board.frame.on(Node.EventType.TOUCH_MOVE,this.touchMove,this);this.board.frame.on(Node.EventType.TOUCH_END,this.touchEnd,this);this.board.frame.on(Node.EventType.TOUCH_CANCEL,this.touchCancel,this);
    this.board.frame.on(Node.EventType.MOUSE_DOWN,this.mouseDown,this);this.board.frame.on(Node.EventType.MOUSE_MOVE,this.mouseMove,this);this.board.frame.on(Node.EventType.MOUSE_UP,this.mouseUp,this);
    this.board.frame.on(Node.EventType.MOUSE_WHEEL,(e:EventMouse)=>{if(this.activeModal||this.blocked||this.session.phase!=='placing')return;this.clearInput();this.board.setViewport(this.board.zoom+(e.getScrollY()>0?.2:-.2),this.board.offset);this.refresh();});
  }
  private keyDown(e:EventKeyboard):void {if(e.keyCode===KeyCode.SPACE){if(!this.panModifier)this.clearInput();this.panModifier=true;}}
  private keyUp(e:EventKeyboard):void {if(e.keyCode===KeyCode.SPACE){this.panModifier=false;if(this.gesture.mode==='panning')this.clearInput();}}
  private mouseDown(e:EventMouse):void {
    this.mousePoint=centeredUiPoint(e.getUILocation(),390,this.worldHeight);
    if(e.getButton()===EventMouse.BUTTON_RIGHT||e.getButton()===EventMouse.BUTTON_MIDDLE){
      // Creator dispatches a simulated touch before the mouse event, including for right click.
      // Clear that pending touch before it can place anything.
      this.clearInput();
      if(this.activeModal||this.blocked||this.session.phase!=='placing')return;
      this.rightPanning=true;this.panDrag.start(centeredUiPoint(e.getUILocation(),390,this.worldHeight),this.board.offset);
    }else {this.refreshTweezers();this.commitStart();}
  }
  private trackMouse(e:EventMouse):void {this.mousePoint=centeredUiPoint(e.getUILocation(),390,this.worldHeight);this.refreshTweezers();}
  private mouseMove(e:EventMouse):void {this.mousePoint=centeredUiPoint(e.getUILocation(),390,this.worldHeight);if(!this.rightPanning||this.activeModal||this.blocked)return;const offset=this.panDrag.move(this.mousePoint);if(offset)this.board.setViewport(this.board.zoom,offset);}
  private mouseUp(e:EventMouse):void {this.trackMouse(e);if(this.rightPanning&&(e.getButton()===EventMouse.BUTTON_RIGHT||e.getButton()===EventMouse.BUTTON_MIDDLE))this.clearInput();}
  private commitStart():void {
    const pending=this.pendingStart;this.pendingStart=null;
    if(!pending||this.activeModal||this.blocked||!this.touches.has(pending.id)||this.gesture.mode!=='placing')return;
    if(this.session.phase==='ready-to-reveal'){this.next();return;}
    this.last=this.board.local(pending.point);this.apply(this.last,this.last,pending.point);
  }
  private uiPoint(e:EventTouch):Point {const p=e.getUILocation();return centeredUiPoint(p,390,this.worldHeight);}
  private touchStart(e:EventTouch):void {
    if(this.activeModal||this.blocked||!e.touch)return;e.propagationStopped=true;
    this.board.stopFocus();
    const p=this.uiPoint(e),id=e.touch.getID();this.touches.set(id,p);this.gesture.start(id,this.panModifier&&this.session.phase==='placing'?'panning':'placing');
    if(this.touches.size>=2){this.pendingStart=null;this.panDrag.cancel();const[a,b]=Array.from(this.touches.values());this.pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:this.board.zoom,mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},offset:{...this.board.offset}};this.last=null;return;}
    if(this.gesture.mode==='panning'){this.panDrag.start(p,this.board.offset);this.last=null;return;}
    if(this.gesture.mode!=='placing')return;
    const pending={id,point:p};this.pendingStart=pending;
    this.scheduleOnce(()=>{if(this.pendingStart===pending)this.commitStart();},0);
  }
  private touchMove(e:EventTouch):void {
    if(this.activeModal||this.blocked||!e.touch)return;const id=e.touch.getID();if(!this.touches.has(id))return;e.propagationStopped=true;const p=this.uiPoint(e);this.touches.set(id,p);
    if(this.gesture.mode==='transforming'&&this.pinch&&this.touches.size>=2){const[a,b]=Array.from(this.touches.values()),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};const z=Math.max(1,Math.min(3,this.pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(.1,this.pinch.distance)));const ratio=z/this.pinch.zoom;const frame=this.board.frame.worldPosition;
      this.board.setViewport(z,{x:mid.x-frame.x-(this.pinch.mid.x-frame.x-this.pinch.offset.x)*ratio,y:mid.y-frame.y-(this.pinch.mid.y-frame.y-this.pinch.offset.y)*ratio});this.refreshViewportHint();return;}
    if(this.gesture.mode==='panning'){const offset=this.panDrag.move(p);if(offset)this.board.setViewport(this.board.zoom,offset);return;}
    if(this.gesture.mode!=='placing')return;this.commitStart();
    const local=this.board.local(p);if(this.last)this.apply(this.last,local,p);this.last=local;
  }
  private touchEnd(e:EventTouch):void {
    if(!e.touch)return;const id=e.touch.getID();if(!this.touches.has(id))return;
    this.commitStart();if(this.gesture.mode==='panning')this.panDrag.cancel();
    this.touches.delete(id);this.gesture.end(id);this.last=null;if(!this.touches.size)this.pinch=null;this.flush();
  }
  private touchCancel():void {this.clearInput();this.flush();}
  private clearInput():void {this.touches.clear();this.gesture.cancel();this.panDrag.cancel();this.pendingStart=null;this.rightPanning=false;this.pinch=null;this.last=null;}
  private apply(a:Point,b:Point,ui:Point):void {
    const before=this.session.phase;let changes=0;
    if(before==='placing'){for(const i of traverseGrid(a,b,this.level.width,this.level.height)){if(this.session.place(i)==='accepted')changes++;}if(changes){this.tweezers?.release();this.playSound();this.record.tutorialStep=Math.max(1,this.record.tutorialStep);if(a.x!==b.x||a.y!==b.y)this.record.tutorialStep=2;}}
    else if(before==='ironing'){changes=this.session.heat(a,b).length;this.iron.setWorldPosition(ui.x,ui.y,0);}
    if(changes){if(this.hintTarget!==null&&this.session.filled.has(this.hintTarget))this.clearHint();this.dirty=true;this.refresh();if(this.session.phase!==before){this.flush();this.toast(this.session.phase==='ready-to-iron'?'每一颗都拼好了，准备熨烫吧':'熨好了，揭开你的作品吧');}else if(before==='placing'&&!this.session.remaining())this.toast('这个颜色完成了，换一种继续吧');}
  }
  private playSound():void {const now=Date.now();if(this.record.sound&&this.clip&&now-this.lastSound>83){this.audio.playOneShot(this.clip,.3);this.lastSound=now;}}
  private refresh():void {
    if(!this.board)return;const phase=this.session.phase,placing=phase==='placing'||phase==='ready-to-iron';
    this.board.refresh(this.session,this.hintTarget);this.shade.node.active=phase==='ironing'||phase==='ready-to-reveal';this.iron.active=phase==='ironing';
    const stage=placing?0:phase==='collected'?2:1;
    this.stepDots.forEach((g,i)=>this.box(g,19,19,i===stage?theme.accent:i<stage?'#d46c7d':'#e2c6bc',undefined,10));
    this.steps.forEach((l,i)=>l.color=color(i===stage?theme.accent:theme.muted));
    this.level.palette.forEach((c,i)=>{
      const left=this.session.remaining(c.id),selected=c.id===this.session.selectedColor;
      this.drawBeadBox(this.paletteFrames[i],this.paletteGlass[i],selected,c.hex);
      this.setDrawerOpen(i,selected&&this.openDrawerColor===c.id&&placing);
      const total=this.level.cells.filter(id=>id===c.id).length;
      const visible=left?Math.max(3,Math.ceil(left/total*this.paletteStock[i].length)):0;
      this.paletteStock[i].forEach((bead,j)=>bead.active=j<visible);
      this.paletteCounts[i].string=left?`${c.code} · ${left}`:'✓ 完成';
      this.paletteCounts[i].color=color(theme.text);this.paletteCounts[i].isBold=selected;
    });
    this.guide.string=phase==='placing'?(this.record.tutorialStep<2?'选一种颜色，点按或滑动放豆':'双指缩放看细节，找一找定位剩余孔位'):phase==='ready-to-iron'?'全部拼好了，开始熨烫吧':phase==='ironing'?'拖动熨斗，覆盖整件作品':phase==='ready-to-reveal'?'点击下方按钮或棋盘，揭开烘焙纸':'';
    this.refreshViewportHint();
    const n=phase==='ironing'?this.session.heated.size:this.session.filled.size,p=Math.floor(n/this.session.total*100);this.progress.string=p+'%';
    this.counter.string=phase==='ironing'?'熨烫覆盖进度':phase==='collected'?'作品已收藏':`已放 ${this.session.filled.size} / ${this.session.total} 颗`;
    this.progressGraphic.clear();this.progressGraphic.fillColor=color('#eedacf');this.progressGraphic.roundRect(-112,-3,224,6,3);this.progressGraphic.fill();if(p){this.progressGraphic.fillColor=color('#df6d7d');this.progressGraphic.roundRect(-112,-3,Math.max(6,224*p/100),6,3);this.progressGraphic.fill();}
    this.lastActionEnabled=['ready-to-iron','ready-to-reveal','collected'].includes(phase)&&!this.collectedBusy;
    this.actionText.string=phase==='placing'?'拼完后熨烫':phase==='ready-to-iron'?'开始熨烫':phase==='ironing'?'熨烫中…':phase==='ready-to-reveal'?'揭开烘焙纸':'查看作品';
    this.box(this.actionGraphic,112,46,this.lastActionEnabled?theme.accent:theme.disabled,this.lastActionEnabled?'#bd3d55':'#dfb8a7',14);this.actionText.color=color(this.lastActionEnabled?'#ffffff':'#8a6559');
  }
  private refreshViewportHint():void {
    this.boardSizeText.string=`${this.level.width}×${this.level.height}`;
    if(this.session.phase==='placing'&&this.session.selectedColor===null){this.guide.string='打开一个豆盒，选择颜色开始拼';return;}
    if(this.session.phase==='placing'&&this.session.remaining()===0){this.guide.string='这个颜色已完成，换一种颜色继续拼';return;}
    if(this.session.phase==='placing')this.guide.string=this.board.zoom>1?(sys.isMobile?'滑动连续放豆，双指移动和缩放':'拖动连续放豆 · 右键或空格拖动移图'):this.record.tutorialStep<2?'选一种颜色，点按或滑动放豆':'滑动连续放豆，双指缩放看细节';
  }
  private clearHint(resetCursor=false):void {this.hintTarget=null;if(resetCursor){this.lastHintTarget=null;this.board?.stopFocus();}}
  private findRemaining():void {
    if(this.activeModal||this.blocked)return;
    if(this.session.phase!=='placing'){this.toast('当前已完成拼豆');return;}
    const target=this.session.nextHint(this.lastHintTarget);
    if(!target){this.toast('所有豆子都拼好了，准备熨烫吧');return;}
    this.clearInput();this.clearHint();
    if(this.session.selectedColor!==target.colorId){this.session.selectedColor=target.colorId;this.dirty=true;this.flush();}
    this.openDrawerColor=target.colorId;
    this.hintTarget=target.index;this.lastHintTarget=target.index;this.board.focusCell(target.index);this.refresh();
    this.toast('找到'+this.level.palette.find(c=>c.id===target.colorId)!.name+'，点闪动标记处放豆');
  }
  private next():void {
    if(this.activeModal||this.blocked||!this.lastActionEnabled)return;
    if(this.session.phase==='ready-to-iron'){this.session.startIron();this.board.resetViewport();this.boardSizeText.string=`${this.level.width}×${this.level.height}`;this.dirty=true;this.flush();this.refresh();this.toast('拖动熨斗，让豆子慢慢融合');}
    else if(this.session.phase==='ready-to-reveal')this.collect();else if(this.session.phase==='collected')this.showCollection();
  }
  private collect():void {
    if(this.collectedBusy)return;this.collectedBusy=true;this.refresh();
    const candidate=collectionCandidate(this.record,this.session);candidate.tutorialStep=3;
    if(this.repo.save(candidate)){this.record=candidate;this.session.phase='collected';this.dirty=false;this.saveFailed=false;this.refresh();this.shade.node.active=true;tween(this.shade.node).by(.4,{position:new Vec3(390,35,0),angle:-12}).call(()=>{this.shade.node.active=false;this.position(this.shade.node,195,this.boardCenterY);this.shade.node.angle=0;}).start();this.toast('揭开烘焙纸，'+this.level.title+'完成了！');this.scheduleOnce(()=>this.showCollection(),.65);}
    else{this.saveFailed=true;this.toast('领取未保存，请重试');}
    this.collectedBusy=false;this.refresh();if(this.session.phase==='collected')this.shade.node.active=true;
  }
  private showSettings():void {this.modal('慢慢拼，不着急',this.saveFailed?'本次进度未保存成功，可点击重试。':'进度自动保存在本机，回来可以接着拼。',[
    {title:this.record.sound?'音效：开 · 点击关闭':'音效：关 · 点击开启',run:()=>{this.record.sound=!this.record.sound;this.dirty=true;this.flush();this.closeModal();this.showSettings();}},
    ...(this.saveFailed?[{title:'重试保存进度',run:()=>{this.flush();this.closeModal();this.showSettings();}}]:[]),
    {title:'重新制作这件作品',run:()=>this.confirmRestart()},
    {title:'继续制作',run:()=>this.closeModal(),primary:true},
  ]);}
  private confirmRestart():void {this.modal('重新制作'+this.level.title+'？','当前制作进度会清空，已收藏的成品会保留。',[{title:'从第一颗重新开始',run:()=>{const next=newRecord(this.level);next.completed=[...this.record.completed];next.collected=[...this.record.collected];next.sound=this.record.sound;next.tutorialStep=this.record.tutorialStep;if(!this.repo.save(next)){this.toast('保存失败，原进度已保留');return;}this.record=next;this.session=new PlaySession(this.level);this.openDrawerColor=this.session.selectedColor;this.clearHint(true);this.dirty=false;this.saveFailed=false;this.closeModal();this.board.resetViewport();this.clearInput();this.refresh();},primary:true},{title:'继续当前作品',run:()=>this.closeModal()}]);}
  private showExit():void {this.modal('返回关卡列表？','当前进度会保存在本机。',[{title:'返回关卡列表',run:()=>{this.flush();if(this.saveFailed){this.toast('保存失败，请重试后再返回');return;}this.showHome();},primary:true},{title:'继续当前作品',run:()=>this.closeModal()}]);}
  private showHome():void {this.showLevels();}
  private enterGame():void {this.screen='game';this.closeModal();this.hud.active=true;this.refresh();}
  private showNavigationPage(screen:'levels'|'collection',title:string,subtitle:string,back:()=>void=()=>this.showHome()):{top:number;compact:boolean} {
    this.clearInput();this.board?.stopFocus();this.tweezers?.hide();this.closeModal();this.screen=screen;this.activeModal=true;this.hud.active=false;
    const H=this.worldHeight,top=this.storage.safeInsets(390).top,compact=H<700;
    this.panel(this.overlay,195,H/2,390,H,theme.background,undefined,0).node.addComponent(BlockInputEvents);
    if(screen!=='levels')this.button(this.overlay,'‹',37,top+28,38,38,back);
    this.label(this.overlay,title,195,top+29,19,theme.text,260,true);
    this.label(this.overlay,subtitle,195,top+(compact?55:75),11,theme.muted,340);
    return {top,compact};
  }
  private activateLevel(index:number):void {
    if(!levelUnlocked(this.levels,index,this.storage)){this.toast('先完成上一关再解锁');return;}
    this.flush();if(this.saveFailed){this.toast('保存失败，请重试');return;}
    const next=this.levels[index],repo=new SaveRepository(this.storage,next,levelStoragePrefix(next)),loaded=repo.load();
    if(loaded.kind==='invalid'||loaded.kind==='storage-error'){this.toast('该关存档暂时无法读取，原记录已保留');return;}
    try{this.storage.set('bead-studio-recent-level',next.id);}catch{this.toast('无法保存最近关卡，请重试');return;}
    this.level=next;this.repo=repo;this.record='record' in loaded?loaded.record:newRecord(next);this.session=PlaySession.restore(next,this.record.session);this.openDrawerColor=this.session.selectedColor;
    this.screen='game';this.hud.active=true;this.build();this.ready=true;this.refresh();
    if(loaded.kind==='backup')this.toast('已从备用记录恢复进度');
  }
  /** Content uses a top-left style coordinate system, while Cocos keeps the view centered. */
  private scrollContent(top:number,contentHeight:number):Node {
    const height=Math.max(80,this.worldHeight-top-this.bottom-12);
    const viewport=this.container('ScrollViewport',this.overlay);this.position(viewport,195,top+height/2);
    viewport.addComponent(UITransform).setContentSize(390,height);viewport.addComponent(Mask).type=Mask.Type.GRAPHICS_RECT;
    const content=this.container('ScrollContent',viewport),transform=content.addComponent(UITransform);
    transform.setAnchorPoint(.5,1);transform.setContentSize(390,Math.max(height,contentHeight));content.setPosition(0,height/2);
    const scroll=viewport.addComponent(ScrollView);scroll.content=content;scroll.horizontal=false;scroll.vertical=true;scroll.cancelInnerEvents=true;
    return content;
  }
  private showLevels():void {
    const {top,compact}=this.showNavigationPage('levels','甜品时光','选择作品 · 按顺序解锁');
    this.button(this.overlay,'作品集',337,top+28,74,36,()=>this.showShelf());
    this.button(this.overlay,this.record.sound?'音效开':'音效关',53,top+28,74,36,()=>{this.record.sound=!this.record.sound;this.dirty=true;this.flush();this.showLevels();if(this.saveFailed)this.toast('保存失败，请重试');});
    const height=compact?125:170,step=height+14,rows=Math.ceil(this.levels.length/2),viewTop=top+(compact?70:96);
    const content=this.scrollContent(viewTop,rows*step+12),origin=this.worldHeight/2;
    this.levels.forEach((level,index)=>{
      const x=109+(index%2)*172,y=origin+height/2+Math.floor(index/2)*step;
      const unlocked=levelUnlocked(this.levels,index,this.storage),loaded=loadLevel(this.storage,level),record='record' in loaded?loaded.record:null;
      const status=!unlocked?'完成上一关解锁':record?.completed.includes(level.id)?'已完成':record?.session.filled.length?`进行中 ${record.session.filled.length}/${level.cells.filter(Boolean).length}`:'可以开始';
      const card=this.panel(content,x,y,166,height,theme.board,theme.boardEdge,18).node;
      card.on(Node.EventType.TOUCH_START,()=>{});
      card.on(Node.EventType.TOUCH_END,(event:EventTouch)=>{event.propagationStopped=true;this.activateLevel(index);});
      const art=this.container('LevelPreview',content);this.position(art,x,y-(compact?22:24));
      FusedArtwork.create(art,level,compact?3.3:Math.min(5,140/level.width,110/level.height),this.finishedFrames[index]).showCells(null);
      this.label(content,`${String(index+1).padStart(2,'0')}  ${level.title}`,x,y+(compact?28:48),12,theme.text,154,true);
      this.label(content,status,x,y+(compact?47:68),10,theme.muted,154);
    });
  }
  private showShelf():void {
    const {top,compact}=this.showNavigationPage('collection','我的作品集','甜品与饮食 · 收藏的作品');
    const saved=this.levels.map((level,index)=>({level,index,loaded:loadLevel(this.storage,level)})).filter(item=>'record' in item.loaded&&item.loaded.record.collected.includes(item.level.id));
    if(!saved.length){
      const y=top+(compact?105:230);
      this.panel(this.overlay,195,y,350,compact?70:200,theme.board,theme.boardEdge,20);
      this.label(this.overlay,'还没有收藏的作品',195,y-(compact?8:15),16,theme.text,300,true);
      this.label(this.overlay,'完成拼豆、熨烫和揭纸后，作品会出现在这里',195,y+(compact?13:18),11,theme.muted,320);
      return;
    }
    const height=compact?125:170,step=height+14,rows=Math.ceil(saved.length/2),viewTop=top+(compact?70:96);
    const content=this.scrollContent(viewTop,rows*step+12),origin=this.worldHeight/2;
    saved.forEach(({level,index},position)=>{
      const x=109+(position%2)*172,y=origin+height/2+Math.floor(position/2)*step;
      const card=this.panel(content,x,y,166,height,theme.board,theme.boardEdge,18).node;
      card.on(Node.EventType.TOUCH_START,()=>{});
      card.on(Node.EventType.TOUCH_END,(event:EventTouch)=>{event.propagationStopped=true;this.showShelfDetail(index);});
      const art=this.container('ShelfArtwork',content);this.position(art,x,y-(compact?15:15));
      FusedArtwork.create(art,level,compact?3.3:Math.min(5,140/level.width,120/level.height),this.finishedFrames[index]).showCells(null);
      this.label(content,level.title,x,y+(compact?45:62),12,theme.text,154,true);
    });
  }
  private showShelfDetail(index:number):void {
    const level=this.levels[index];const {top,compact}=this.showNavigationPage('collection',level.title,'已收藏 · 甜品与饮食',()=>this.showShelf());
    const y=top+(compact?100:230);this.panel(this.overlay,195,y,350,compact?65:245,theme.board,theme.boardEdge,20);
    if(!compact){const art=this.container('ShelfDetailArtwork',this.overlay);this.position(art,195,y);FusedArtwork.create(art,level,Math.min(11,350/level.width,(index===0?195:280)/level.height),this.finishedFrames[index]).showCells(null);}
    else this.label(this.overlay,level.title+' · 已收藏',195,y,14,theme.text,320,true);
    const by=top+(compact?156:380);
    this.button(this.overlay,'再做一次',195,by,338,44,()=>{this.activateLevel(index);if(this.screen==='game')this.confirmRestart();},true);
    this.button(this.overlay,'返回作品集',195,by+55,338,40,()=>this.showShelf());
  }
  private showCollection():void {
    if(!this.record.collected.includes(this.level.id)){this.modal('我的作品集','第一件作品正在慢慢成形。\n完成拼豆和熨烫后，把草莓蛋糕摆上展架。',[{title:'继续制作',run:()=>this.closeModal(),primary:true}]);return;}
    this.modal(this.level.title,'✓ 已收藏 · 甜品时光第 '+String(this.level.order).padStart(2,'0')+' 件',[{title:'再做一次',run:()=>this.confirmRestart()},{title:'返回关卡列表',run:()=>this.showLevels()},{title:'回到作品',run:()=>this.closeModal(),primary:true}],true);
  }
  private modal(title:string,message:string,actions:Action[],artwork=false):void {
    this.closeModal();this.clearInput();this.flush();this.activeModal=true;this.tweezers?.hide();const H=this.worldHeight;
    const height=Math.min(H-30,artwork?465:210+actions.length*53),top=H-height;
    const blocker=this.panel(this.overlay,195,H/2,390,H,'#59413e66',undefined,0).node;blocker.addComponent(BlockInputEvents);
    let backdropStart:Point|null=null;
    blocker.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{backdropStart=this.uiPoint(e);});
    blocker.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{const p=this.uiPoint(e);if(backdropStart&&Math.hypot(p.x-backdropStart.x,p.y-backdropStart.y)>10)backdropStart=null;});
    blocker.on(Node.EventType.TOUCH_CANCEL,()=>{backdropStart=null;});
    blocker.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{e.propagationStopped=true;const p=this.uiPoint(e),tap=backdropStart;backdropStart=null;if(tap&&p.y>H/2-top&&!this.blocked)this.closeModal();});
    // The sheet catches its own blank areas so only the outside backdrop dismisses it.
    const sheet=this.panel(this.overlay,195,top+height/2,390,height,theme.surface,undefined,25).node;sheet.addComponent(BlockInputEvents);
    this.label(this.overlay,title,195,top+37,22,theme.text,330,true);this.label(this.overlay,message,195,top+83,12,theme.muted,335);
    if(artwork){const art=this.container('Artwork',this.overlay);this.position(art,195,top+185);const u=Math.min(11,360/this.level.width,(this.level.order===1?165:290)/this.level.height);FusedArtwork.create(art,this.level,u,this.finishedFrames[this.level.order-1]).showCells(null);}
    const actionStart=H-this.bottom-25-(actions.length-.5)*53;
    actions.forEach((a,i)=>this.button(this.overlay,a.title,195,actionStart+i*53,338,44,a.run,a.primary));
  }
  private closeModal():void {if(this.overlay)this.overlay.destroyAllChildren();this.activeModal=false;this.clearInput();}
  private recovery(kind:string):void {this.modal('进度暂时无法恢复',kind==='invalid'?'本机记录损坏或图纸版本不一致，原始记录仍保留。':'本机存储暂不可用，请重试。',[
    {title:'重试读取记录',run:()=>{const r=this.repo.load();if('record'in r){this.record=r.record;this.session=PlaySession.restore(this.level,this.record.session);this.openDrawerColor=this.session.selectedColor;this.blocked=false;this.closeModal();this.refresh();}else this.toast('暂未恢复，请稍后重试');}},
    {title:'确认新开一局',run:()=>{this.modal('保留旧记录，新开一局？','会先备份当前记录，备份失败时不清空。',[{title:'备份并重新开始',run:()=>{try{const backup=[this.storage.get(levelStoragePrefix(this.level)+'-0'),this.storage.get(levelStoragePrefix(this.level)+'-1')];this.storage.set(levelStoragePrefix(this.level)+'-recovery',JSON.stringify(backup));const r=newRecord(this.level);if(!this.repo.save(r))throw new Error('save');this.record=r;this.session=new PlaySession(this.level);this.openDrawerColor=this.session.selectedColor;this.blocked=false;this.closeModal();this.refresh();}catch{this.toast('存储失败，旧记录已保留');}},primary:true},{title:'返回',run:()=>this.recovery(kind)}]);}},
  ]);}
  private toast(text:string):void {if(this.toastNode)this.toastNode.destroy();const y=this.stageTop+this.stageHeight-24;const n=this.panel(this.overlay,195,y,Math.min(356,text.length*12+30),38,'#59413eef',undefined,13).node;this.toastNode=n;this.label(n,text,195,this.worldHeight/2,11,'#fffaf1',330);this.scheduleOnce(()=>{if(n.isValid)n.destroy();if(this.toastNode===n)this.toastNode=null;},2.6);}
  private flush():void {if(!this.ready||this.blocked||!this.dirty)return;this.record.session=this.session.serialize();if(this.repo.save(this.record)){this.dirty=false;this.saveFailed=false;}else{if(!this.saveFailed)this.toast('进度保存失败，请在设置中重试');this.saveFailed=true;}this.elapsed=0;}
  private refreshTweezers():void {
    if(!this.tweezers)return;
    const p=this.mousePoint;
    if(!p||!this.ready||this.wasHidden||this.activeModal||this.blocked||this.session.phase!=='placing'||this.panModifier||this.rightPanning){this.tweezers.hide();return;}
    const frame=this.board.frame.getComponent(UITransform)!,local=frame.convertToNodeSpaceAR(new Vec3(p.x,p.y,0));
    if(Math.abs(local.x)>=frame.width/2||Math.abs(local.y)>=frame.height/2){this.tweezers.hide();return;}
    const selected=this.level.palette.find(c=>c.id===this.session.selectedColor);
    if(!selected){this.tweezers.hide();return;}
    this.tweezers.show(p,selected.hex,this.board.beadSize,this.board.zoom,this.session.remaining()>0);
  }
  update(dt:number):void {this.refreshTweezers();if(this.ready&&this.board.focusing)this.refreshViewportHint();if(this.ready&&this.dirty&&!this.wasHidden){this.elapsed+=dt;if(this.elapsed>=.2)this.flush();}}
  private onHide():void {this.wasHidden=true;this.mousePoint=null;this.tweezers?.hide();this.panModifier=false;this.clearInput();this.audio?.stop();this.flush();}
  private onShow():void {this.wasHidden=false;this.clearInput();if(this.ready)this.refresh();}
  private onResize():void {if(this.ready){const screen=this.screen;this.clearInput();this.flush();this.hud.active=true;this.build();this.refresh();if(screen==='home')this.showHome();else if(screen==='levels')this.showLevels();else if(screen==='collection')this.showShelf();}}
  onDestroy():void {this.paletteDrawerStates.forEach(state=>Tween.stopAllByTarget(state));this.tweezers?.destroy();this.tweezers=null;this.board?.stopFocus();this.clearHint();this.flush();game.off(Game.EVENT_HIDE,this.onHide,this);game.off(Game.EVENT_SHOW,this.onShow,this);view.off('canvas-resize',this.onResize,this);input.off(Input.EventType.KEY_DOWN,this.keyDown,this);input.off(Input.EventType.KEY_UP,this.keyUp,this);input.off(Input.EventType.MOUSE_DOWN,this.trackMouse,this);input.off(Input.EventType.MOUSE_MOVE,this.mouseMove,this);input.off(Input.EventType.MOUSE_UP,this.mouseUp,this);}
}
