import {
  _decorator, Component, Node, Canvas, UITransform, Camera, Color, Graphics,
  Label, Layers, view, ResolutionPolicy, resources, JsonAsset, SpriteFrame, Sprite, Mask, ScrollView, Font,
  EventTouch, EventMouse, EventKeyboard, input, Input, KeyCode, sys, game, Game, profiler, AudioSource, AudioClip, BlockInputEvents, Vec2, Vec3, tween, Tween,
} from 'cc';
import { validateLevel, LevelDefinition } from '../core/Level';
import { ImagePixels, PatternOptions, defaultPatternOptions, patternBoardSizes, imageToLevel } from '../core/ImagePattern';
import { patternPrintDocument, BEAD_PITCH_MM } from '../core/PatternPrint';
import { PersonalPatterns, personalStoragePrefix } from '../core/PersonalPatterns';
import { PlaySession } from '../core/Session';
import { PlayerRecord, SaveRepository, newRecord, collectionCandidate } from '../core/SaveRepository';
import { levelStoragePrefix, levelUnlocked, loadLevel, sampleStoragePrefix } from '../core/LevelAccess';
import { summarizeHomeProgress } from '../core/HomeProgress';
import { Point, GestureState, BoardPanGesture, traverseGrid, centeredUiPoint } from '../core/Geometry';
import { PlatformStorage } from '../platform/Platform';
import { canPickPatternImage, pickPatternImage } from '../platform/PatternImagePicker';
import { pixelBox, pixelStar, pixelButton } from './PixelSkin';
import { homeLayout, coverSize } from '../core/PixelVisuals';
import { PatternImage } from './PatternImage';
import { BoardView } from './BoardView';
import { FusedArtwork } from './FusedArtwork';
import { TweezersCursor } from './TweezersCursor';
import { color, theme, craftTheme } from './Theme';
const { ccclass }=_decorator;
const paletteSpacing = 51.5;
const paletteWidth = 360;
interface Action { title:string; run:()=>void; primary?:boolean }
interface ImageDraft {
  id: string;
  title: string;
  image: ImagePixels;
  options: PatternOptions;
  level?: LevelDefinition;
  error?: string;
  adjusting: boolean;
  detail?: 'source' | 'result';
}
@ccclass('BeadGame')
export class BeadGame extends Component {
  private root!:Node;private hud!:Node;private overlay!:Node;private worldHeight=844;
  private levels:LevelDefinition[]=[];private level!:LevelDefinition;private session!:PlaySession;private record!:PlayerRecord;private repo!:SaveRepository;
  private storage=new PlatformStorage();private board!:BoardView;private bead!:SpriteFrame;private melted!:SpriteFrame;private finishedFrames:SpriteFrame[]=[];
  private patterns = new PersonalPatterns(this.storage);
  private draft?: ImageDraft;
  private pickingImage = false;
  private wideLayout = false;
  private worldFrame!:SpriteFrame;private wideWorldFrame!:SpriteFrame;private titleFrame!:SpriteFrame;private qFont!:Font;
  private homeScrollOffset = 0;
  private printPitchMm = BEAD_PITCH_MM;
  private lastFormalIndex = 0;
  private get personalMode(): boolean { return this.level?.themeId === 'personal'; }
  private get currentFinishedFrame(): SpriteFrame | undefined {
    return this.personalMode ? undefined : this.finishedFrames[this.level.order - 1];
  }
  private sampleId:string|null=null;private loading=false;private paletteScroll:ScrollView|null=null;
  private get sampleMode():boolean { return this.sampleId!==null; }
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
  private toastNode:Node|null=null;private screen: 'home'|'levels'|'map'|'collection'|'patterns'|'draft'|'game'='game';
  private tweezers:TweezersCursor|null=null;private mousePoint:Point|null=null;
  start():void {
    profiler.hideStats();
    if (sys.isBrowser && ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) {
      const sample = new URLSearchParams(location.search).get('sample');
      if (sample === 'life-011' || sample === 'life-016') this.sampleId = sample;
    }
    // A wide browser window still needs room for the portrait workbench.
    const wideBrowser = sys.isBrowser && window.innerWidth >= window.innerHeight;
    this.wideLayout = wideBrowser;
    view.setDesignResolutionSize(390,844,wideBrowser?ResolutionPolicy.FIXED_HEIGHT:this.sampleMode?ResolutionPolicy.SHOW_ALL:ResolutionPolicy.FIXED_WIDTH);
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
    void this.loadGame();
    game.on(Game.EVENT_HIDE,this.onHide,this);game.on(Game.EVENT_SHOW,this.onShow,this);view.on('canvas-resize',this.onResize,this);
    input.on(Input.EventType.KEY_DOWN,this.keyDown,this);input.on(Input.EventType.KEY_UP,this.keyUp,this);
    input.on(Input.EventType.MOUSE_MOVE,this.mouseMove,this);input.on(Input.EventType.MOUSE_UP,this.mouseUp,this);
    input.on(Input.EventType.MOUSE_DOWN,this.trackMouse,this);
  }
  private async loadGame(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    const levelPaths = this.sampleId ? ['samples/' + this.sampleId] :
      ['dessert-001','dessert-002','dessert-003','dessert-004','dessert-005','dessert-006'].map(id => 'levels/' + id);
    try {
      const [assets, bead, melted, finished, world, wideWorld, title, qFont] = await Promise.all([
        Promise.all(levelPaths.map(path => this.load<JsonAsset>(path, JsonAsset))),
        this.load<SpriteFrame>('art/bead/spriteFrame',SpriteFrame),
        this.load<SpriteFrame>('art/melted/spriteFrame', SpriteFrame),
        Promise.all(['finished-cake','finished-soda','finished-pudding','finished-pancake','finished-sandwich','finished-cat-cup'].map(name=>this.load<SpriteFrame>('art/'+name+'/spriteFrame',SpriteFrame))),
        this.load<SpriteFrame>('art/pixel-world/spriteFrame',SpriteFrame),
        this.load<SpriteFrame>('art/pixel-world-wide/spriteFrame',SpriteFrame),
        this.load<SpriteFrame>('art/pixel-title/spriteFrame',SpriteFrame),
        this.load<Font>('fonts/ZCOOLKuaiLe-Regular',Font),
      ]);
      if (!this.isValid) return;
      this.levels = assets.map(asset => validateLevel(asset.json));
      this.level = this.levels[0];
      if (!this.sampleMode) {
        try {
          const recent = this.storage.get('bead-studio-recent-level');
          const index = this.levels.findIndex(level => level.id === recent);
          if (index > 0 && levelUnlocked(this.levels, index, this.storage)) this.level = this.levels[index];
        } catch { /* An unreadable preference does not prevent choosing a level. */ }
      }
      this.bead=bead;this.worldFrame=world;this.wideWorldFrame=wideWorld;this.titleFrame=title;this.qFont=qFont;
      this.melted = melted;
      this.finishedFrames = finished;
      this.lastFormalIndex = Math.max(0, this.levels.indexOf(this.level));
      this.repo = new SaveRepository(this.storage, this.level, this.storagePrefix());
      const loaded = this.repo.load();
      this.record = 'record' in loaded ? loaded.record : newRecord(this.level);
      this.session = PlaySession.restore(this.level, this.record.session);
      this.openDrawerColor = this.session.selectedColor;
      this.build();
      this.ready = true;
      this.refresh();
      if (loaded.kind === 'invalid' || loaded.kind === 'storage-error') {
        this.blocked = true;
        this.recovery(loaded.kind);
        return;
      }
      if (loaded.kind === 'empty') {
        this.dirty = true;
        this.flush();
      }
      if (!this.sampleMode) this.showLevels();
      if (loaded.kind === 'backup') this.toast('已从备用记录恢复进度');
    } catch (error) {
      if (!this.isValid) return;
      console.error('Game initialization failed', error);
      this.ready = false;
      this.hud.destroyAllChildren();
      this.label(this.hud,'作品暂时没打开',195,this.worldHeight/2-25,22,theme.text,330);
      this.button(this.hud,'重试',195,this.worldHeight/2+28,130,44,()=>void this.loadGame(),true);
    } finally {
      this.loading = false;
      // Reveal the canvas on both success and recoverable errors (the canvas owns retry).
      if (sys.isBrowser) window.dispatchEvent(new Event('bead-game-ready'));
    }
  }
  private storagePrefix(): string {
    if (this.personalMode) return personalStoragePrefix(this.level);
    return this.sampleMode ? sampleStoragePrefix(this.level) : levelStoragePrefix(this.level);
  }
  private load<T>(path:string,type:typeof JsonAsset|typeof SpriteFrame|typeof Font):Promise<T>{return new Promise((resolve,reject)=>{resources.load(path,type as typeof JsonAsset,(err,asset)=>{if(err)reject(err);else resolve(asset as unknown as T);});});}
  private container(name:string,parent:Node):Node {const n=new Node(name);parent.addChild(n);n.layer=Layers.Enum.UI_2D;return n;}
  private position(n:Node,x:number,y:number):void {n.setPosition(x-195,this.worldHeight/2-y,0);}
  private panel(parent:Node,x:number,y:number,w:number,h:number,fill:string,stroke?:string,r=16):Graphics {
    const n=this.container('Surface',parent);this.position(n,x,y);n.addComponent(UITransform).setContentSize(w,h);const g=n.addComponent(Graphics);this.box(g,w,h,fill,stroke,r);return g;
  }
  private box(g:Graphics,w:number,h:number,fill:string,stroke?:string,r=14):void {
    if(this.screen!=='game'){pixelBox(g,w,h,fill,stroke??theme.line);return;}
    g.clear();g.fillColor=color(fill);g.roundRect(-w/2,-h/2,w,h,Math.min(r,w/2,h/2));g.fill();if(stroke){g.strokeColor=color(stroke);g.lineWidth=1;g.stroke();}
  }
  private label(parent:Node,text:string,x:number,y:number,size=13,fill=theme.text,width=350,bold=false):Label {
    const n=this.container('Text',parent);this.position(n,x,y);n.addComponent(UITransform).setContentSize(width,size*2.5);const l=n.addComponent(Label);l.string=text;l.fontFamily='Arial Rounded MT Bold';l.useSystemFont=true;if(this.qFont){l.font=this.qFont;l.useSystemFont=false;}l.fontSize=size;l.lineHeight=size*1.5;l.color=color(this.screen==='game'?(fill===theme.text?craftTheme.text:fill===theme.muted?craftTheme.muted:fill):fill);l.isBold=this.qFont?false:bold;l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;l.overflow=Label.Overflow.SHRINK;l.enableWrapText=true;n.getComponent(UITransform)!.setContentSize(width,size*2.5);return l;
  }
  private button(parent:Node,text:string,x:number,y:number,w:number,h:number,run:()=>void,primary=false):{node:Node;label:Label;graphic:Graphics} {
    const n=this.container('Button',parent);this.position(n,x,y);n.addComponent(UITransform).setContentSize(w,h);
    const g=n.addComponent(Graphics),craft=this.screen==='game';
    if(craft)this.box(g,w,h,primary?craftTheme.accent:craftTheme.pale,primary?'#c94765':'#e5b7c0',13);else pixelButton(g,w,h,primary);
    const label=this.label(n,text,195,this.worldHeight/2,craft?14:18,primary?'#fff7d9':craft?craftTheme.text:theme.text,w-14,true);
    if(primary&&!craft){label.enableOutline=true;label.outlineColor=color('#a6333f');label.outlineWidth=1.5;}
    n.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{e.propagationStopped=true;run();});return{node:n,label,graphic:g};
  }
  private worldBackground(parent:Node):void {
    if(!this.worldFrame)return;
    const visible=view.getVisibleSize(),frame=visible.width>visible.height?this.wideWorldFrame:this.worldFrame;
    const n=this.container('PixelWorldBackground',parent);this.position(n,195,this.worldHeight/2);
    const rect=frame.rect,size=coverSize(rect.width,rect.height,visible.width,visible.height);
    const sprite=n.addComponent(Sprite);sprite.spriteFrame=frame;sprite.sizeMode=Sprite.SizeMode.CUSTOM;n.getComponent(UITransform)!.setContentSize(size.width,size.height);
  }
  private pixelHeading(parent:Node,text:string,x:number,y:number,size=20,width=300):Label {
    const l=this.label(parent,text,x,y,size,'#fff5cb',width,true);l.enableOutline=true;l.outlineColor=color('#163479');l.outlineWidth=Math.max(2,size*.12);return l;
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
    this.panel(this.hud,195,H/2,Math.max(390,view.getVisibleSize().width),H,craftTheme.background,undefined,0);
    this.button(this.hud,'‹',37,top+29,38,38,()=>this.showExit());
    const prefix = this.personalMode ? '' : this.sampleMode ? '试玩 · ' : String(this.level.order).padStart(2, '0') + '关 ';
    this.label(this.hud,prefix+this.level.title,195,top+29,18,craftTheme.text,252,true);
    this.button(this.hud,'···',350,top+29,44,34,()=>this.showSettings());
    ['拼豆','熨烫','收藏'].forEach((text,i)=>{
      const x=110+i*84;const dot=this.panel(this.hud,x-19,top+70,19,19,craftTheme.pale,undefined,10);this.stepDots.push(dot);
      this.label(this.hud,String(i+1),x-19,top+70,10,'#ffffff',18,true);
      this.steps.push(this.label(this.hud,text,x+7,top+70,11,craftTheme.muted,48,true));
    });
    const boardTop=this.stageTop+44,boardHeight=this.stageHeight-52,centerY=boardTop+boardHeight/2;this.boardCenterY=centerY;
    const workHeight=H-this.bottom-68-this.stageTop,workCenter=this.stageTop+workHeight/2;
    this.panel(this.hud,195,workCenter+3,370,workHeight,craftTheme.shadow,undefined,21);
    this.panel(this.hud,195,workCenter,370,workHeight,craftTheme.board,craftTheme.boardEdge,21);
    this.board=new BoardView(this.hud,this.level,this.bead,this.melted,this.currentFinishedFrame);
    this.board.layout(0,H/2-centerY,358,boardHeight);
    this.boardSizeText=this.label(this.hud,`${this.level.width}×${this.level.height}`,338,this.stageTop+this.stageHeight-15,10,craftTheme.muted,52,true);
    this.shade=this.panel(this.hud,195,centerY,350,boardHeight-6,'#fff6e379',undefined,8);this.shade.node.active=false;
    this.iron=this.container('Iron',this.hud);this.position(this.iron,195,centerY);const ironG=this.iron.addComponent(Graphics);this.box(ironG,54,72,'#fff8ee','#c38b79',22);ironG.strokeColor=color(craftTheme.accent);ironG.lineWidth=7;ironG.roundRect(-10,-15,20,37,8);ironG.stroke();this.iron.active=false;
    const find=this.button(this.hud,'',345,this.stageTop+22,40,36,()=>this.findRemaining());
    find.node.name='FindRemainingButton';find.label.node.destroy();find.node.getComponent(UITransform)!.setContentSize(44,44);
    const lens=this.container('MagnifierIcon',find.node).addComponent(Graphics);
    lens.lineWidth=2.6;lens.strokeColor=color(craftTheme.text);lens.fillColor=color('#fff8f2');
    lens.circle(-2,2,7);lens.fill();lens.stroke();
    lens.lineWidth=3;lens.moveTo(3,-3);lens.lineTo(9,-9);lens.stroke();
    lens.fillColor=color(craftTheme.text);lens.circle(9,-9,1.5);lens.fill();
    const paletteTop=H-this.bottom-207;
    const paletteParent = this.createPaletteViewport(paletteTop + 64);
    this.level.palette.forEach((c,i)=>{
      const n=this.container('Color-'+c.code,paletteParent);
      if (this.paletteScroll) n.setPosition(25 + i * paletteSpacing, 0);
      else this.position(n,40 + i * paletteSpacing,paletteTop+64);
      n.addComponent(UITransform).setContentSize(48,90);
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
      this.paletteCounts.push(this.label(n,'',195,H/2+40,9.5,craftTheme.text,48));this.palette.push(n);
      n.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{e.propagationStopped=true;if(this.activeModal||this.blocked||!['placing','ready-to-iron'].includes(this.session.phase))return;this.openDrawerColor=this.openDrawerColor===c.id?null:c.id;this.session.selectedColor=this.openDrawerColor;this.clearHint(true);this.dirty=true;this.refresh();if(this.record.tutorialStep===0)this.record.tutorialStep=1;});
    });
    if (this.paletteScroll) {
      this.label(this.hud,`‹ 横滑色板 · ${this.level.palette.length} 色 ›`,195,paletteTop+12,10,craftTheme.muted,160,true);
      this.revealPaletteColor();
    }
    this.guide=this.label(this.hud,'',195,paletteTop+123,10,craftTheme.muted,350);
    this.progress=this.label(this.hud,'0%',46,H-this.bottom-43,21,'#c05665',75,true);
    this.counter=this.label(this.hud,'',150,H-this.bottom-42,10,craftTheme.muted,140);
    this.progressGraphic=this.panel(this.hud,134,H-this.bottom-23,224,6,'#eedacf',undefined,3);
    const action=this.button(this.hud,'',315,H-this.bottom-36,112,46,()=>this.next(),true);this.actionNode=action.node;this.actionText=action.label;this.actionGraphic=action.graphic;
    this.bindBoard();
    if(sys.isBrowser&&!sys.isMobile){
      this.tweezers=new TweezersCursor(this.root,this.bead,point=>{
        this.mousePoint=centeredUiPoint(point,view.getVisibleSize().width,this.worldHeight);
      },()=>this.clearMousePoint());
    }
  }
  private createPaletteViewport(centerY: number): Node {
    this.paletteScroll = null;
    if (this.level.palette.length <= 7) return this.hud;
    const viewport = this.container('PaletteViewport', this.hud);
    this.position(viewport, 195, centerY);
    viewport.addComponent(UITransform).setContentSize(paletteWidth, 90);
    viewport.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
    const content = this.container('PaletteColors', viewport);
    const transform = content.addComponent(UITransform);
    transform.setAnchorPoint(0, .5);
    transform.setContentSize((this.level.palette.length - 1) * paletteSpacing + 50, 90);
    content.setPosition(-paletteWidth / 2, 0);

    const scroll = viewport.addComponent(ScrollView);
    scroll.horizontal = true;
    scroll.vertical = false;
    scroll.cancelInnerEvents = true;
    scroll.content = content;
    this.paletteScroll = scroll;
    return content;
  }
  private revealPaletteColor(): void {
    const scroll = this.paletteScroll;
    if (!scroll) return;
    const index = this.level.palette.findIndex(color => color.id === this.session.selectedColor);
    if (index < 0) return;
    const center = 25 + index * paletteSpacing;
    const current = -scroll.getScrollOffset().x;
    if (center - 24 >= current && center + 24 <= current + paletteWidth) return;
    const target = Math.max(0, Math.min(center - paletteWidth / 2, scroll.getMaxScrollOffset().x));
    scroll.stopAutoScroll();
    scroll.scrollToOffset(new Vec2(target, 0));
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
    this.mousePoint=centeredUiPoint(e.getUILocation(),view.getVisibleSize().width,this.worldHeight);
    if(e.getButton()===EventMouse.BUTTON_RIGHT||e.getButton()===EventMouse.BUTTON_MIDDLE){
      // Creator dispatches a simulated touch before the mouse event, including for right click.
      // Clear that pending touch before it can place anything.
      this.clearInput();
      if(this.activeModal||this.blocked||this.session.phase!=='placing')return;
      this.rightPanning=true;this.panDrag.start(centeredUiPoint(e.getUILocation(),view.getVisibleSize().width,this.worldHeight),this.board.offset);
    }else {this.refreshTweezers();this.commitStart();}
  }
  private trackMouse(e:EventMouse):void {this.mousePoint=centeredUiPoint(e.getUILocation(),view.getVisibleSize().width,this.worldHeight);this.refreshTweezers();}
  private clearMousePoint():void {this.mousePoint=null;this.tweezers?.hide();}
  private mouseMove(e:EventMouse):void {if(!this.rightPanning||this.activeModal||this.blocked)return;const offset=this.panDrag.move(centeredUiPoint(e.getUILocation(),view.getVisibleSize().width,this.worldHeight));if(offset)this.board.setViewport(this.board.zoom,offset);}
  private mouseUp(e:EventMouse):void {this.trackMouse(e);if(this.rightPanning&&(e.getButton()===EventMouse.BUTTON_RIGHT||e.getButton()===EventMouse.BUTTON_MIDDLE))this.clearInput();}
  private commitStart():void {
    const pending=this.pendingStart;this.pendingStart=null;
    if(!pending||this.activeModal||this.blocked||!this.touches.has(pending.id)||this.gesture.mode!=='placing')return;
    if(this.session.phase==='ready-to-reveal'){this.next();return;}
    this.last=this.board.local(pending.point);this.apply(this.last,this.last,pending.point);
  }
  private uiPoint(e:EventTouch):Point {const p=e.getUILocation();return centeredUiPoint(p,view.getVisibleSize().width,this.worldHeight);}
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
    this.stepDots.forEach((g,i)=>this.box(g,19,19,i===stage?craftTheme.accent:i<stage?'#d46c7d':'#e2c6bc',undefined,10));
    this.steps.forEach((l,i)=>l.color=color(i===stage?craftTheme.accent:craftTheme.muted));
    this.level.palette.forEach((c,i)=>{
      const left=this.session.remaining(c.id),selected=c.id===this.session.selectedColor;
      this.drawBeadBox(this.paletteFrames[i],this.paletteGlass[i],selected,c.hex);
      this.setDrawerOpen(i,selected&&this.openDrawerColor===c.id&&placing);
      const total=this.level.cells.filter(id=>id===c.id).length;
      const visible=left?Math.max(3,Math.ceil(left/total*this.paletteStock[i].length)):0;
      this.paletteStock[i].forEach((bead,j)=>bead.active=j<visible);
      this.paletteCounts[i].string=left?`${c.code} · ${left}`:'✓ 完成';
      this.paletteCounts[i].color=color(craftTheme.text);this.paletteCounts[i].isBold=selected;
    });
    this.guide.string=phase==='placing'?(this.record.tutorialStep<2?'选一种颜色，点按或滑动放豆':'双指缩放看细节，找一找定位剩余孔位'):phase==='ready-to-iron'?'全部拼好了，开始熨烫吧':phase==='ironing'?'拖动熨斗，覆盖整件作品':phase==='ready-to-reveal'?'点击下方按钮或棋盘，揭开烘焙纸':'';
    this.refreshViewportHint();
    const n=phase==='ironing'?this.session.heated.size:this.session.filled.size,p=Math.floor(n/this.session.total*100);this.progress.string=p+'%';
    this.counter.string=phase==='ironing'?'熨烫覆盖进度':phase==='collected'?'作品已收藏':`已放 ${this.session.filled.size} / ${this.session.total} 颗`;
    this.progressGraphic.clear();this.progressGraphic.fillColor=color('#eedacf');this.progressGraphic.roundRect(-112,-3,224,6,3);this.progressGraphic.fill();if(p){this.progressGraphic.fillColor=color('#df6d7d');this.progressGraphic.roundRect(-112,-3,Math.max(6,224*p/100),6,3);this.progressGraphic.fill();}
    this.lastActionEnabled=['ready-to-iron','ready-to-reveal','collected'].includes(phase)&&!this.collectedBusy;
    this.actionText.string=phase==='placing'?'拼完后熨烫':phase==='ready-to-iron'?'开始熨烫':phase==='ironing'?'熨烫中…':phase==='ready-to-reveal'?'揭开烘焙纸':'查看作品';
    this.box(this.actionGraphic,112,46,this.lastActionEnabled?craftTheme.accent:craftTheme.disabled,this.lastActionEnabled?'#bd3d55':'#dfb8a7',14);this.actionText.color=color(this.lastActionEnabled?'#ffffff':'#8a6559');
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
    this.revealPaletteColor();
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
    if(this.repo.save(candidate)){this.record=candidate;this.session.phase='collected';this.dirty=false;this.saveFailed=false;this.refresh();this.shade.node.active=true;tween(this.shade.node).by(.4,{position:new Vec3(390,35,0),angle:-12}).call(()=>{this.shade.node.active=false;this.position(this.shade.node,195,this.boardCenterY);this.shade.node.angle=0;}).start();this.toast('揭开烘焙纸，'+this.level.title+'完成了！');const collectedId=this.level.id;this.scheduleOnce(()=>{if(this.screen==='game'&&this.level.id===collectedId)this.showCollection();},.65);}
    else{this.saveFailed=true;this.toast('领取未保存，请重试');}
    this.collectedBusy=false;this.refresh();if(this.session.phase==='collected')this.shade.node.active=true;
  }
  private showSettings():void {this.modal('慢慢拼，不着急',this.saveFailed?'本次进度未保存成功，可点击重试。':'进度自动保存在本机，回来可以接着拼。',[
    {title:this.record.sound?'音效：开 · 点击关闭':'音效：关 · 点击开启',run:()=>{this.record.sound=!this.record.sound;this.dirty=true;this.flush();this.closeModal();this.showSettings();}},
    ...(this.saveFailed?[{title:'重试保存进度',run:()=>{this.flush();this.closeModal();this.showSettings();}}]:[]),
    {title:'重新制作这件作品',run:()=>this.confirmRestart()},
    {title:'继续制作',run:()=>this.closeModal(),primary:true},
  ]);}
  private confirmRestart():void {this.modal('重新制作'+this.level.title+'？','当前制作进度会清空，已收藏的成品会保留。',[{title:'从第一颗重新开始',run:()=>{const next=newRecord(this.level);next.completed=[...this.record.completed];next.collected=[...this.record.collected];next.sound=this.record.sound;next.tutorialStep=this.record.tutorialStep;if(!this.repo.save(next)){this.toast('保存失败，原进度已保留');return;}this.record=next;this.session=new PlaySession(this.level);this.openDrawerColor=this.session.selectedColor;this.revealPaletteColor();this.clearHint(true);this.dirty=false;this.saveFailed=false;this.closeModal();this.board.resetViewport();this.clearInput();this.refresh();},primary:true},{title:'继续当前作品',run:()=>this.closeModal()}]);}
  private showExit(): void {
    const destination = this.personalMode ? '返回我的图纸' : this.sampleMode ? '退出样本试玩' : '返回甜品岛';
    this.modal(destination+'？','当前进度会保存在本机。',[
      {title:destination,run:()=>this.leaveGame(),primary:true},
      {title:'继续当前作品',run:()=>this.closeModal()},
    ]);
  }
  private leaveGame(): void {
    this.flush();
    if (this.saveFailed) {
      this.toast('保存失败，请重试后再返回');
      return;
    }
    if (this.personalMode) {
      this.showPatterns();
      return;
    }
    if (this.sampleMode) {
      const url = new URL(location.href);
      url.searchParams.delete('sample');
      location.assign(url);
    } else this.showLevels();
  }
  private showHome():void {this.showLevels();}
  private showNavigationPage(screen:'levels'|'map'|'collection'|'patterns'|'draft',title:string,subtitle:string,back:()=>void=()=>this.showHome()):{top:number;compact:boolean} {
    if(this.screen==='map'){const scroll=this.overlay.getChildByName('ScrollViewport')?.getComponent(ScrollView);if(scroll)this.homeScrollOffset=Math.max(0,Math.min(scroll.getScrollOffset().y,scroll.getMaxScrollOffset().y));}
    this.clearInput();this.board?.stopFocus();this.tweezers?.hide();this.closeModal();this.screen=screen;this.activeModal=true;this.hud.active=false;
    const H=this.worldHeight,top=this.storage.safeInsets(390).top,compact=H<700;
    this.worldBackground(this.overlay);
    this.panel(this.overlay,195,H/2,390,H,'#123e7866',undefined,0).node.addComponent(BlockInputEvents);
    const bottomSpace=screen==='draft'?14:87;const windowHeight=Math.max(80,H-top-84-this.bottom-bottomSpace);
    this.panel(this.overlay,195,top+84+windowHeight/2,374,windowHeight,'#e4f4fffa',theme.line,0);
    if(screen!=='levels')this.button(this.overlay,'‹',37,top+28,38,38,back);
    this.pixelHeading(this.overlay,title,195,top+29,21,260);
    this.pixelHeading(this.overlay,subtitle,195,top+60,11,340);
    return {top,compact};
  }
  private activateLevel(index:number):void {
    if(!levelUnlocked(this.levels,index,this.storage)){this.toast('先完成上一关再解锁');return;}
    this.flush();if(this.saveFailed){this.toast('保存失败，请重试');return;}
    const next=this.levels[index],repo=new SaveRepository(this.storage,next,levelStoragePrefix(next)),loaded=repo.load();
    if(loaded.kind==='invalid'||loaded.kind==='storage-error'){this.toast('该关存档暂时无法读取，原记录已保留');return;}
    try{this.storage.set('bead-studio-recent-level',next.id);}catch{this.toast('无法保存最近关卡，请重试');return;}
    this.lastFormalIndex=index;this.level=next;this.repo=repo;this.record='record' in loaded?loaded.record:newRecord(next);this.session=PlaySession.restore(next,this.record.session);this.openDrawerColor=this.session.selectedColor;
    this.screen='game';this.hud.active=true;this.build();this.ready=true;this.refresh();
    if(loaded.kind==='backup')this.toast('已从备用记录恢复进度');
  }
  /** Content uses a top-left style coordinate system, while Cocos keeps the view centered. */
  private scrollContent(top:number,contentHeight:number,bottomSpace=12):Node {
    const height=Math.max(80,this.worldHeight-top-this.bottom-bottomSpace);
    const viewport=this.container('ScrollViewport',this.overlay);this.position(viewport,195,top+height/2);
    viewport.addComponent(UITransform).setContentSize(390,height);viewport.addComponent(Mask).type=Mask.Type.GRAPHICS_RECT;
    const content=this.container('ScrollContent',viewport),transform=content.addComponent(UITransform);
    transform.setAnchorPoint(.5,1);transform.setContentSize(390,Math.max(height,contentHeight));content.setPosition(0,height/2);
    const scroll=viewport.addComponent(ScrollView);scroll.content=content;scroll.horizontal=false;scroll.vertical=true;scroll.cancelInnerEvents=true;
    return content;
  }
  /** A hollow bead is the common motif across navigation and the map. */
  private beadToken(parent:Node,x:number,y:number,r:number,fill:string):void {
    const node=this.container('PixelBeadToken',parent);this.position(node,x,y);const g=node.addComponent(Graphics);pixelBox(g,r*2,r*2,fill,theme.line);g.fillColor=color('#fff6d7');g.rect(-r*.3,-r*.3,r*.6,r*.6);g.fill();
  }
  private navigation(active:'levels'|'patterns'|'collection'):void {
    const y=this.worldHeight-this.bottom-38;
    this.panel(this.overlay,195,y+8,390,88,theme.surface,theme.line,22).node.addComponent(BlockInputEvents);
    const items: {key:'levels'|'patterns'|'collection';title:string;run:()=>void}[]=[
      {key:'levels',title:'关卡地图',run:()=>this.showMap()},
      {key:'patterns',title:'自制图纸',run:()=>this.showPatterns()},
      {key:'collection',title:'作品集',run:()=>this.showShelf()},
    ];
    items.forEach((item,i)=>this.button(this.overlay,item.title,66+i*129,y,116,44,item.run,item.key===active));
  }
  private showLevels():void {
    if(this.screen==='map'){const scroll=this.overlay.getChildByName('ScrollViewport')?.getComponent(ScrollView);if(scroll)this.homeScrollOffset=Math.max(0,Math.min(scroll.getScrollOffset().y,scroll.getMaxScrollOffset().y));}
    this.clearInput();this.board?.stopFocus();this.tweezers?.hide();this.closeModal();this.screen='levels';this.activeModal=true;this.hud.active=false;
    const H=this.worldHeight,top=this.storage.safeInsets(390).top,L=homeLayout(H,top,this.bottom);
    this.worldBackground(this.overlay);
    const title=this.container('PixelGameTitle',this.overlay);this.position(title,195,L.titleY);title.addComponent(UITransform).setContentSize(350,116);
    const logo=title.addComponent(Sprite);logo.spriteFrame=this.titleFrame;logo.sizeMode=Sprite.SizeMode.CUSTOM;title.getComponent(UITransform)!.setContentSize(350,116);
    this.pixelHeading(this.overlay,'一颗颗拼出你的小世界',195,L.titleY+70,13,340);
    const summary=summarizeHomeProgress(this.levels,this.storage),index=summary.nextIndex,level=this.levels[index];
    const loaded=level?loadLevel(this.storage,level):null,record=loaded&&'record' in loaded?loaded.record:null;
    const continuing=!!record?.session.filled.length&&record.session.phase!=='collected';
    const allDone=summary.total>0&&summary.completed===summary.total&&!continuing;
    this.button(this.overlay,'关卡选择',55,top+29,88,34,()=>this.showMap());
    this.button(this.overlay,this.record.sound?'♪':'♪ ×',350,top+29,43,34,()=>{
      if(this.personalMode){this.activateLevel(this.lastFormalIndex);if(this.personalMode)return;}
      this.record.sound=!this.record.sound;this.dirty=true;this.flush();this.showLevels();
    });
    const primary=this.button(this.overlay,allDone?'欣赏作品集':continuing?'继续拼豆':'开始拼豆',195,L.primaryY,326,64,
      ()=>allDone?this.showShelf():continuing?this.activateLevel(index):this.showMap(),true);
    primary.node.name='HomeStartButton';primary.label.fontSize=34;primary.label.lineHeight=42;primary.label.enableOutline=true;primary.label.outlineColor=color('#9c3446');primary.label.outlineWidth=2;
    const create=this.button(this.overlay,'自制图纸',109,L.secondaryY,154,48,()=>this.showPatterns());create.label.fontSize=23;
    const shelf=this.button(this.overlay,'作品集',281,L.secondaryY,154,48,()=>this.showShelf());shelf.label.fontSize=23;
    this.pixelHeading(this.overlay,continuing&&level?`${level.title} · 已拼 ${record!.session.filled.length} 颗`:`${summary.completed} 件收藏  ·  ${summary.total} 款甜品等你探索`,195,L.footerY,11,350);
  }
  private showMap():void {
    const {top}=this.showNavigationPage('map','云上冒险','沿着星星小路，收集一岛甜蜜');
    const summary=summarizeHomeProgress(this.levels,this.storage),o=this.worldHeight/2;
    const content=this.scrollContent(top+88,120+this.levels.length*166,94);
    this.panel(content,195,o+33,334,46,theme.rose,theme.line,0);
    this.label(content,`${summary.completed} 件收藏    ${summary.unlocked} 关已解锁    ${summary.total} 款甜品`,195,o+33,12,theme.text,320,true);
    const points=this.levels.map((_,i)=>({x:i%2?281:109,y:139+i*166}));
    const trail=this.container('PixelStarTrail',content).addComponent(Graphics);
    points.slice(1).forEach((end,i)=>{const start=points[i];for(let t=.15;t<1;t+=.12){const x=start.x+(end.x-start.x)*t-195,y=-(start.y+(end.y-start.y)*t);pixelStar(trail,x,y,8,i<summary.completed?theme.yellow:'#70b8e9');}});
    this.levels.forEach((item,i)=>{
      const {x,y}=points[i],saved=loadLevel(this.storage,item),r='record' in saved?saved.record:null;
      const unlocked=levelUnlocked(this.levels,i,this.storage),done=!!r?.collected.includes(item.id),started=!!r?.session.filled.length&&r.session.phase!=='collected',cx=i%2?109:281;
      this.panel(content,x,o+y+8,110,88,unlocked?'#46bf64':'#7a91b7',theme.line,0);
      this.panel(content,x,o+y-4,102,90,unlocked?theme.surface:'#d2e1ef',theme.line,0);
      const art=this.container('LevelPixelPreview',content);this.position(art,x,o+y-6);
      FusedArtwork.create(art,item,Math.min(72/item.width,68/item.height)).showCells(null);
      this.panel(content,x,o+y+48,43,24,done?theme.mint:unlocked?theme.accent:theme.muted,theme.line,0);
      this.label(content,done?'✓':String(i+1).padStart(2,'0'),x,o+y+48,12,'#ffffff',40,true);
      this.label(content,item.title,cx,o+y-25,14,theme.text,150,true);
      this.label(content,!unlocked?'完成上一关解锁':started?`已拼 ${r!.session.filled.length} 颗`:done?'已收藏 · 可重新制作':`${item.cells.filter(Boolean).length} 颗豆 · 等你来拼`,cx,o+y-1,10,theme.muted,152);
      const b=this.button(content,!unlocked?'未解锁':started?'继续拼豆':done?'再做一次':'开始拼豆',cx,o+y+30,132,36,()=>this.activateLevel(i),unlocked);
      if(!unlocked)this.box(b.graphic,132,36,'#c1d2e6',theme.muted);
      const star=this.container('MapStar',content);this.position(star,i%2?335:52,o+y+85);pixelStar(star.addComponent(Graphics),0,0,15,theme.yellow);
    });
    const scroll=content.parent!.getComponent(ScrollView)!;
    this.scheduleOnce(()=>{if(content.isValid)scroll.scrollToOffset(new Vec2(0,Math.max(0,Math.min(this.homeScrollOffset,scroll.getMaxScrollOffset().y))),0);},0);
    this.navigation('levels');
  }
  private showPatterns(): void {
    const {top}=this.showNavigationPage('patterns','自制图纸','把喜欢的图片，变成手里的小作品',()=>this.leavePatterns());
    let entries:LevelDefinition[]=[];
    let readError=false;
    try{entries=this.patterns.list();}catch{readError=true;}
    const content=this.scrollContent(top+84,Math.max(490,282+entries.length*94),88),o=this.worldHeight/2;
    this.panel(content,195,o+93,350,178,theme.rose,theme.boardEdge,23);
    this.beadToken(content,325,o+41,17,theme.mint);
    this.label(content,'你的灵感，值得拼出来',173,o+35,20,theme.text,285,true);
    this.label(content,'选一张清晰的图 · 保留完整比例 · 逐格预览',185,o+69,11,theme.muted,310);
    this.button(content,this.pickingImage?'正在打开相册…':'＋  选图制作',195,o+115,310,44,()=>void this.pickImage(),true);
    this.label(content,'支持 JPG / PNG · 图纸保存在当前设备',195,o+153,10,theme.muted,320);
    this.label(content,'小板 14×14  /  中板 21×21  /  大板 29×29',195,o+210,11,theme.text,350,true);
    this.label(content,'简单图标用小板，细节较多建议选大板',195,o+233,10,theme.muted,350);
    this.label(content,`我的图纸 · ${entries.length} 张`,111,o+270,16,theme.text,185,true);
    if(!entries.length){
      this.panel(content,195,o+376,350,154,theme.surface,theme.line,22);
      this.beadToken(content,195,o+342,21,theme.lavender);
      this.label(content,readError?'图纸暂时无法读取':'第一份灵感，从这里收藏',195,o+390,16,theme.text,320,true);
      this.label(content,readError?'返回首页后可重试，原记录会保留':'选图 → 调整预览 → 保存图纸或开始拼豆',195,o+421,11,theme.muted,325);
    }
    entries.forEach((level,index)=>{
      const y=o+332+index*94;
      const card=this.panel(content,195,y,350,82,theme.surface,theme.line,18).node;
      card.on(Node.EventType.TOUCH_START,()=>{});
      card.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{e.propagationStopped=true;this.openPattern(level);});
      const art=this.container('PersonalThumbnail',content);this.position(art,66,y);
      FusedArtwork.create(art,level,57/Math.max(level.width,level.height),undefined,5).showCells(null);
      const saved=this.patterns.session(level).load(),total=level.cells.filter(Boolean).length;
      const status='record' in saved?saved.record.collected.includes(level.id)?'已收藏':`已拼 ${saved.record.session.filled.length}/${total} 颗`:saved.kind==='empty'?`待开拼 · ${total} 颗`:'存档暂时不可用';
      this.label(content,level.title,220,y-12,15,theme.text,225,true);
      this.label(content,`${level.width}×${level.height} · ${status}  ›`,220,y+14,11,theme.muted,225);
    });
    this.navigation('patterns');
  }

  private leavePatterns(): void {
    if (this.personalMode) this.activateLevel(this.lastFormalIndex);
    this.showLevels();
  }

  private async pickImage(): Promise<void> {
    if (this.pickingImage) return;
    if (!canPickPatternImage()) { this.toast('当前环境无法选图'); return; }
    const from = this.screen;
    this.pickingImage = true;
    try {
      const selected = await pickPatternImage();
      if (!selected || !this.isValid || this.screen !== from) return;
      const id = `own-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      this.draft = { id, ...selected, options: { ...defaultPatternOptions }, adjusting: false };
      this.showDraft();
    } catch (error) {
      if (this.isValid && this.screen === from) this.toast(error instanceof Error ? error.message : '无法读取图片，请重试');
    } finally {
      this.pickingImage = false;
    }
  }

  private generateDraft(): void {
    const draft = this.draft;
    if (!draft) return;
    try {
      draft.level = imageToLevel(draft.image, draft.id, draft.title, draft.options);
      draft.error = undefined;
    } catch (error) {
      draft.level = undefined;
      draft.adjusting = true;
      draft.error = error instanceof Error ? error.message : '图纸生成失败，请换图后重试';
    }
    this.showDraft();
  }

  private showDraft(): void {
    const draft = this.draft;
    if (!draft) { this.showPatterns(); return; }
    const level = draft.level;
    if (draft.detail) {
      const { top, compact } = this.showNavigationPage('draft', draft.detail === 'source' ? '原图' : '全彩成品', draft.title, () => {
        draft.detail = undefined;
        this.showDraft();
      });
      const start = top + (compact ? 73 : 100);
      const height = Math.max(84, Math.min(540, this.worldHeight - start - this.bottom - 22));
      const center = start + height / 2;
      this.panel(this.overlay, 195, center, 338, height, theme.surface, theme.line, 16);
      const art = this.container('PatternDetail', this.overlay);
      this.position(art, 195, center);
      if (draft.detail === 'result' && level) {
        const unit = Math.min(314 / level.width, (height - 16) / level.height);
        FusedArtwork.create(art, level, unit, undefined, 12).showCells(null);
        this.drawPatternGrid(art, level, unit);
      } else {
        art.addComponent(UITransform);
        PatternImage.show(art, draft.image, 314, height - 16);
      }
      return;
    }
    const { top, compact } = this.showNavigationPage('draft', level ? '图纸预览' : '选图制作', draft.title, () => {
      this.draft = undefined;
      this.showPatterns();
    });
    const imageHeight = compact ? 137 : 192;
    const content = this.scrollContent(top + (compact ? 69 : 95), imageHeight + (draft.adjusting ? 440 : 340));
    const origin = this.worldHeight / 2, center = origin + 37 + imageHeight / 2;
    this.label(content, '原图', level ? 109 : 195, origin + 20, 12, theme.text, 160, true);
    const sourcePanel = this.panel(content, level ? 109 : 195, center, level ? 166 : 338, imageHeight, theme.surface, theme.line, 14);
    this.bindPatternDetail(sourcePanel.node, draft, 'source');
    const source = this.container('PatternSource', content);
    this.position(source, level ? 109 : 195, center);
    source.addComponent(UITransform);
    PatternImage.show(source, draft.image, level ? 150 : 300, imageHeight - 14);
    if (level) {
      this.label(content, '全彩成品', 281, origin + 20, 12, theme.text, 160, true);
      const resultPanel = this.panel(content, 281, center, 166, imageHeight, theme.board, theme.boardEdge, 14);
      this.bindPatternDetail(resultPanel.node, draft, 'result');
      const art = this.container('PatternResult', content);
      this.position(art, 281, center);
      const previewUnit = Math.min(149 / level.width, (imageHeight - 14) / level.height);
      FusedArtwork.create(art, level, previewUnit, undefined, 12).showCells(null);
      this.drawPatternGrid(art, level, previewUnit);
    }
    let y = origin + imageHeight + 63;
    if (level) {
      this.label(content, `${level.width}×${level.height} 格 · ${level.cells.filter(Boolean).length} 颗豆 · ${level.palette.length} 色`,
        195, y, 13, theme.text, 338, true);
    } else if (draft.error) {
      this.label(content, draft.error, 195, y, 11, theme.accent, 338, true);
    }
    y += 41;
    const boardSize = draft.options.boardSize ?? 14;
    patternBoardSizes.forEach((board, index) => {
      this.button(content, `${board.label} ${board.size}×${board.size}`, 79 + index * 116, y, 106, 38, () => {
        if (draft.options.boardSize === board.size) return;
        draft.options.boardSize = board.size;
        this.generateDraft();
      }, boardSize === board.size);
    });
    this.label(content, `${boardSize}×${boardSize} 格 · 最多 ${boardSize * boardSize} 颗 · 空位不放豆`, 195, y + 33, 10, theme.muted, 338);
    y += 62;
    if (level || draft.error) {
      this.button(content, draft.adjusting ? '收起调整' : '调整图纸', 109, y, 166, 36, () => {
        draft.adjusting = !draft.adjusting;
        this.showDraft();
      });
      this.button(content, '换图', 281, y, 166, 36, () => void this.pickImage());
      y += 44;
    }
    if (level && typeof window !== 'undefined') {
      this.button(content, `孔距 ${this.printPitchMm}mm · 点击切换`, 109, y, 166, 36, () => {
        this.printPitchMm = this.printPitchMm === 2.6 ? 5 : 2.6;
        this.showDraft();
      });
      this.button(content, '打印 1:1 图纸', 281, y, 166, 36, () => this.printDraft());
      this.label(content, '按实际拼板选孔距 · 打印时选择 100% 原尺寸', 195, y + 31, 10, theme.muted, 338);
      y += 62;
    }
    if (draft.adjusting) {
      this.button(content, draft.options.cropToSubject ? '构图 · 裁到主体' : '构图 · 保留整图', 195, y, 338, 36, () => {
        draft.options.cropToSubject = !draft.options.cropToSubject;
        this.generateDraft();
      });
      y += 43;
      this.button(content, draft.options.removeWhiteBackground ? '背景 · 去白底' : '背景 · 保留原样', 195, y, 338, 36, () => {
        draft.options.removeWhiteBackground = !draft.options.removeWhiteBackground;
        this.generateDraft();
      });
      y += 46;
    }
    if (level) {
      this.button(content, '保存图纸', 109, y, 166, 43, () => this.confirmDraft(false));
      this.button(content, '开始拼豆', 281, y, 166, 43, () => this.confirmDraft(true), true);
    } else {
      this.button(content, '换图', 109, y, 166, 43, () => void this.pickImage());
      this.button(content, '生成图纸', 281, y, 166, 43, () => this.generateDraft(), true);
    }
  }

  private bindPatternDetail(panel: Node, draft: ImageDraft, detail: 'source' | 'result'): void {
    panel.on(Node.EventType.TOUCH_START, () => {});
    panel.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
      event.propagationStopped = true;
      draft.detail = detail;
      this.showDraft();
    });
  }

  private drawPatternGrid(parent: Node, level: LevelDefinition, unit: number): void {
    const gridNode = new Node('PatternGrid');
    gridNode.layer = parent.layer;
    parent.addChild(gridNode);
    const grid = gridNode.addComponent(Graphics);
    const width = level.width * unit, height = level.height * unit;
    grid.lineWidth = Math.max(.35, unit * .035);
    grid.strokeColor = color('#234a91', 46);
    for (let col = 0; col <= level.width; col++) {
      const x = -width / 2 + col * unit;
      grid.moveTo(x, -height / 2); grid.lineTo(x, height / 2);
    }
    for (let row = 0; row <= level.height; row++) {
      const y = height / 2 - row * unit;
      grid.moveTo(-width / 2, y); grid.lineTo(width / 2, y);
    }
    grid.stroke();
  }

  private printDraft(): void {
    const level = this.draft?.level;
    if (!level || typeof window === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
      this.toast('当前环境不支持打印');
      return;
    }
    const url = URL.createObjectURL(new Blob([patternPrintDocument(level, this.printPitchMm)], { type: 'text/html;charset=utf-8' }));
    const popup = window.open(url, '_blank');
    if (!popup) this.toast('请允许打开打印图纸窗口');
    this.scheduleOnce(() => URL.revokeObjectURL(url), 10);
  }

  private confirmDraft(start: boolean): void {
    const level = this.draft?.level;
    if (!level) return;
    try {
      this.patterns.save(level);
    } catch (error) {
      this.toast(error instanceof Error ? error.message : '保存失败，请重试');
      return;
    }
    this.draft = undefined;
    if (start) this.openPattern(level);
    else {
      this.showPatterns();
      this.toast('已保存到我的图纸');
    }
  }

  private openPattern(level: LevelDefinition): void {
    this.flush();
    if (this.saveFailed) { this.toast('保存失败，请重试'); return; }
    const repo = this.patterns.session(level);
    const loaded = repo.load();
    if (loaded.kind === 'invalid' || loaded.kind === 'storage-error') {
      this.toast('这张图的进度暂时无法读取');
      return;
    }
    const record = 'record' in loaded ? loaded.record : newRecord(level);
    if (loaded.kind === 'empty' && !repo.save(record)) {
      this.showPatterns();
      this.toast('图纸已保存，开启制作失败，请重试');
      return;
    }
    this.level = level;
    this.repo = repo;
    this.record = record;
    this.session = PlaySession.restore(level, record.session);
    this.openDrawerColor = this.session.selectedColor;
    this.screen = 'game';
    this.hud.active = true;
    this.build();
    this.refresh();
    if (loaded.kind === 'backup') this.toast('已从备用记录恢复进度');
  }

  private showShelf():void {
    const {top}=this.showNavigationPage('collection','我的作品集','把一颗颗耐心，摆成一排小骄傲');
    const saved=this.levels.map((level,index)=>({level,index,personal:false,loaded:loadLevel(this.storage,level)}));
    let personalReadError=false;
    try{this.patterns.list().forEach(level=>saved.push({level,index:-1,personal:true,loaded:this.patterns.session(level).load()}));}catch{personalReadError=true;}
    const collected=saved.filter(item=>'record' in item.loaded&&item.loaded.record.collected.includes(item.level.id));
    const content=this.scrollContent(top+84,Math.max(500,140+Math.ceil(collected.length/2)*188),88),o=this.worldHeight/2;
    this.panel(content,195,o+54,350,96,theme.mintPale,theme.line,22);
    this.label(content,`${collected.length} 件小作品`,128,o+41,23,theme.text,210,true);
    this.label(content,personalReadError?'自制图纸暂不可读，返回后可重试':'完成拼豆、熨烫、揭纸，就能收藏',164,o+73,11,theme.muted,285);
    this.beadToken(content,317,o+45,24,theme.mint);
    if(!collected.length){
      this.panel(content,195,o+250,350,256,theme.surface,theme.line,23);
      const art=this.container('EmptyShelfArtwork',content);this.position(art,195,o+192);
      const first=this.levels[0];
      if(first)FusedArtwork.create(art,first,Math.min(110/first.width,88/first.height),this.finishedFrames[0]).showCells(null);
      this.label(content,'给第一件作品留了个位置',195,o+264,18,theme.text,325,true);
      this.label(content,'从一块草莓蛋糕，开启你的收藏',195,o+294,11,theme.muted,320);
      this.button(content,'去拼第一份甜蜜  ›',195,o+339,286,44,()=>this.activateLevel(0),true);
    }
    collected.forEach(({level,index,personal},i)=>{
      const x=107+i%2*176,y=o+208+Math.floor(i/2)*188;
      const card=this.panel(content,x,y,166,174,theme.surface,theme.line,21).node;
      card.on(Node.EventType.TOUCH_START,()=>{});
      card.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{e.propagationStopped=true;this.showShelfDetail(index,personal?level:undefined);});
      const art=this.container('ShelfArtwork',content);this.position(art,x,y-21);
      FusedArtwork.create(art,level,Math.min(130/level.width,100/level.height),personal?undefined:this.finishedFrames[index]).showCells(null);
      this.label(content,level.title,x,y+46,12,theme.text,154,true);
      this.label(content,personal?'我的创作 · 已收藏':'甜品岛 · 已收藏',x,y+69,10,theme.muted,154);
    });
    this.navigation('collection');
  }
  private showShelfDetail(index:number,personal?:LevelDefinition):void {
    const level=personal??this.levels[index];
    const {top}=this.showNavigationPage('collection',level.title,personal?'我的创作 · 已收藏':'甜品岛 · 已收藏',()=>this.showShelf());
    const content=this.scrollContent(top+84,450,88),o=this.worldHeight/2;
    this.panel(content,195,o+145,350,270,theme.surface,theme.line,24);
    const art=this.container('ShelfDetailArtwork',content);this.position(art,195,o+140);
    FusedArtwork.create(art,level,Math.min(300/level.width,220/level.height),personal?undefined:this.finishedFrames[index]).showCells(null);
    this.label(content,`${level.cells.filter(Boolean).length} 颗豆 · ${level.palette.length} 色 · 每一颗都是耐心`,195,o+304,11,theme.muted,340);
    this.button(content,'再做一次',195,o+352,338,44,()=>{if(personal)this.openPattern(level);else this.activateLevel(index);if(this.screen==='game')this.confirmRestart();},true);
    this.button(content,'返回作品集',195,o+406,338,40,()=>this.showShelf());
    this.navigation('collection');
  }
  private showCollection():void {
    if(!this.record.collected.includes(this.level.id)){this.modal('我的作品集','完成拼豆、熨烫和揭纸，就能收藏这件作品。',[{title:'继续制作',run:()=>this.closeModal(),primary:true}]);return;}
    const next=this.levels.indexOf(this.level)+1;
    const canContinue=!this.personalMode&&!this.sampleMode&&next<this.levels.length;
    const status=this.personalMode?'✓ 已收藏到我的图纸与作品集':this.sampleMode?'✓ 已收藏到本机试玩记录':`✓ 甜品岛收藏 +1${canContinue?' · 下一关已解锁':' · 甜品岛已完成'}`;
    const actions:Action[]=[
      {title:'再做一次',run:()=>this.confirmRestart()},
      {title:this.sampleMode?'退出样本试玩':'欣赏作品集',run:()=>this.sampleMode?this.leaveGame():this.showShelf()},
      {title:canContinue?'下一份甜蜜  ›':'回到作品',run:()=>canContinue?this.activateLevel(next):this.closeModal(),primary:true},
    ];
    this.modal('完成啦！'+this.level.title,status,actions,true);
  }
  private modal(title:string,message:string,actions:Action[],artwork=false):void {
    this.closeModal();this.clearInput();this.flush();this.activeModal=true;this.tweezers?.hide();const H=this.worldHeight;
    const height=Math.min(H-30,artwork?465:210+actions.length*53),top=H-height;
    const blocker=this.panel(this.overlay,195,H/2,Math.max(390,view.getVisibleSize().width),H,this.screen==='game'?'#59413e66':'#101d6dcc',undefined,0).node;blocker.addComponent(BlockInputEvents);
    let backdropStart:Point|null=null;
    blocker.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{backdropStart=this.uiPoint(e);});
    blocker.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{const p=this.uiPoint(e);if(backdropStart&&Math.hypot(p.x-backdropStart.x,p.y-backdropStart.y)>10)backdropStart=null;});
    blocker.on(Node.EventType.TOUCH_CANCEL,()=>{backdropStart=null;});
    blocker.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{e.propagationStopped=true;const p=this.uiPoint(e),tap=backdropStart;backdropStart=null;if(tap&&p.y>H/2-top&&!this.blocked)this.closeModal();});
    // The sheet catches its own blank areas so only the outside backdrop dismisses it.
    const sheet=this.panel(this.overlay,195,top+height/2,390,height,theme.surface,undefined,25).node;sheet.addComponent(BlockInputEvents);
    this.label(this.overlay,title,195,top+37,22,theme.text,330,true);this.label(this.overlay,message,195,top+83,12,theme.muted,335);
    const actionStart=H-this.bottom-25-(actions.length-.5)*53;
    if (artwork) {
      const art = this.container('Artwork', this.overlay);
      const sampleArtTop = top + 105;
      const sampleArtBottom = actionStart - 30;
      const center = this.sampleMode || this.personalMode ? (sampleArtTop + sampleArtBottom) / 2 : top + 185;
      const maxHeight = this.sampleMode || this.personalMode ? sampleArtBottom - sampleArtTop : this.level.order === 1 ? 165 : 290;
      this.position(art, 195, center);
      const unit = Math.min(11, 360 / this.level.width, maxHeight / this.level.height);
      FusedArtwork.create(art, this.level, unit, this.currentFinishedFrame).showCells(null);
    }
    actions.forEach((a,i)=>this.button(this.overlay,a.title,195,actionStart+i*53,338,44,a.run,a.primary));
  }
  private closeModal():void {if(this.overlay)this.overlay.destroyAllChildren();this.activeModal=false;this.clearInput();}
  private recovery(kind:string):void {this.modal('进度暂时无法恢复',kind==='invalid'?'本机记录损坏或图纸版本不一致，原始记录仍保留。':'本机存储暂不可用，请重试。',[
    {title:'重试读取记录',run:()=>{const r=this.repo.load();if('record'in r){this.record=r.record;this.session=PlaySession.restore(this.level,this.record.session);this.openDrawerColor=this.session.selectedColor;this.revealPaletteColor();this.blocked=false;this.closeModal();this.refresh();}else this.toast('暂未恢复，请稍后重试');}},
    {title:'确认新开一局',run:()=>{this.modal('保留旧记录，新开一局？','会先备份当前记录，备份失败时不清空。',[{title:'备份并重新开始',run:()=>{try{const backup=[this.storage.get(this.storagePrefix()+'-0'),this.storage.get(this.storagePrefix()+'-1')];this.storage.set(this.storagePrefix()+'-recovery',JSON.stringify(backup));const r=newRecord(this.level);if(!this.repo.save(r))throw new Error('save');this.record=r;this.session=new PlaySession(this.level);this.openDrawerColor=this.session.selectedColor;this.revealPaletteColor();this.blocked=false;this.closeModal();this.refresh();}catch{this.toast('存储失败，旧记录已保留');}},primary:true},{title:'返回',run:()=>this.recovery(kind)}]);}},
  ]);}
  private toast(text:string):void {if(this.toastNode)this.toastNode.destroy();const y=this.stageTop+this.stageHeight-24;const n=this.panel(this.overlay,195,y,Math.min(356,text.length*12+30),38,'#142c71f5',undefined,13).node;this.toastNode=n;this.label(n,text,195,this.worldHeight/2,11,'#fffaf1',330);this.scheduleOnce(()=>{if(n.isValid)n.destroy();if(this.toastNode===n)this.toastNode=null;},2.6);}
  private flush():void {if(!this.ready||this.blocked||!this.dirty)return;this.record.session=this.session.serialize();if(this.repo.save(this.record)){this.dirty=false;this.saveFailed=false;}else{if(!this.saveFailed)this.toast('进度保存失败，请在设置中重试');this.saveFailed=true;}this.elapsed=0;}
  private refreshTweezers():void {
    if(!this.tweezers)return;
    const p=this.mousePoint;
    if(!p||!this.ready||this.wasHidden||this.activeModal||this.blocked||this.session.phase!=='placing'||this.panModifier||this.rightPanning){this.tweezers.hide();return;}
    const frame=this.board.frame.getComponent(UITransform)!,local=frame.convertToNodeSpaceAR(new Vec3(p.x,p.y,0));
    if(Math.abs(local.x)>=frame.width/2||Math.abs(local.y)>=frame.height/2){this.tweezers.hide();return;}
    const cell=this.board.local(p);
    if(cell.x<0||cell.y<0||cell.x>=this.level.width||cell.y>=this.level.height){this.tweezers.hide();return;}
    const selected=this.level.palette.find(c=>c.id===this.session.selectedColor);
    if(!selected){this.tweezers.hide();return;}
    this.tweezers.show(p,selected.hex,this.board.beadSize,this.board.zoom,this.session.remaining()>0);
  }
  update(dt:number):void {this.refreshTweezers();if(this.ready&&this.board.focusing)this.refreshViewportHint();if(this.ready&&this.dirty&&!this.wasHidden){this.elapsed+=dt;if(this.elapsed>=.2)this.flush();}}
  private onHide():void {this.wasHidden=true;this.mousePoint=null;this.tweezers?.hide();this.panModifier=false;this.clearInput();this.audio?.stop();this.flush();}
  private onShow():void {this.wasHidden=false;this.clearInput();if(this.ready)this.refresh();}
  private onResize():void {if(this.ready){
    const wide=sys.isBrowser&&window.innerWidth>=window.innerHeight;
    if(wide!==this.wideLayout){this.wideLayout=wide;view.setDesignResolutionSize(390,844,wide?ResolutionPolicy.FIXED_HEIGHT:this.sampleMode?ResolutionPolicy.SHOW_ALL:ResolutionPolicy.FIXED_WIDTH);}
    const screen=this.screen;this.clearInput();this.flush();this.hud.active=true;this.build();this.refresh();if(screen==='home')this.showHome();else if(screen==='levels')this.showLevels();else if(screen==='map')this.showMap();else if(screen==='collection')this.showShelf();else if(screen==='patterns')this.showPatterns();else if(screen==='draft')this.showDraft();}}
  onDestroy():void {this.paletteDrawerStates.forEach(state=>Tween.stopAllByTarget(state));this.tweezers?.destroy();this.tweezers=null;this.board?.stopFocus();this.clearHint();this.flush();game.off(Game.EVENT_HIDE,this.onHide,this);game.off(Game.EVENT_SHOW,this.onShow,this);view.off('canvas-resize',this.onResize,this);input.off(Input.EventType.KEY_DOWN,this.keyDown,this);input.off(Input.EventType.KEY_UP,this.keyUp,this);input.off(Input.EventType.MOUSE_DOWN,this.trackMouse,this);input.off(Input.EventType.MOUSE_MOVE,this.mouseMove,this);input.off(Input.EventType.MOUSE_UP,this.mouseUp,this);}
}
