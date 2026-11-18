// Zkopíruje rozpoznávání textu (OCR) do public/ocr, aby se nic nenačítalo z cizích domén: jádro tesseract.js, pracovní vlákno a česká jazyková data.
// Spouští se před dev a build (soubory jsou velké, do repozitáře nepatří).
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'public', 'ocr');
const need = [
    ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
    ['node_modules/@tesseract.js-data/ces/4.0.0_best_int/ces.traineddata.gz', 'lang/ces.traineddata.gz'],
];
mkdirSync(join(out, 'core'), { recursive: true }); mkdirSync(join(out, 'lang'), { recursive: true });
for (const [from, to] of need) {
    if (!existsSync(join(root, from))) { console.warn(`OCR: chybí ${from}, rozpoznávání textu ve skenech nebude fungovat (spusťte npm install).`); continue; }
    cpSync(join(root, from), join(out, to));
}
const coreDir = join(root, 'node_modules/tesseract.js-core');
if (existsSync(coreDir)) for (const f of readdirSync(coreDir)) if (/-lstm\.(js|wasm|wasm\.js)$/.test(f)) cpSync(join(coreDir, f), join(out, 'core', f));
console.log('OCR: soubory zkopírovány do public/ocr');
