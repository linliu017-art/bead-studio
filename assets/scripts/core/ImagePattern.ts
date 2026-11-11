import { LevelDefinition, validateLevel } from './Level';

export interface ImagePixels {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

export interface PatternOptions {
  cropToSubject: boolean;
  removeWhiteBackground: boolean;
}

export const defaultPatternOptions: PatternOptions = { cropToSubject: true, removeWhiteBackground: true };
const maxBoardSide = 48;
const maxColors = 14;
const minColorDistance = 8 * 19 ** 2;
type RGB = readonly [number, number, number];

interface ColorBucket {
  count: number;
  red: number;
  green: number;
  blue: number;
}

function addColor(buckets: Map<number, ColorBucket>, r: number, g: number, b: number): ColorBucket {
  const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { count: 0, red: 0, green: 0, blue: 0 };
    buckets.set(key, bucket);
  }
  bucket.count++;
  bucket.red += r;
  bucket.green += g;
  bucket.blue += b;
  return bucket;
}

function averageColor({ red, green, blue, count }: ColorBucket): RGB {
  return [Math.round(red / count), Math.round(green / count), Math.round(blue / count)];
}

function colorDistance([r, g, b]: RGB, [cr, cg, cb]: RGB): number {
  return 2 * (r - cr) ** 2 + 4 * (g - cg) ** 2 + 2 * (b - cb) ** 2;
}

function brightness([r, g, b]: RGB): number {
  return 2 * r + 4 * g + b;
}

function imagePalette(samples: readonly (RGB | null)[]): RGB[] {
  const buckets = new Map<number, ColorBucket>();
  for (const sample of samples) if (sample) addColor(buckets, ...sample);
  const candidates = Array.from(buckets.values(), bucket => ({
    rgb: averageColor(bucket), count: bucket.count, distance: Infinity,
  })).sort((a, b) => b.count - a.count);
  if (!candidates.length) return [];
  const palette = [candidates[0].rgb];
  while (palette.length < maxColors) {
    const last = palette[palette.length - 1];
    let best: RGB | undefined, score = 0;
    for (const candidate of candidates) {
      candidate.distance = Math.min(candidate.distance, colorDistance(candidate.rgb, last));
      if (candidate.distance < minColorDistance) continue;
      // Favor distinct colors with area, while keeping small, high-contrast accents.
      const next = candidate.distance * Math.log2(1 + candidate.count);
      if (next > score) { score = next; best = candidate.rgb; }
    }
    if (!best) break;
    palette.push(best);
  }
  return palette.sort((a, b) => brightness(a) - brightness(b));
}

/** Only erase white regions reached from the outside. Enclosed light regions stay as beads. */
function backgroundMask({ width, height, data }: ImagePixels, removeWhite: boolean): Uint8Array {
  const size = width * height;
  const mask = new Uint8Array(size);
  if (removeWhite) {
    const queue = new Int32Array(size);
    let end = 0;
    const visit = (index: number): void => {
      if (mask[index]) return;
      const offset = index * 4;
      const low = Math.min(data[offset], data[offset + 1], data[offset + 2]);
      const high = Math.max(data[offset], data[offset + 1], data[offset + 2]);
      if (data[offset + 3] >= 40 && (low < 224 || high - low > 27)) return;
      mask[index] = 1;
      queue[end++] = index;
    };
    for (let x = 0; x < width; x++) {
      visit(x);
      visit((height - 1) * width + x);
    }
    for (let y = 0; y < height; y++) {
      visit(y * width);
      visit(y * width + width - 1);
    }
    for (let cursor = 0; cursor < end; cursor++) {
      const index = queue[cursor], x = index % width;
      if (x > 0) visit(index - 1);
      if (x + 1 < width) visit(index + 1);
      if (index >= width) visit(index - width);
      if (index + width < size) visit(index + width);
    }
  }
  for (let index = 0; index < size; index++) {
    if (data[index * 4 + 3] < 40) mask[index] = 1;
  }
  return mask;
}

function nearestColor(sample: RGB, palette: readonly RGB[]): number {
  let distance = Infinity, best = 1;
  for (let index = 0; index < palette.length; index++) {
    const next = colorDistance(sample, palette[index]);
    if (next < distance) { distance = next; best = index + 1; }
  }
  return best;
}

export function imageToLevel(
  image: ImagePixels, id: string, title: string, options: PatternOptions = defaultPatternOptions,
): LevelDefinition {
  const { width, height, data } = image;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width > 512 || height > 512 || data.length !== width * height * 4) {
    throw new Error('无法读取图片像素，请换一张图');
  }
  const mask = backgroundMask(image, options.removeWhiteBackground);
  let left = width, top = height, right = -1, bottom = -1;
  for (let index = 0; index < mask.length; index++) {
    if (mask[index]) continue;
    const x = index % width, y = Math.floor(index / width);
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < left) throw new Error('没有找到可拼的图案，试试保留背景');
  if (!options.cropToSubject) { left = 0; top = 0; right = width - 1; bottom = height - 1; }

  const spanX = right - left + 1, spanY = bottom - top + 1;
  const ratio = maxBoardSide / Math.max(spanX, spanY);
  const cols = Math.max(1, Math.round(spanX * ratio));
  const rows = Math.max(1, Math.round(spanY * ratio));
  const samples: (RGB | null)[] = [];
  for (let row = 0; row < rows; row++) {
    const y0 = top + Math.floor(row * spanY / rows);
    const y1 = top + Math.ceil((row + 1) * spanY / rows);
    for (let col = 0; col < cols; col++) {
      const x0 = left + Math.floor(col * spanX / cols);
      const x1 = left + Math.ceil((col + 1) * spanX / cols);
      let occupied = 0, dark = 0;
      let stroke: ColorBucket | undefined, fill: ColorBucket | undefined;
      const strokeBuckets = new Map<number, ColorBucket>();
      const fillBuckets = new Map<number, ColorBucket>();
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const index = y * width + x;
          if (mask[index]) continue;
          occupied++;
          const offset = index * 4;
          const r = data[offset], g = data[offset + 1], b = data[offset + 2];
          const high = Math.max(r, g, b);
          if (high < 82 && high - Math.min(r, g, b) < 32) {
            dark++;
            const bucket = addColor(strokeBuckets, r, g, b);
            if (!stroke || bucket.count > stroke.count) stroke = bucket;
          } else {
            const bucket = addColor(fillBuckets, r, g, b);
            if (!fill || bucket.count > fill.count) fill = bucket;
          }
        }
      }
      const area = (y1 - y0) * (x1 - x0);
      // Preserve thin outlines. For fill, use the strongest group of neighboring RGB values.
      const color = dark / area >= .22 ? stroke : occupied / area >= .30 ? fill ?? stroke : undefined;
      samples.push(color ? averageColor(color) : null);
    }
  }
  const sourceColors = imagePalette(samples);
  if (!sourceColors.length) throw new Error('没有找到可拼的图案，请调整构图或换一张图');
  const cells = samples.map(sample => sample ? nearestColor(sample, sourceColors) : 0);
  const used = new Set(cells.filter(Boolean));
  const palette = sourceColors.map((rgb, index) => {
    const id = index + 1;
    const code = String(id).padStart(2, '0');
    const hex = '#' + rgb.map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase();
    return { id, code, name: `色号 ${code}`, hex };
  }).filter(color => used.has(color.id));
  return validateLevel({
    schemaVersion: 1, id, revision: 1, order: 1, title, themeId: 'personal',
    width: cols, height: rows, palette, cells,
  });
}
