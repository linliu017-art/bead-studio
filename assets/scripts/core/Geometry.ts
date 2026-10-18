export interface Point { x: number; y: number }
/** Cocos UI locations use a bottom-left origin; this camera is centered at world origin. */
export function centeredUiPoint(p: Point, width: number, height: number): Point {
  return { x: p.x-width/2, y: p.y-height/2 };
}
/** Center a target cell at a readable detail scale without zooming an already closer view out. */
export function viewportForCell(index:number,width:number,height:number,unit:number,currentZoom:number):{zoom:number;offset:Point} {
  if(!Number.isInteger(index)||index<0||index>=width*height||!Number.isFinite(unit)||unit<=0)throw new RangeError('Invalid focus cell');
  const zoom=Math.min(3,Math.max(currentZoom,2.4,24/unit));
  return {zoom,offset:{x:(width/2-index%width-.5)*unit*zoom,y:(Math.floor(index/width)+.5-height/2)*unit*zoom}};
}
/** Movement for an explicitly requested pan; ordinary strokes always remain placement. */
export class BoardPanGesture {
  private origin: Point | null = null;
  private offset: Point = { x: 0, y: 0 };
  private dragged = false;
  get active(): boolean { return this.origin !== null; }
  start(point: Point, offset: Point): void {
    this.origin = { ...point }; this.offset = { ...offset }; this.dragged = false;
  }
  move(point: Point): Point | null {
    if (!this.origin) return null;
    const dx = point.x-this.origin.x, dy = point.y-this.origin.y;
    if (!this.dragged && Math.hypot(dx, dy) < 6) return null;
    this.dragged = true;
    return { x: this.offset.x+dx, y: this.offset.y+dy };
  }
  cancel(): void { this.origin = null; this.dragged = false; }
}
/** Traverses interiors of grid cells. Exact corner crossings enter only the diagonal cell. */
export function traverseGrid(from: Point, to: Point, width: number, height: number): number[] {
  if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) return [];
  // Clip the segment first so very distant pointer coordinates cannot cause an unbounded loop.
  const dx = to.x - from.x, dy = to.y - from.y;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, from.x], [dx, width - from.x], [-dy, from.y], [dy, height - from.y]]) {
    if (p === 0) { if (q < 0) return []; continue; }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
    if (t0 > t1) return [];
  }
  const eps = 1e-8;
  const ax = Math.min(width - eps, Math.max(0, from.x + dx * t0));
  const ay = Math.min(height - eps, Math.max(0, from.y + dy * t0));
  const bx = Math.min(width - eps, Math.max(0, from.x + dx * t1));
  const by = Math.min(height - eps, Math.max(0, from.y + dy * t1));
  if ((dx === 0 && from.x >= width) || (dy === 0 && from.y >= height)) return [];
  let x = Math.floor(ax), y = Math.floor(ay);
  const ex = Math.floor(bx), ey = Math.floor(by), sx = Math.sign(bx - ax), sy = Math.sign(by - ay);
  const stepX = sx ? 1 / Math.abs(bx - ax) : Infinity, stepY = sy ? 1 / Math.abs(by - ay) : Infinity;
  let nextX = sx ? ((sx > 0 ? x + 1 - ax : ax - x) / Math.abs(bx - ax)) : Infinity;
  let nextY = sy ? ((sy > 0 ? y + 1 - ay : ay - y) / Math.abs(by - ay)) : Infinity;
  const result: number[] = [];
  for (let count = 0; count <= width + height + 2; count++) {
    if (x >= 0 && x < width && y >= 0 && y < height) result.push(y * width + x);
    if (x === ex && y === ey) break;
    if (Math.abs(nextX - nextY) < 1e-9) { x += sx; y += sy; nextX += stepX; nextY += stepY; }
    else if (nextX < nextY) { x += sx; nextX += stepX; }
    else { y += sy; nextY += stepY; }
  }
  return result;
}
export function gridIndex(p: Point, width: number, height: number): number | null {
  return p.x >= 0 && p.y >= 0 && p.x < width && p.y < height ? Math.floor(p.y) * width + Math.floor(p.x) : null;
}
export function sampleSegment(a: Point, b: Point, spacing: number): Point[] {
  const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(.1, spacing)));
  return Array.from({ length: count + 1 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / count, y: a.y + (b.y - a.y) * i / count }));
}
export type GestureMode = 'idle' | 'placing' | 'panning' | 'transforming' | 'await-release';
export class GestureState {
  mode: GestureMode = 'idle';
  private ids = new Set<number>();
  start(id: number, intent: 'placing' | 'panning' = 'placing'): GestureMode {
    this.ids.add(id);
    if (this.ids.size >= 2) this.mode = 'transforming';
    else if (this.mode === 'idle') this.mode = intent;
    return this.mode;
  }
  end(id: number): GestureMode {
    this.ids.delete(id);
    if (!this.ids.size) this.mode = 'idle';
    else if (this.mode === 'transforming') this.mode = 'await-release';
    return this.mode;
  }
  cancel(): void { this.ids.clear(); this.mode = 'idle'; }
}
