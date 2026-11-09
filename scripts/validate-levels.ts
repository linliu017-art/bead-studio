import { readFileSync, readdirSync } from 'node:fs';
import { validateLevel, validateCatalog } from '../assets/scripts/core/Level';
function readLevels(directory: string) {
  return readdirSync(directory).filter(file => file.endsWith('.json'))
    .map(file => validateLevel(JSON.parse(readFileSync(`${directory}/${file}`, 'utf8'))))
    .sort((a, b) => a.order - b.order);
}
const levels = readLevels('assets/resources/levels');
validateCatalog(levels);
const samples = readLevels('assets/resources/samples');
for (const sample of samples) {
  if (sample.palette.some(color => !sample.cells.includes(color.id))) {
    throw new Error(`${sample.id}: sample palette contains an unused color`);
  }
}
for (const level of [...levels, ...samples]) {
  console.log(`${level.id}: ${level.width}×${level.height}, ${level.cells.filter(Boolean).length} beads, ${level.palette.length} colors — valid`);
}
