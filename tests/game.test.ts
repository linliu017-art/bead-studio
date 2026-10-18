import { describe, it, expect } from 'vitest';
import raw from '../assets/resources/levels/dessert-001.json';
import { validateLevel } from '../assets/scripts/core/Level';
import { PlaySession } from '../assets/scripts/core/Session';
import { fusedSurface } from '../assets/scripts/core/FusedSurface';
import { traverseGrid, gridIndex, GestureState, BoardPanGesture, centeredUiPoint, viewportForCell } from '../assets/scripts/core/Geometry';
import { SaveRepository, newRecord, collectionCandidate, StoragePort } from '../assets/scripts/core/SaveRepository';
const level = validateLevel(raw);
function finish() { const s=new PlaySession(level);for(const i of s.targets)s.place(i,level.cells[i]);return s; }
class MemoryStorage implements StoragePort {
  values = new Map<string,string>(); fail=false; truncate=false;
  get(k:string){return this.values.get(k)??null;}
  set(k:string,v:string){if(this.fail)throw new Error('quota');this.values.set(k,this.truncate?v.slice(0,10):v);}
}
describe('level contracts',()=>{
  it('preserves the approved detailed artwork',()=>{expect(level.cells.filter(Boolean)).toHaveLength(334);expect(level.palette).toHaveLength(7);});
  it.each([{...raw,cells:[1]}, {...raw,palette:[...raw.palette,raw.palette[0]]},{...raw,cells:raw.cells.map(()=>0)},{...raw,revision:0}])('rejects invalid levels',bad=>expect(()=>validateLevel(bad)).toThrow());
});
describe('placement and phases',()=>{
  it('rejects wrong colors, blank positions and duplicates',()=>{const s=new PlaySession(level),i=s.targets[0];expect(s.place(-1)).toBe('invalid-position');expect(s.place(0)).toBe('invalid-position');expect(s.place(i,99)).toBe('wrong-color');expect(s.place(i,level.cells[i])).toBe('accepted');expect(s.place(i,level.cells[i])).toBe('already-filled');expect(s.filled.size).toBe(1);});
  it('blocks placement after clearing the selected color and resumes after reselecting',()=>{const s=new PlaySession(level),i=s.targets[0];s.selectedColor=null;expect(s.place(i)).toBe('no-color-selected');expect(s.filled.size).toBe(0);expect(s.remaining()).toBe(0);s.selectedColor=level.cells[i];expect(s.place(i)).toBe('accepted');});
  it('requires every bead before ironing',()=>{const s=new PlaySession(level);expect(s.startIron()).toBe(false);for(const i of s.targets.slice(0,-1))s.place(i,level.cells[i]);expect(s.phase).toBe('placing');s.place(s.targets.at(-1)!,level.cells[s.targets.at(-1)!]);expect(s.phase).toBe('ready-to-iron');expect(s.startIron()).toBe(true);expect(s.place(s.targets[0])).toBe('invalid-phase');});
  it('does not count empty or repeatedly heated regions',()=>{const s=finish();s.startIron();s.heat({x:-20,y:-20},{x:-20,y:-20});expect(s.heated.size).toBe(0);s.heat({x:14,y:6},{x:14,y:6});const n=s.heated.size;expect(n).toBeGreaterThan(0);s.heat({x:14,y:6},{x:14,y:6});expect(s.heated.size).toBe(n);expect(s.phase).toBe('ironing');for(let y=0;y<28;y+=3)s.heat({x:0,y},{x:28,y});expect(s.phase).toBe('ready-to-reveal');expect(s.heated.size).toBe(334);});
  it('round-trips partial and ironing progress',()=>{const s=finish();s.startIron();s.heat({x:14,y:6},{x:14,y:6});expect(PlaySession.restore(level,s.serialize()).serialize()).toEqual(s.serialize());});
  it('rejects impossible saved states',()=>{const s=new PlaySession(level);expect(()=>PlaySession.restore(level,{...s.serialize(),phase:'collected'})).toThrow();expect(()=>PlaySession.restore(level,{...s.serialize(),levelRevision:2})).toThrow();expect(()=>PlaySession.restore(level,{...s.serialize(),filled:[9999]})).toThrow();});
});
describe('focused hints',()=>{
  it('cycles remaining targets of the selected color and skips filled cells without placing',()=>{const s=new PlaySession(level),targets=s.targets.filter(i=>level.cells[i]===s.selectedColor);expect(s.nextHint()?.index).toBe(targets[0]);expect(s.nextHint(targets[0])?.index).toBe(targets[1]);expect(s.nextHint(targets.at(-1)!)?.index).toBe(targets[0]);s.place(targets[0]);expect(s.nextHint()?.index).toBe(targets[1]);expect(s.filled.size).toBe(1);});
  it('offers another unfinished color when the selected one is complete',()=>{const s=new PlaySession(level);for(const i of s.targets)if(level.cells[i]===s.selectedColor)s.place(i);const selected=s.selectedColor;expect(s.nextHint()?.colorId).toBe(level.palette[1].id);expect(s.selectedColor).toBe(selected);});
  it('offers an unfinished color when no color is selected without placing a bead',()=>{const s=new PlaySession(level);s.selectedColor=null;const hint=s.nextHint();expect(hint).not.toBeNull();expect(hint!.colorId).toBe(level.cells[hint!.index]);expect(s.selectedColor).toBeNull();expect(s.filled.size).toBe(0);});
  it('finds the last missing bead and stops offering targets after placement',()=>{const s=new PlaySession(level),last=s.targets.find(i=>level.cells[i]===3)!;for(const i of s.targets)if(i!==last)s.place(i,level.cells[i]);expect(s.nextHint()).toEqual({index:last,colorId:3});expect(s.filled.size).toBe(333);s.place(last,3);expect(s.nextHint()).toBeNull();});
  it('centers edge and interior cells at readable zoom while preserving a closer view',()=>{for(const index of [0,27,14*28+14,783]){const focus=viewportForCell(index,28,28,11,3);expect(focus.zoom).toBe(3);expect((index%28+.5-14)*11*focus.zoom+focus.offset.x).toBeCloseTo(0);expect((14-Math.floor(index/28)-.5)*11*focus.zoom+focus.offset.y).toBeCloseTo(0);}expect(viewportForCell(100,28,28,11,1).zoom).toBe(2.4);expect(viewportForCell(100,28,28,5,1).zoom).toBe(3);});
  it('rejects invalid focus locations',()=>{expect(()=>viewportForCell(-1,28,28,11,1)).toThrow();expect(()=>viewportForCell(784,28,28,11,1)).toThrow();expect(()=>viewportForCell(0,28,28,0,1)).toThrow();});
});
describe('continuous paths and gestures',()=>{
  it('does not move the board for a small pan pointer jitter',()=>{const drag=new BoardPanGesture();drag.start({x:10,y:20},{x:30,y:-15});expect(drag.move({x:12,y:22})).toBeNull();});
  it('pans from the original offset without accumulating drift',()=>{const drag=new BoardPanGesture();drag.start({x:10,y:20},{x:30,y:-15});expect(drag.move({x:40,y:5})).toEqual({x:60,y:-30});expect(drag.move({x:11,y:21})).toEqual({x:31,y:-14});});
  it('cancels pan deltas when another gesture takes over',()=>{const drag=new BoardPanGesture();drag.start({x:0,y:0},{x:0,y:0});drag.cancel();expect(drag.active).toBe(false);expect(drag.move({x:50,y:50})).toBeNull();});
  it('keeps ordinary strokes as placement and requires explicit pan intent',()=>{const g=new GestureState();expect(g.start(1)).toBe('placing');g.end(1);expect(g.start(2,'panning')).toBe('panning');g.end(2);expect(g.start(3)).toBe('placing');});
  it('does not turn a pan or remaining pinch finger into a placement stroke',()=>{const g=new GestureState();g.start(1,'panning');expect(g.start(1)).toBe('panning');expect(g.start(2)).toBe('transforming');expect(g.end(2)).toBe('await-release');expect(g.start(1)).toBe('await-release');expect(g.end(1)).toBe('idle');});
  it('converts bottom-left UI coordinates to the centered camera world',()=>{expect(centeredUiPoint({x:195,y:422},390,844)).toEqual({x:0,y:0});const p=centeredUiPoint({x:166.4,y:560.1},390,844);expect(p.x).toBeCloseTo(-28.6);expect(p.y).toBeCloseTo(138.1);expect(centeredUiPoint({x:0,y:0},390,690)).toEqual({x:-195,y:-345});});
  it('visits every crossed cell without widening diagonal corners',()=>{expect(traverseGrid({x:.5,y:.5},{x:4.5,y:.5},5,5)).toEqual([0,1,2,3,4]);expect(traverseGrid({x:.5,y:.5},{x:2.5,y:2.5},5,5)).toEqual([0,6,12]);});
  it('clips long paths and preserves right-open boundaries',()=>{expect(traverseGrid({x:-999999,y:.5},{x:999999,y:.5},5,5)).toEqual([0,1,2,3,4]);expect(gridIndex({x:5,y:2},5,5)).toBeNull();expect(traverseGrid({x:5,y:0},{x:5,y:4},5,5)).toEqual([]);});
  it('does not resume placement when one finger remains after pinch',()=>{const g=new GestureState();expect(g.start(1)).toBe('placing');expect(g.start(2)).toBe('transforming');expect(g.end(2)).toBe('await-release');expect(g.end(1)).toBe('idle');g.start(1);g.cancel();expect(g.mode).toBe('idle');});
});
describe('verified A/B saves',()=>{
  it('restores the newest valid snapshot and falls back after corruption',()=>{const storage=new MemoryStorage(),repo=new SaveRepository(storage,level);expect(repo.load().kind).toBe('empty');const r=newRecord(level);expect(repo.save(r)).toBe(true);r.tutorialStep=1;expect(repo.save(r)).toBe(true);expect(new SaveRepository(storage,level).load()).toMatchObject({kind:'valid',record:{tutorialStep:1}});storage.values.set('bead-studio-game-v1-1','broken');expect(new SaveRepository(storage,level).load()).toMatchObject({kind:'backup',record:{tutorialStep:0}});});
  it('saves and restores cleared selection while preserving existing progress',()=>{const st=new MemoryStorage(),repo=new SaveRepository(st,level),s=new PlaySession(level),i=s.targets[0];s.place(i,level.cells[i]);s.selectedColor=null;const r=newRecord(level);r.session=s.serialize();expect(repo.save(r)).toBe(true);const loaded=new SaveRepository(st,level).load();expect(loaded).toMatchObject({kind:'valid',record:{session:{selectedColor:null,filled:[i]}}});if('record' in loaded){const restored=PlaySession.restore(level,loaded.record.session);expect(restored.selectedColor).toBeNull();expect(restored.filled.has(i)).toBe(true);}});
  it('does not advance revision on failed write or verification',()=>{const st=new MemoryStorage(),r=new SaveRepository(st,level);r.save(newRecord(level));st.fail=true;expect(r.save(newRecord(level))).toBe(false);expect(r.revision).toBe(1);st.fail=false;st.truncate=true;expect(r.save(newRecord(level))).toBe(false);expect(r.revision).toBe(1);expect(new SaveRepository(st,level).load().kind).toBe('backup');});
  it('requires a full artwork and keeps collection idempotent',()=>{const s=finish();expect(()=>collectionCandidate(newRecord(level),s)).toThrow();s.startIron();for(let y=0;y<28;y+=3)s.heat({x:0,y},{x:28,y});const draft=collectionCandidate(newRecord(level),s),st=new MemoryStorage(),repo=new SaveRepository(st,level);st.fail=true;expect(repo.save(draft)).toBe(false);expect(s.phase).toBe('ready-to-reveal');st.fail=false;expect(repo.save(draft)).toBe(true);s.phase='collected';expect(collectionCandidate(draft,s).collected).toEqual([level.id]);expect(draft.completed).toEqual([level.id]);});
});

describe('sealed artwork surface',()=>{
  it('seals every bead center while keeping empty artwork cells transparent',()=>{
    const surface=fusedSurface(level),d=24;
    level.cells.forEach((id,i)=>{const x=(i%level.width)*d+d/2,y=Math.floor(i/level.width)*d+d/2;expect(surface.pixels[(y*surface.width+x)*4+3]).toBe(id?255:0);});
  });
  it('joins neighboring color regions without transparent seams',()=>{
    const surface=fusedSurface({...level,width:2,height:1,cells:[1,2]});
    for(let y=0;y<24;y++){expect(surface.pixels[(y*48+23)*4+3]).toBe(255);expect(surface.pixels[(y*48+24)*4+3]).toBe(255);}
    expect(surface.pixels[(12*48+12)*4+3]).toBe(255);
  });
});
