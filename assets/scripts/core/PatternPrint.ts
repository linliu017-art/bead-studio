import type { LevelDefinition } from './Level';

/** Mini-bead default; callers may choose the pitch of their own board. */
export const BEAD_PITCH_MM = 2.6;

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]!));
}

/** Create a 1:1 SVG template: one square is one physical bead position. */
export function patternSvg(level: LevelDefinition, pitchMm = BEAD_PITCH_MM): string {
  if (!Number.isFinite(pitchMm) || pitchMm < 1 || pitchMm > 10) throw new Error('请选择 1–10mm 之间的拼板孔距');
  const width = level.width * pitchMm;
  const height = level.height * pitchMm;
  const palette = new Map(level.palette.map(color => [color.id, color.hex]));
  const circles: string[] = [];
  for (let row = 0; row < level.height; row++) for (let col = 0; col < level.width; col++) {
    const id = level.cells[row * level.width + col];
    if (!id) continue;
    const cx = (col + .5) * pitchMm;
    const cy = (row + .5) * pitchMm;
    circles.push(`<circle cx="${cx}" cy="${cy}" r="${pitchMm * .39}" fill="${palette.get(id) ?? '#FFFFFF'}" stroke="#6D5B50" stroke-width="0.08"/>`);
  }
  const grid = `<path d="${Array.from({ length: level.width + 1 }, (_, col) => `M${col * pitchMm} 0V${height}`).join(' ')} ${Array.from({ length: level.height + 1 }, (_, row) => `M0 ${row * pitchMm}H${width}`).join(' ')}" fill="none" stroke="#BBA99B" stroke-width="0.06"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}" shape-rendering="geometricPrecision"><title>${escapeXml(level.title)}</title><rect width="${width}" height="${height}" fill="#FFFDF8"/>${grid}${circles.join('')}</svg>`;
}

/** Browser-ready A4 print sheet. The SVG retains millimetre dimensions. */
export function patternPrintDocument(level: LevelDefinition, pitchMm = BEAD_PITCH_MM): string {
  const svg = patternSvg(level, pitchMm);
  const counts = new Map<number, number>();
  for (const id of level.cells) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  const rows = level.palette.filter(c => counts.has(c.id)).map(c => `<span><i style="background:${escapeXml(c.hex)}"></i>${escapeXml(c.code)} · ${escapeXml(c.name)} · ${counts.get(c.id)} 颗</span>`).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeXml(level.title)} · 拼豆图纸</title><style>
    @page { size:A4; margin:12mm; }
    * { box-sizing:border-box; }
    body { font:12px system-ui,sans-serif; color:#493e38; margin:12mm; }
    h1 { font-size:20px; margin:0 0 8px; } p { line-height:1.7; }
    button { padding:12px 24px; border:0; border-radius:0; box-shadow:4px 4px #172665; background:#ff713c; color:white; cursor:pointer; }
    .pattern { margin:8mm 0; break-inside:avoid; } svg { display:block; max-width:none; }
    .ruler { width:50mm; height:4mm; border:solid #222; border-width:0 1px 1px; }
    .palette { display:flex; flex-wrap:wrap; gap:10px 20px; margin-top:8mm; }
    .palette span { white-space:nowrap; } i { display:inline-block; width:12px; height:12px; border:1px solid #888; margin-right:5px; vertical-align:middle; }
    @media print { body { margin:0; } .controls { display:none; } * { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
    </style></head><body><div class="controls"><button onclick="window.print()">打印图纸 / 保存为 PDF</button><p>纸张选 A4，缩放选 100% / 实际大小，关闭页眉页脚。请勿选择“适合页面”。</p></div>
    <h1>${escapeXml(level.title)}</h1><p>拼拼豆豆儿 · ${level.width}×${level.height} 格 · 孔距 ${pitchMm}mm · 图纸 ${(level.width*pitchMm).toFixed(1)} × ${(level.height*pitchMm).toFixed(1)}mm<br>一格一颗豆，空格不放豆。先量下方校准尺：两端应为 50mm，再与拼板孔位核对。</p>
    <div class="ruler"></div><p>50mm 实物校准尺 · 请使用 100% 原尺寸打印</p><div class="pattern">${svg}</div><div class="palette">${rows}</div><p>共 ${level.cells.filter(Boolean).length} 颗 · ${counts.size} 色。颜色编号为本图纸编号，实物请对照色卡。</p></body></html>`;
}
