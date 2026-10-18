import { LevelDefinition } from './Level';
import { Point, sampleSegment } from './Geometry';
export type Phase = 'placing' | 'ready-to-iron' | 'ironing' | 'ready-to-reveal' | 'collected';
export interface SessionData {
  levelId: string; levelRevision: number; phase: Phase; selectedColor: number | null;
  filled: number[]; heated: number[];
}
export type PlaceResult = 'accepted' | 'invalid-phase' | 'invalid-position' | 'wrong-color' | 'already-filled' | 'no-color-selected';
export class PlaySession {
  readonly filled = new Set<number>();
  readonly heated = new Set<number>();
  readonly targets: number[];
  phase: Phase = 'placing';
  selectedColor: number | null;
  constructor(readonly level: LevelDefinition) {
    this.targets = level.cells.flatMap((id, i) => id ? [i] : []);
    this.selectedColor = level.palette[0].id;
  }
  get total(): number { return this.targets.length; }
  remaining(colorId = this.selectedColor): number { return this.targets.filter(i => this.level.cells[i] === colorId && !this.filled.has(i)).length; }
  nextHint(after: number | null = null): { index: number; colorId: number } | null {
    if(this.phase!=='placing')return null;
    const ids=this.level.palette.map(c=>c.id);
    const colors=this.selectedColor===null?ids:[this.selectedColor,...ids.filter(id=>id!==this.selectedColor)];
    for(const colorId of colors){
      const remaining=this.targets.filter(i=>this.level.cells[i]===colorId&&!this.filled.has(i));
      if(remaining.length)return {index:remaining.find(i=>after===null||i>after)??remaining[0],colorId};
    }
    return null;
  }
  place(index: number, colorId = this.selectedColor): PlaceResult {
    if (this.phase !== 'placing') return 'invalid-phase';
    if (colorId === null) return 'no-color-selected';
    if (!Number.isInteger(index) || !this.level.cells[index]) return 'invalid-position';
    if (this.filled.has(index)) return 'already-filled';
    if (this.level.cells[index] !== colorId) return 'wrong-color';
    this.filled.add(index);
    if (this.filled.size === this.total) this.phase = 'ready-to-iron';
    return 'accepted';
  }
  startIron(): boolean {
    if (this.phase !== 'ready-to-iron') return false;
    this.phase = 'ironing'; return true;
  }
  heat(a: Point, b: Point, radius = 3): number[] {
    if (this.phase !== 'ironing' || radius <= 0) return [];
    const changed: number[] = [];
    for (const p of sampleSegment(a, b, radius / 2)) {
      for (const index of this.targets) {
        const x = index % this.level.width + .5, y = Math.floor(index / this.level.width) + .5;
        if (!this.heated.has(index) && Math.hypot(p.x - x, p.y - y) <= radius) {
          this.heated.add(index); changed.push(index);
        }
      }
    }
    if (this.heated.size === this.total) this.phase = 'ready-to-reveal';
    return changed;
  }
  serialize(): SessionData {
    return { levelId: this.level.id, levelRevision: this.level.revision, phase: this.phase, selectedColor: this.selectedColor, filled: Array.from(this.filled).sort((a,b)=>a-b), heated: Array.from(this.heated).sort((a,b)=>a-b) };
  }
  static restore(level: LevelDefinition, data: SessionData): PlaySession {
    if (!data || data.levelId !== level.id || data.levelRevision !== level.revision) throw new Error('图纸版本已变化');
    const session = new PlaySession(level);
    if (!['placing','ready-to-iron','ironing','ready-to-reveal','collected'].includes(data.phase)) throw new Error('制作阶段无效');
    if (data.selectedColor !== null && !level.palette.some(c => c.id === data.selectedColor)) throw new Error('所选颜色无效');
    for (const key of ['filled','heated'] as const) {
      if (!Array.isArray(data[key]) || new Set(data[key]).size !== data[key].length) throw new Error('位置数组无效');
      for (const i of data[key]) {
        if (!Number.isInteger(i) || !level.cells[i]) throw new Error('存档位置越界');
        session[key].add(i);
      }
    }
    if (data.phase !== 'placing' && session.filled.size !== session.total) throw new Error('未拼完却进入后续阶段');
    if (['placing','ready-to-iron'].includes(data.phase) && session.heated.size) throw new Error('熨烫状态不一致');
    if (['ready-to-reveal','collected'].includes(data.phase) && session.heated.size !== session.total) throw new Error('熨烫状态不完整');
    session.phase = data.phase === 'placing' && session.filled.size === session.total ? 'ready-to-iron' : data.phase;
    session.selectedColor = data.selectedColor; return session;
  }
}
