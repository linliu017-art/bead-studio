import type { LevelDefinition } from '../assets/scripts/core/Level';

type Point = [number, number];
type Part = { label: string; anchors: Point[]; minCells?: number; maxCells?: number; edgeConnected?: boolean };
type Detail = {
  label: string;
  bounds: [number, number, number, number];
  colors: string[];
  parts: Part[];
  enclosedColors?: string[];
  gaps?: [number, number, string?][];
};

export function checkPatternDetails(level: LevelDefinition, value: unknown): string[] {
  const review = value as { levelId?: string; details?: Detail[] } | null;
  if (review?.levelId !== level.id || !Array.isArray(review.details) || !review.details.length) {
    throw new Error('细节标注必须对应当前关卡，并包含至少一个检查区域');
  }
  const palette = new Map(level.palette.map(color => [color.code, color.id]));
  const errors: string[] = [];
  for (const detail of review.details) {
    if (!detail?.label || !Array.isArray(detail.bounds) || detail.bounds.length !== 4 ||
        !detail.bounds.every(Number.isInteger)) throw new Error('细节区域缺少名称或坐标');
    const [left, top, width, height] = detail.bounds;
    const label = detail.label;
    if (left < 0 || top < 0 || width < 1 || height < 1 ||
        left + width > level.width || top + height > level.height) {
      throw new Error(`${label}：检查区域超出底板`);
    }
    const colorId = (code: string): number => {
      const id = palette.get(code);
      if (id === undefined) throw new Error(`${label}：未知色号 ${code}`);
      return id;
    };
    if (!Array.isArray(detail.colors) || !detail.colors.length ||
        !Array.isArray(detail.parts) || !detail.parts.length) {
      throw new Error(`${label}：需要指定检查色号和部件`);
    }
    if (detail.enclosedColors !== undefined && !Array.isArray(detail.enclosedColors) ||
        detail.gaps !== undefined && (!Array.isArray(detail.gaps) ||
          !detail.gaps.every(point => Array.isArray(point) && (point.length === 2 || point.length === 3)))) {
      throw new Error(`${label}：封闭填色或留白标注无效`);
    }
    const colors = new Set(detail.colors.map(colorId));
    const size = width * height;
    const cells = Array.from({ length: size }, (_, index) =>
      level.cells[(top + Math.floor(index / width)) * level.width + left + index % width],
    );
    const components = new Int32Array(size).fill(-1);
    const sizes: number[] = [];
    for (let index = 0; index < size; index++) {
      if (components[index] !== -1 || !colors.has(cells[index])) continue;
      const component = sizes.length;
      const found = flood([index], width, height, true, next => colors.has(cells[next]));
      sizes.push(found.size);
      for (const next of found) components[next] = component;
    }

    const localIndex = (x: number, y: number): number => {
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < left || y < top ||
          x >= left + width || y >= top + height) throw new Error(`${label}：标记 (${x}, ${y}) 超出检查区域`);
      return (y - top) * width + x - left;
    };
    const names = new Map<number, string>();
    for (const part of detail.parts) {
      if (!part?.label || !Array.isArray(part.anchors) || !part.anchors.length ||
          !part.anchors.every(point => Array.isArray(point) && point.length === 2) ||
          (part.edgeConnected !== undefined && typeof part.edgeConnected !== 'boolean') ||
          [part.minCells, part.maxCells].some(limit => limit !== undefined && (!Number.isInteger(limit) || limit < 1)) ||
          (part.minCells ?? 1) > (part.maxCells ?? size)) throw new Error(`${label}：部件标注无效`);
      const anchors = part.anchors.map(([x, y]) => localIndex(x, y));
      const ids = anchors.map(index => components[index]);
      const component = ids[0];
      if (component < 0 || ids.some(id => id !== component)) {
        errors.push(`${label}：${part.label}有缺格或断开`);
        continue;
      }
      const previous = names.get(component);
      if (previous) errors.push(`${label}：${previous}和${part.label}粘连`);
      names.set(component, part.label);
      if (sizes[component] < (part.minCells ?? 1) || sizes[component] > (part.maxCells ?? size)) {
        errors.push(`${label}：${part.label}的格数超出标注范围`);
      }
      if (part.edgeConnected &&
          flood([anchors[0]], width, height, false, index => components[index] === component).size !== sizes[component]) {
        errors.push(`${label}：${part.label}有只靠角相接的断点`);
      }
    }
    if (sizes.some((_, component) => !names.has(component))) errors.push(`${label}：存在未标注的散格`);
    for (const [x, y, code] of detail.gaps ?? []) {
      if (cells[localIndex(x, y)] !== (code === undefined ? 0 : colorId(code))) {
        errors.push(`${label}：(${x}, ${y}) 的留白被占用`);
      }
    }
    if (detail.enclosedColors?.length) {
      const fill = new Set(detail.enclosedColors.map(colorId));
      const edge = cells.flatMap((_, index) => {
        const x = index % width;
        const y = Math.floor(index / width);
        return x === 0 || x === width - 1 || y === 0 || y === height - 1 ? [index] : [];
      });
      const outside = flood(edge, width, height, false, index => !colors.has(cells[index]));
      const interior = cells.flatMap((id, index) => fill.has(id) ? [index] : []);
      if (!interior.length || interior.some(index => outside.has(index))) {
        errors.push(`${label}：轮廓没有围住填色`);
      }
    }
  }
  return errors;
}

function flood(
  seeds: number[], width: number, height: number, diagonals: boolean,
  accepts: (index: number) => boolean,
): Set<number> {
  const queue = seeds.filter(accepts);
  const visited = new Set(queue);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const x = queue[cursor] % width;
    const y = Math.floor(queue[cursor] / width);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((!diagonals && dx && dy) || x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
        const next = (y + dy) * width + x + dx;
        if (visited.has(next) || !accepts(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}
