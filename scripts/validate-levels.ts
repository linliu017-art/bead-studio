import { readFileSync, readdirSync } from 'node:fs';
import { validateLevel, validateCatalog } from '../assets/scripts/core/Level';
const directory = 'assets/resources/levels';
const levels = readdirSync(directory).filter(f=>f.endsWith('.json')).map(file=>validateLevel(JSON.parse(readFileSync(`${directory}/${file}`,'utf8')))).sort((a,b)=>a.order-b.order);
validateCatalog(levels);
for (const level of levels) console.log(`${level.id}: ${level.width}×${level.height}, ${level.cells.filter(Boolean).length} beads, ${level.palette.length} colors — valid`);
