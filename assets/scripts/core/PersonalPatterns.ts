import { LevelDefinition, validateLevel } from './Level';
import { SaveRepository, StoragePort } from './SaveRepository';

const catalogKey = 'bead-studio-personal-patterns-v1';

export class PersonalPatterns {
  constructor(private readonly storage: StoragePort) {}

  list(): LevelDefinition[] {
    const raw = this.storage.get(catalogKey);
    if (raw === null) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('个人图纸目录无法读取');
    const entries = data.map(validateLevel);
    if (entries.some(level => level.themeId !== 'personal') ||
        new Set(entries.map(level => level.id)).size !== entries.length) throw new Error('个人图纸目录无法读取');
    return entries;
  }

  save(level: LevelDefinition): void {
    const next = validateLevel(level);
    if (next.themeId !== 'personal') throw new Error('个人图纸类型无效');
    const entries = this.list();
    const previous = entries.find(item => item.id === next.id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(next)) throw new Error('这张图纸已存在，请新建一份');
      return;
    }
    const snapshot = JSON.stringify([next, ...entries]);
    this.storage.set(catalogKey, snapshot);
    if (this.storage.get(catalogKey) !== snapshot) throw new Error('图纸没有保存成功');
  }

  session(level: LevelDefinition): SaveRepository {
    return new SaveRepository(this.storage, level, personalStoragePrefix(level));
  }
}

export function personalStoragePrefix(level: LevelDefinition): string {
  return `bead-studio-personal-v1-${level.id}-r${level.revision}`;
}
