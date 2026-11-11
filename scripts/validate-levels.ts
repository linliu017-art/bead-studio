import { readFileSync, readdirSync } from 'node:fs';
import { validateLevel, validateCatalog } from '../assets/scripts/core/Level';
import { checkPatternDetails } from './check-pattern-details';

const args = process.argv.slice(2);
if (args.length) {
  if (args.length !== 3 || args[0] !== '--draft') {
    throw new Error('用法：pnpm validate:levels --draft <关卡.json> <细节标注.json>');
  }
  const level = validateLevel(JSON.parse(readFileSync(args[1], 'utf8')));
  const errors = checkPatternDetails(level, JSON.parse(readFileSync(args[2], 'utf8')));
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
  console.log(`${level.id}: ${level.width}×${level.height}, ${level.cells.filter(Boolean).length} beads, ${level.palette.length} colors — valid`);
  console.log('图纸细节检查通过');
  process.exit(0);
}

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
