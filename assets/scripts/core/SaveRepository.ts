import { LevelDefinition } from './Level';
import { PlaySession, SessionData } from './Session';
export interface StoragePort { get(key: string): string | null; set(key: string, value: string): void }
export interface PlayerRecord {
  schemaVersion: 1;
  completed: string[]; collected: string[];
  sound: boolean; tutorialStep: number;
  session: SessionData;
}
interface Envelope { revision: number; checksum: string; body: PlayerRecord }
export type LoadResult = { kind: 'valid' | 'backup'; record: PlayerRecord } | { kind: 'empty' | 'invalid' | 'storage-error' };
export function checksum(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16);
}
export function newRecord(level: LevelDefinition): PlayerRecord {
  return { schemaVersion: 1, completed: [], collected: [], sound: true, tutorialStep: 0, session: new PlaySession(level).serialize() };
}
export function validateRecord(record: PlayerRecord, level: LevelDefinition): void {
  if (!record || record.schemaVersion !== 1 || typeof record.sound !== 'boolean' || !Number.isInteger(record.tutorialStep) || record.tutorialStep < 0 || record.tutorialStep > 3) throw new Error('玩家记录无效');
  for (const key of ['completed','collected'] as const) {
    if (!Array.isArray(record[key]) || new Set(record[key]).size !== record[key].length || record[key].some(id => id !== level.id)) throw new Error('作品记录无效');
  }
  if (record.collected.some(id => !record.completed.includes(id))) throw new Error('收藏与通关不一致');
  const session = PlaySession.restore(level, record.session);
  if (session.phase === 'collected' && !record.collected.includes(level.id)) throw new Error('已领取状态缺失收藏');
}
export class SaveRepository {
  revision = 0;
  private active = -1;
  constructor(private storage: StoragePort, private level: LevelDefinition, private prefix = 'bead-studio-game-v1') {}
  private read(slot: number): Envelope | null {
    const raw = this.storage.get(`${this.prefix}-${slot}`);
    if (!raw) return null;
    try {
      const d = JSON.parse(raw) as Envelope;
      if (!Number.isSafeInteger(d.revision) || d.revision < 1 || checksum(JSON.stringify(d.body)) !== d.checksum) return null;
      validateRecord(d.body, this.level); return d;
    } catch { return null; }
  }
  load(): LoadResult {
    try {
      const raw = [this.storage.get(`${this.prefix}-0`), this.storage.get(`${this.prefix}-1`)];
      const valid = [this.read(0), this.read(1)].map((data, slot) => ({ data, slot })).filter((v): v is { data: Envelope; slot: number } => !!v.data).sort((a,b)=>b.data.revision-a.data.revision);
      if (!valid.length) return { kind: raw.some(Boolean) ? 'invalid' : 'empty' };
      const best = valid[0]; this.revision = best.data.revision; this.active = best.slot;
      return { kind: raw.some((v,i)=>!!v&&!this.read(i)) ? 'backup' : 'valid', record: best.data.body };
    } catch { return { kind: 'storage-error' }; }
  }
  save(record: PlayerRecord): boolean {
    try {
      validateRecord(record, this.level);
      const slot = this.active === 0 ? 1 : 0, revision = this.revision + 1;
      const body = JSON.parse(JSON.stringify(record)) as PlayerRecord;
      const envelope: Envelope = { revision, checksum: checksum(JSON.stringify(body)), body };
      this.storage.set(`${this.prefix}-${slot}`, JSON.stringify(envelope));
      const verified = this.read(slot);
      if (!verified || verified.revision !== revision || verified.checksum !== envelope.checksum) return false;
      this.active = slot; this.revision = revision; return true;
    } catch { return false; }
  }
}
export function collectionCandidate(record: PlayerRecord, session: PlaySession): PlayerRecord {
  if (session.phase !== 'ready-to-reveal' && session.phase !== 'collected') throw new Error('作品尚未完成');
  const copy = JSON.parse(JSON.stringify(record)) as PlayerRecord;
  copy.session = { ...session.serialize(), phase: 'collected' };
  if (!copy.completed.includes(session.level.id)) copy.completed.push(session.level.id);
  if (!copy.collected.includes(session.level.id)) copy.collected.push(session.level.id);
  return copy;
}
