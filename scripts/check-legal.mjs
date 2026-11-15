// Vypíše, které údaje provozovatele v lib/company.ts ještě chybí. Před zveřejněním musí být vše vyplněno.
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../lib/company.ts', import.meta.url), 'utf8');
const block = src.slice(src.indexOf('export const PROVIDER'), src.indexOf('};', src.indexOf('export const PROVIDER')));
const optional = new Set(['phone']);
const missing = [...block.matchAll(/^\s{4}(\w+):\s*'(.*?)',/gm)].filter(([, key, value]) => value.trim() === '' && !optional.has(key)).map(([, key]) => key);

if (missing.length) {
    console.error(`Chybí ${missing.length} údajů v lib/company.ts: ${missing.join(', ')}`);
    process.exit(1);
}
console.log('Údaje provozovatele jsou vyplněné.');
