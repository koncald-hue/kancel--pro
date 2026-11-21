import JSZip from 'jszip';
import { isValidIco, cleanIco } from './ares';
import { parseCsv, parseAmount, parseDateCell } from './bank';

// Import dat z jiných programů a z Excelu: načtení tabulky (CSV, TSV, XLSX, vCard), chytré přiřazení sloupců a propojení záznamů.
export type Table = { headers: string[]; rows: string[][] };
export type Sheet = { name: string; table: Table };
export type Entity = 'klienti' | 'veci' | 'lhuty' | 'kontakty' | 'cas';

export const ENTITY_LABEL: Record<Entity, string> = { klienti: 'Klienti', veci: 'Věci (spisy)', lhuty: 'Lhůty a termíny', kontakty: 'Kontakty ve věcech (soud, protistrana)', cas: 'Odpracovaný čas' };

// ---------- načtení souboru ----------
export function decodeText(bytes: Uint8Array): string {
    // Excel v češtině ukládá CSV často v kódování Windows-1250; ověříme, zda je text platné UTF-8
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return new TextDecoder('windows-1250').decode(bytes); }
}

const colIndex = (ref: string) => { let n = 0; for (const ch of ref.replace(/[^A-Z]/gi, '').toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
const textOf = (el: Element | null | undefined) => Array.from(el?.getElementsByTagName('t') ?? []).map((t) => t.textContent ?? '').join('');

export async function parseXlsx(bytes: Uint8Array): Promise<Sheet[]> {
    const zip = await JSZip.loadAsync(bytes);
    const xml = async (path: string) => { const f = zip.file(path); return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null; };
    const shared = Array.from((await xml('xl/sharedStrings.xml'))?.getElementsByTagName('si') ?? []).map((si) => textOf(si));
    const wb = await xml('xl/workbook.xml'); const rels = await xml('xl/_rels/workbook.xml.rels');
    const relTarget = new Map(Array.from(rels?.getElementsByTagName('Relationship') ?? []).map((r) => [r.getAttribute('Id') ?? '', r.getAttribute('Target') ?? '']));
    const out: Sheet[] = [];
    for (const s of Array.from(wb?.getElementsByTagName('sheet') ?? [])) {
        const rid = s.getAttribute('r:id') ?? s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? '';
        const target = relTarget.get(rid); if (!target) continue;
        const doc = await xml(target.startsWith('/') ? target.slice(1) : `xl/${target}`); if (!doc) continue;
        const rows: string[][] = [];
        for (const r of Array.from(doc.getElementsByTagName('row'))) {
            const cells: string[] = [];
            for (const c of Array.from(r.getElementsByTagName('c'))) {
                const i = colIndex(c.getAttribute('r') ?? ''); const t = c.getAttribute('t');
                const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
                cells[i] = t === 's' ? (shared[Number(v)] ?? '') : t === 'inlineStr' ? textOf(c) : v;
            }
            if (cells.some((x) => x && x.trim())) rows.push(Array.from(cells, (x) => x ?? ''));
        }
        if (rows.length > 1) out.push({ name: s.getAttribute('name') ?? `List ${out.length + 1}`, table: toTable(rows) });
    }
    return out;
}

export function parseVcf(text: string): Table {
    const cards = text.replace(/\r\n[ \t]/g, '').split(/BEGIN:VCARD/i).slice(1);
    const headers = ['Jméno', 'Firma', 'E-mail', 'Telefon', 'Adresa', 'Datum narození', 'Poznámka'];
    const rows = cards.map((c) => {
        const get = (re: RegExp) => (c.match(re)?.[1] ?? '').trim().replace(/\\n/gi, ' ').replace(/\\,/g, ',');
        const adr = (c.match(/^ADR[^:\n]*:(.*)$/im)?.[1] ?? '').split(';').map((x) => x.trim()).filter(Boolean);
        const n = (c.match(/^N[^:\n]*:(.*)$/im)?.[1] ?? '').split(';');
        const fn = get(/^FN[^:\n]*:(.*)$/im) || [n[3], n[1], n[0]].filter(Boolean).join(' ');
        return [fn, get(/^ORG[^:\n]*:([^;\n]*)/im), get(/^EMAIL[^:\n]*:(.*)$/im), get(/^TEL[^:\n]*:(.*)$/im), adr.join(', '), get(/^BDAY[^:\n]*:(.*)$/im).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'), get(/^NOTE[^:\n]*:(.*)$/im)];
    });
    return { headers, rows };
}

function toTable(rows: string[][]): Table {
    const width = Math.max(...rows.map((r) => r.length));
    const pad = rows.map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? '').toString().trim()));
    // Hlavička je první neprázdný řádek
    return { headers: pad[0].map((h, i) => h || `Sloupec ${i + 1}`), rows: pad.slice(1) };
}

export async function readFile(bytes: Uint8Array, filename = ''): Promise<Sheet[]> {
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) return parseXlsx(bytes);
    const text = decodeText(bytes);
    if (/^\s*BEGIN:VCARD/i.test(text) || /\.vcf$/i.test(filename)) return [{ name: 'Kontakty', table: parseVcf(text) }];
    const rows = parseCsv(text);
    return rows.length > 1 ? [{ name: filename || 'Soubor', table: toTable(rows) }] : [];
}

// ---------- pole a přiřazení sloupců ----------
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export type FieldDef = { key: string; label: string; required?: boolean; synonyms: string[] };
export const FIELDS: Record<Entity, FieldDef[]> = {
    klienti: [
        { key: 'name', label: 'Jméno / název klienta', required: true, synonyms: ['jmeno klienta', 'nazev', 'nazev klienta', 'klient', 'cele jmeno', 'jmeno a prijmeni', 'jmeno prijmeni', 'name', 'full name', 'display name', 'subjekt', 'zakaznik', 'jmeno nazev', 'nazev jmeno', 'jmeno nazev klienta'] },
        { key: 'first', label: 'Jméno (křestní)', synonyms: ['jmeno', 'krestni jmeno', 'first name', 'given name'] },
        { key: 'last', label: 'Příjmení', synonyms: ['prijmeni', 'last name', 'family name', 'surname'] },
        { key: 'company', label: 'Firma', synonyms: ['firma', 'organizace', 'spolecnost', 'company', 'organization', 'obchodni firma'] },
        { key: 'email', label: 'E-mail', synonyms: ['email', 'e mail', 'mail', 'e mail adresa', 'email adresa', 'e mail 1 value', 'email 1 value'] },
        { key: 'phone', label: 'Telefon', synonyms: ['telefon', 'tel', 'mobil', 'telefon mobil', 'mobilni telefon', 'phone', 'phone 1 value', 'gsm', 'mobile'] },
        { key: 'address', label: 'Adresa (celá)', synonyms: ['adresa', 'sidlo', 'address', 'trvale bydliste', 'adresa sidla', 'bydliste'] },
        { key: 'street', label: 'Ulice a číslo', synonyms: ['ulice', 'ulice a cislo', 'street', 'ulice cp'] },
        { key: 'city', label: 'Město', synonyms: ['mesto', 'obec', 'city'] },
        { key: 'zip', label: 'PSČ', synonyms: ['psc', 'zip', 'postal code', 'zip code'] },
        { key: 'ico', label: 'IČO', synonyms: ['ico', 'ic', 'identifikacni cislo', 'company id', 'ic o'] },
        { key: 'dic', label: 'DIČ', synonyms: ['dic', 'vat', 'vat id', 'dic cz'] },
        { key: 'birth', label: 'Datum narození', synonyms: ['datum narozeni', 'narozen', 'narozeni', 'birthday', 'birth date', 'bday', 'datum nar'] },
        { key: 'rate', label: 'Hodinová sazba', synonyms: ['hodinova sazba', 'sazba', 'rate', 'sazba kc hod'] },
        { key: 'note', label: 'Poznámka', synonyms: ['poznamka', 'pozn', 'note', 'notes', 'komentar', 'poznamky'] },
    ],
    veci: [
        { key: 'title', label: 'Název věci', required: true, synonyms: ['nazev', 'nazev veci', 'vec', 'predmet', 'title', 'case', 'spis', 'nazev spisu', 'predmet sporu', 'kauza'] },
        { key: 'reference', label: 'Spisová značka / č. j.', synonyms: ['spisova znacka', 'sp zn', 'spzn', 'cislo jednaci', 'c j', 'cj', 'znacka', 'reference', 'cislo spisu', 'cislo veci'] },
        { key: 'authority', label: 'Soud nebo úřad', synonyms: ['soud', 'urad', 'soud urad', 'instituce', 'authority', 'court', 'organ', 'soud organ'] },
        { key: 'client', label: 'Klient', synonyms: ['klient', 'jmeno klienta', 'zakaznik', 'client', 'strana', 'klient jmeno', 'dotcena osoba'] },
        { key: 'clientEmail', label: 'E-mail klienta', synonyms: ['email klienta', 'e mail klienta', 'client email'] },
        { key: 'clientPhone', label: 'Telefon klienta', synonyms: ['telefon klienta', 'tel klienta', 'client phone'] },
        { key: 'description', label: 'Popis věci', synonyms: ['popis', 'popis veci', 'situation', 'obsah', 'description'] },
        { key: 'status', label: 'Stav', synonyms: ['stav', 'status', 'stav veci'] },
        { key: 'note', label: 'Poznámka', synonyms: ['poznamka', 'pozn', 'note', 'notes', 'komentar'] },
    ],
    lhuty: [
        { key: 'case', label: 'Věc (značka nebo název)', required: true, synonyms: ['vec', 'spis', 'spisova znacka', 'sp zn', 'cislo jednaci', 'case', 'nazev veci', 'znacka'] },
        { key: 'title', label: 'Název lhůty / úkonu', required: true, synonyms: ['nazev', 'lhuta', 'nazev lhuty', 'ukon', 'nazev ukonu', 'ukol', 'nazev ukolu', 'popis', 'title', 'co', 'predmet', 'task', 'subject'] },
        { key: 'date', label: 'Datum', required: true, synonyms: ['datum', 'termin', 'konec lhuty', 'do', 'due date', 'date', 'splatnost', 'datum lhuty', 'koncove datum'] },
        { key: 'done', label: 'Splněno', synonyms: ['splneno', 'hotovo', 'done', 'vyrizeno', 'dokonceno'] },
    ],
    kontakty: [
        { key: 'case', label: 'Věc (značka nebo název)', required: true, synonyms: ['vec', 'spis', 'spisova znacka', 'sp zn', 'cislo jednaci', 'case', 'nazev veci', 'znacka'] },
        { key: 'name', label: 'Jméno / název', required: true, synonyms: ['jmeno', 'nazev', 'name', 'kontakt', 'osoba', 'cele jmeno', 'jmeno nazev', 'subjekt', 'ucastnik'] },
        { key: 'role', label: 'Role (soud, protistrana…)', synonyms: ['role', 'typ', 'vztah', 'funkce', 'postaveni', 'kategorie'] },
        { key: 'email', label: 'E-mail', synonyms: ['email', 'e mail', 'mail'] },
        { key: 'phone', label: 'Telefon', synonyms: ['telefon', 'tel', 'mobil', 'phone'] },
        { key: 'note', label: 'Poznámka', synonyms: ['poznamka', 'pozn', 'note', 'komentar'] },
    ],
    cas: [
        { key: 'case', label: 'Věc (značka nebo název)', synonyms: ['vec', 'spis', 'spisova znacka', 'sp zn', 'cislo jednaci', 'case', 'nazev veci', 'znacka', 'projekt'] },
        { key: 'date', label: 'Datum', required: true, synonyms: ['datum', 'date', 'den', 'datum ukonu'] },
        { key: 'hours', label: 'Čas v hodinách (1,5)', required: false, synonyms: ['hodiny', 'hodin', 'hours', 'cas hodiny', 'pocet hodin', 'h'] },
        { key: 'minutes', label: 'Čas v minutách', synonyms: ['minuty', 'minut', 'minutes', 'cas minuty', 'min'] },
        { key: 'duration', label: 'Čas (1:30)', synonyms: ['cas', 'doba', 'delka', 'duration', 'trvani', 'odpracovano', 'cas hh mm'] },
        { key: 'description', label: 'Popis činnosti', synonyms: ['popis', 'popis cinnosti', 'popis prace', 'ukon', 'cinnost', 'description', 'poznamka', 'text', 'nazev ukonu', 'narrative', 'activity'] },
        { key: 'rate', label: 'Sazba (Kč/hod)', synonyms: ['sazba', 'hodinova sazba', 'rate', 'kc hod'] },
        { key: 'billed', label: 'Vyfakturováno', synonyms: ['vyfakturovano', 'fakturovano', 'billed', 'uctovano', 'faktura'] },
    ],
};

export type Mapping = (string | '')[];

// ---------- chytré přiřazení sloupců ----------
// Každý sloupec se porovná s každým polem: podle celých slov názvu (i ve skloňování: „lhůty“ = „lhůta“), podle popisku pole
// a když název nic neřekne, i podle obsahu buněk (e-mail, telefon, IČO, spisová značka, datum, ano/ne).
// Pak se páry přiřadí od nejjistějšího, takže jedno pole nikdy nedostanou dva sloupce.
const STOP = new Set(['a', 'nebo', 'or', 'and', 'the', 'of', 'na', 'v', 've', 'k', 'ke', 's', 'se', 'z', 'ze', 'pro', 'u', 'do']);
const tokens = (s: string) => fold(s).split(' ').filter((t) => t && !STOP.has(t));
function tokEq(a: string, b: string) {
    if (a === b) return true;
    if (a.length < 4 || b.length < 4) return false;
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i >= 4 && i >= Math.min(a.length, b.length) - 1;
}
function phraseScore(header: string[], phrase: string[]): number {
    if (!header.length || !phrase.length) return 0;
    if (header.length === phrase.length && header.every((t, i) => t === phrase[i])) return 100;
    const inHeader = phrase.filter((p) => header.some((h) => tokEq(h, p))).length;
    const inPhrase = header.filter((h) => phrase.some((p) => tokEq(h, p))).length;
    if (inHeader === phrase.length && inPhrase === header.length) return 92;
    if (inHeader === phrase.length) return 60 + Math.round(30 * phrase.length / header.length);
    if (inPhrase === header.length) return 50 + Math.round(30 * header.length / phrase.length);
    return 0;
}

const RE = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^(\+|00)?[\d\s/-]{9,17}$/,
    ico: /^\d{8}$/,
    dic: /^[A-Z]{2}\d{8,10}$/i,
    ref: /^\d+\s*[A-Za-z]{1,4}\s*\d+\s*\/\s*\d{2,4}$|^[A-ZÁ-Ž]{1,4}[\s-]*\d+\s*\/\s*\d{4}$/,
    date: /^(\d{1,2}\s*[./]\s*\d{1,2}\s*[./]\s*\d{2,4}|\d{4}-\d{2}-\d{2})/,
    bool: /^(ano|ne|a|n|x|1|0|true|false|yes|no|splneno|nesplneno|hotovo)$/i,
    hours: /^\d{1,2}([,.]\d{1,2})?$/,
};
// Co obsah sloupce prozrazuje: [klíč pole, skóre] pro dané pole
function contentHints(entity: Entity, values: string[]): Record<string, number> {
    const v = values.map((x) => x.trim()).filter(Boolean).slice(0, 30); if (!v.length) return {};
    const share = (re: RegExp) => v.filter((x) => re.test(x)).length / v.length;
    const out: Record<string, number> = {};
    const put = (key: string, score: number) => { if (FIELDS[entity].some((f) => f.key === key)) out[key] = Math.max(out[key] ?? 0, score); };
    if (share(RE.email) >= 0.6) { put('email', 70); put('clientEmail', 70); }
    else if (share(RE.dic) >= 0.6) put('dic', 70);
    else if (share(RE.ref) >= 0.6) { put('reference', 68); put('case', 68); }
    else if (share(RE.ico) >= 0.6) put('ico', 64);
    else if (share(RE.date) >= 0.6) { put('date', 64); put('birth', 62); }
    else if (share(RE.phone) >= 0.6) { put('phone', 64); put('clientPhone', 64); }
    else if (share(RE.bool) >= 0.8) { put('done', 62); put('billed', 62); }
    else if (share(RE.hours) >= 0.8) put('hours', 61);
    return out;
}

const MIN_SCORE = 60;
export function scoreMapping(entity: Entity, headers: string[], rows: string[][] = [], extra: Record<string, string[]> = {}): { mapping: Mapping; scores: number[] } {
    const defs = FIELDS[entity];
    const cand: { s: number; h: number; k: string; o: number }[] = [];
    headers.forEach((h, hi) => {
        const ht = tokens(h); const f = fold(h);
        const hints = contentHints(entity, rows.map((r) => r[hi] ?? ''));
        defs.forEach((d, o) => {
            let s = (extra[d.key] ?? []).includes(f) ? 110 : 0;
            if (d.synonyms.includes(f) || fold(d.label) === f) s = Math.max(s, 100);
            for (const p of d.synonyms) s = Math.max(s, phraseScore(ht, tokens(p)));
            // Popisek pole jen při úplné shodě (popisky obsahují i příklady, např. „Role (soud, protistrana…)“)
            const ls = phraseScore(ht, tokens(d.label)); if (ls >= 92) s = Math.max(s, ls);
            if (!ht.length || s < MIN_SCORE) s = Math.max(s, hints[d.key] ?? 0);
            else if (hints[d.key]) s += 5; // název i obsah ukazují na totéž pole
            if (s >= MIN_SCORE) cand.push({ s, h: hi, k: d.key, o });
        });
    });
    cand.sort((a, b) => b.s - a.s || a.o - b.o || a.h - b.h);
    const mapping: Mapping = headers.map(() => ''); const scores = headers.map(() => 0); const used = new Set<string>();
    for (const c of cand) { if (mapping[c.h] || used.has(c.k)) continue; mapping[c.h] = c.k; scores[c.h] = c.s; used.add(c.k); }
    // „Jméno“ je jméno celé, pokud ve výpisu není zvlášť příjmení
    if (entity === 'klienti' && !mapping.includes('last') && mapping.includes('first') && !mapping.includes('name')) mapping[mapping.indexOf('first')] = 'name';
    return { mapping, scores };
}

export function suggestMapping(entity: Entity, headers: string[], rows: string[][] = []): Mapping {
    return scoreMapping(entity, headers, rows).mapping;
}

const ENTITY_FROM_NAME: [RegExp, Entity][] = [[/kontakt|protistran|ucastni/, 'kontakty'], [/klient|adresar|zakaznik/, 'klienti'], [/lhut|termin|ukol/, 'lhuty'], [/\bcas\b|vykaz|vykon|hodin|odpracov|timesheet/, 'cas'], [/\bvec|spis|kauz|matter/, 'veci']];
export function detectEntity(headers: string[], sheetName = '', rows: string[][] = []): { entity: Entity; score: number } {
    const f = headers.map(fold);
    let best: { entity: Entity; score: number } = { entity: 'klienti', score: -1 };
    for (const e of Object.keys(FIELDS) as Entity[]) {
        const { mapping, scores } = scoreMapping(e, headers, rows);
        const req = FIELDS[e].filter((d) => d.required);
        const reqHit = req.filter((d) => mapping.includes(d.key) || (e === 'klienti' && d.key === 'name' && mapping.some((m) => m === 'first' || m === 'company'))).length;
        const score = scores.reduce((n, x) => n + Math.min(x, 100) / 100, 0) + reqHit * 2 + (reqHit === req.length ? 3 : 0) - mapping.filter((m) => !m).length * 0.5;
        if (score > best.score) best = { entity: e, score };
    }
    // Název listu („Klienti“, „Lhůty“…) je nejsilnější vodítko
    const n = fold(sheetName);
    const byName = n ? ENTITY_FROM_NAME.find(([re]) => re.test(n))?.[1] : undefined;
    if (byName) return { entity: byName, score: best.score };
    // Rozlišení: čas má hodiny, lhůty mají konec lhůty nebo termín
    const has = (...keys: string[]) => keys.some((k) => f.includes(k));
    if (has('hodiny', 'hours', 'minuty', 'minutes', 'odpracovano')) return { entity: 'cas', score: best.score };
    if (has('konec lhuty', 'lhuta', 'termin')) return { entity: 'lhuty', score: best.score };
    return best;
}

// ---------- převod hodnot ----------
export function parseAnyDate(raw: string): string | null {
    const s = raw.trim(); if (!s) return null;
    const d = parseDateCell(s); if (d) return d;
    // d.m.yy a Excel sériové číslo
    let m = s.match(/^(\d{1,2})\s*[./]\s*(\d{1,2})\s*[./]\s*(\d{2})$/);
    if (m) { const y = Number(m[3]) + (Number(m[3]) > 50 ? 1900 : 2000); const iso = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return new Date(`${iso}T12:00:00Z`).toISOString().slice(0, 10) === iso ? iso : null; }
    if (/^\d{5}(\.\d+)?$/.test(s)) { const n = Math.floor(Number(s)); if (n > 20000 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + n * 86_400_000).toISOString().slice(0, 10); }
    m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s+\d/); if (m) return parseDateCell(`${m[1]}.${m[2]}.${m[3]}`);
    return null;
}
export const normEmail = (s: string) => { const m = s.match(/[^\s,;<>()]+@[^\s,;<>()]+\.[^\s,;<>()]+/); return m ? m[0].toLowerCase() : ''; };
export function normPhone(s: string): string {
    const d = s.replace(/[^\d+]/g, ''); if (!d) return '';
    if (/^\+420\d{9}$/.test(d)) return `+420 ${d.slice(4, 7)} ${d.slice(7, 10)} ${d.slice(10)}`;
    if (/^00420\d{9}$/.test(d)) return normPhone(`+${d.slice(2)}`);
    if (/^\d{9}$/.test(d)) return `+420 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
    return s.trim();
}
const truthy = (s: string) => /^(ano|a|1|true|yes|y|x|splneno|hotovo|vyfakturovano|✓)$/i.test(fold(s) ? s.trim() : '');
const doneStatus = (s: string) => /uzavren|vyrizen|archiv|ukonc|hotov|done|closed|zavren/i.test(fold(s));

export function minutesFrom(rec: { hours?: string; minutes?: string; duration?: string }): number {
    const dur = (rec.duration ?? '').trim();
    if (dur) { const m = dur.match(/^(\d+):(\d{1,2})(?::\d{1,2})?$/); if (m) return Number(m[1]) * 60 + Number(m[2]); const n = parseAmount(dur); if (n !== null) return Math.round(n < 24 && /[.,]/.test(dur) ? n * 60 : n); }
    if (rec.hours?.trim()) { const n = parseAmount(rec.hours); if (n !== null) return Math.round(n * 60); }
    if (rec.minutes?.trim()) { const n = parseAmount(rec.minutes); if (n !== null) return Math.round(n); }
    return 0;
}

// ---------- záznamy a kontrola ----------
export type Rec = Record<string, string>;
export type Issue = { level: 'error' | 'warn'; text: string };
export type Row = { index: number; rec: Rec; issues: Issue[] };

export function buildRecords(entity: Entity, table: Table, mapping: Mapping): Row[] {
    const defs = FIELDS[entity];
    return table.rows.map((cells, index) => {
        const rec: Rec = {}; const issues: Issue[] = [];
        mapping.forEach((key, i) => { if (key) rec[key] = rec[key] ? `${rec[key]} ${cells[i] ?? ''}`.trim() : (cells[i] ?? '').trim(); });
        if (entity === 'klienti') {
            if (!rec.name) rec.name = [rec.first, rec.last].filter(Boolean).join(' ').trim() || rec.company || '';
            if (!rec.address) rec.address = [rec.street, [rec.zip, rec.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
            if (rec.email) { const e = normEmail(rec.email); if (e) rec.email = e; else { issues.push({ level: 'warn', text: `E-mail „${rec.email}“ nevypadá správně, nepřevezme se.` }); rec.email = ''; } }
            if (rec.phone) rec.phone = normPhone(rec.phone);
            if (rec.ico) { rec.ico = cleanIco(rec.ico).replace(/^0+(?=\d{8}$)/, ''); if (rec.ico.length === 7) rec.ico = `0${rec.ico}`; if (!isValidIco(rec.ico)) issues.push({ level: 'warn', text: `IČO ${rec.ico} nemá platný kontrolní součet.` }); }
            if (rec.birth) { const d = parseAnyDate(rec.birth); if (d) rec.birth = d; else { issues.push({ level: 'warn', text: `Datum narození „${rec.birth}“ se nepodařilo přečíst.` }); rec.birth = ''; } }
            if (rec.rate) { const n = parseAmount(rec.rate); rec.rate = n !== null && n >= 0 ? String(n) : ''; }
        }
        if (entity === 'veci') {
            if (rec.clientEmail) rec.clientEmail = normEmail(rec.clientEmail);
            if (rec.clientPhone) rec.clientPhone = normPhone(rec.clientPhone);
            rec.status = doneStatus(rec.status ?? '') ? 'done' : 'open';
        }
        if (entity === 'lhuty') {
            const d = parseAnyDate(rec.date ?? ''); if (d) rec.date = d; else { issues.push({ level: 'error', text: `Datum „${rec.date ?? ''}“ se nepodařilo přečíst.` }); }
            rec.done = truthy(rec.done ?? '') ? '1' : '';
        }
        if (entity === 'kontakty') { if (rec.email) rec.email = normEmail(rec.email); if (rec.phone) rec.phone = normPhone(rec.phone); }
        if (entity === 'cas') {
            const d = parseAnyDate(rec.date ?? ''); if (d) rec.date = d; else issues.push({ level: 'error', text: `Datum „${rec.date ?? ''}“ se nepodařilo přečíst.` });
            const m = minutesFrom(rec); if (m > 0 && m <= 1440) rec.minutesOut = String(m); else issues.push({ level: 'error', text: 'Chybí nebo je neplatný čas (1 až 1440 minut).' });
            if (rec.rate) { const n = parseAmount(rec.rate); rec.rate = n !== null && n >= 0 ? String(n) : ''; }
            rec.billed = truthy(rec.billed ?? '') ? '1' : '';
        }
        for (const f of defs) if (f.required && !rec[f.key] && !(entity === 'klienti' && f.key === 'name' && rec.name)) issues.push({ level: 'error', text: `Chybí povinný údaj: ${f.label}.` });
        return { index, rec, issues };
    });
}

// ---------- propojení a plán ----------
export type ExistingClient = { id: string; name: string; email: string; phone: string; address?: string; ico?: string; dic?: string; birth?: string | null; note?: string; hourly_rate?: number | null };
export type ExistingCase = { id: string; title: string; reference?: string; client_id?: string | null };
export type Existing = { clients: ExistingClient[]; cases: ExistingCase[] };
export type NewCase = { title: string; reference: string };
export type Planned = { row: Row; action: 'create' | 'update' | 'skip' | 'error'; note: string; clientId?: string | null; caseId?: string | null; newClient?: Rec | null; newCase?: NewCase | null; selfId?: string; patch?: Record<string, string | number> };
export type PlanOptions = { createMissingClients: boolean; fillExisting: boolean; createMissingCases?: boolean };

const clientKeys = (c: { name: string; ico?: string; email?: string }) => [c.ico ? `i:${cleanIco(c.ico)}` : '', c.email ? `e:${c.email.toLowerCase()}` : '', c.name ? `n:${fold(c.name)}` : ''].filter(Boolean);
const looksLikeReference = (s: string) => RE.ref.test(s.trim());

// Společný stav plánování: co už v kanceláři je a co založí dřívější listy téhož souboru (dočasná id „new:…“)
export type PlanContext = ReturnType<typeof createPlanContext>;
export function createPlanContext(existing: Existing) {
    const clientIndex = new Map<string, ExistingClient>();
    const addClient = (c: ExistingClient) => clientKeys(c).forEach((k) => { if (!clientIndex.has(k)) clientIndex.set(k, c); });
    existing.clients.forEach(addClient);
    const caseByRef = new Map<string, ExistingCase>(); const caseByTitle = new Map<string, ExistingCase[]>();
    const addCase = (c: ExistingCase) => { if (c.reference) caseByRef.set(fold(c.reference), c); const k = fold(c.title); if (k) caseByTitle.set(k, [...(caseByTitle.get(k) ?? []), c]); };
    existing.cases.forEach(addCase);
    let n = 0;
    return { clientIndex, addClient, caseByRef, caseByTitle, addCase, nextId: () => `new:${n++}` };
}

export function planImport(entity: Entity, rows: Row[], existing: Existing, opt: PlanOptions, ctx: PlanContext = createPlanContext(existing)): Planned[] {
    const out: Planned[] = [];
    const { clientIndex, addClient, caseByRef, caseByTitle, addCase } = ctx;
    const findCase = (key: string): { c?: ExistingCase; note: string; ambiguous?: boolean } => {
        const f = fold(key); if (!f) return { note: 'Nezadaná věc.' };
        const r = caseByRef.get(f); if (r) return { c: r, note: '' };
        const t = caseByTitle.get(f); if (t?.length === 1) return { c: t[0], note: '' };
        if (t && t.length > 1) return { note: `Název „${key}“ má víc věcí, použijte spisovou značku.`, ambiguous: true };
        return { note: `Věc „${key}“ nebyla nalezena.` };
    };
    for (const row of rows) {
        const errs = row.issues.filter((i) => i.level === 'error');
        if (errs.length) { out.push({ row, action: 'error', note: errs[0].text }); continue; }
        const r = row.rec;
        if (entity === 'klienti') {
            const found = clientKeys({ name: r.name, ico: r.ico, email: r.email }).map((k) => clientIndex.get(k)).find(Boolean);
            if (found) {
                const patch: Record<string, string | number> = {};
                if (opt.fillExisting && !found.id.startsWith('new:')) {
                    if (!found.email && r.email) patch.email = r.email; if (!found.phone && r.phone) patch.phone = r.phone; if (!found.address && r.address) patch.address = r.address;
                    if (!found.ico && r.ico) patch.ico = r.ico; if (!found.dic && r.dic) patch.dic = r.dic; if (!found.birth && r.birth) patch.birth = r.birth; if (!found.note && r.note) patch.note = r.note;
                }
                out.push(Object.keys(patch).length ? { row, action: 'update', note: `Už existuje, doplní se: ${Object.keys(patch).length} údajů.`, clientId: found.id, patch } : { row, action: 'skip', note: 'Klient už existuje.', clientId: found.id });
            } else { const v: ExistingClient = { id: ctx.nextId(), name: r.name, email: r.email ?? '', phone: r.phone ?? '', ico: r.ico }; addClient(v); out.push({ row, action: 'create', note: '', selfId: v.id }); }
        } else if (entity === 'veci') {
            const ref = r.reference ? caseByRef.get(fold(r.reference)) : undefined;
            if (ref) { out.push({ row, action: 'skip', note: 'Věc s touto spisovou značkou už existuje.', caseId: ref.id }); continue; }
            let clientId: string | null = null; let note = ''; let newClient: Rec | null = null;
            if (r.client) {
                const c = clientKeys({ name: r.client, email: r.clientEmail }).map((k) => clientIndex.get(k)).find(Boolean);
                if (c) clientId = c.id;
                else if (opt.createMissingClients) { const v: ExistingClient = { id: ctx.nextId(), name: r.client, email: r.clientEmail ?? '', phone: r.clientPhone ?? '' }; addClient(v); clientId = v.id; newClient = { name: r.client, email: r.clientEmail ?? '', phone: r.clientPhone ?? '' }; note = 'Založí se i nový klient.'; }
                else note = `Klient „${r.client}“ není v adresáři, věc se uloží bez propojení.`;
            }
            const dup = !r.reference && (caseByTitle.get(fold(r.title))?.length ?? 0) > 0;
            if (dup) { out.push({ row, action: 'skip', note: 'Věc se stejným názvem už existuje.' }); continue; }
            const selfId = ctx.nextId();
            addCase({ id: selfId, title: r.title, reference: r.reference, client_id: clientId });
            out.push({ row, action: 'create', note, clientId, newClient, selfId });
        } else {
            const key = (r.case ?? '').trim();
            const { c, note, ambiguous } = findCase(key);
            if (c) { out.push({ row, action: 'create', note: '', caseId: c.id }); continue; }
            if (entity === 'cas' && !key) { out.push({ row, action: 'create', note: 'Čas bez věci.', caseId: null }); continue; }
            if (key && !ambiguous && opt.createMissingCases) {
                // Věc v kanceláři není: založí se (jednou) a řádek se k ní připojí
                const isRef = looksLikeReference(key);
                const nc: NewCase = { title: key, reference: isRef ? key : '' };
                const id = ctx.nextId(); addCase({ id, title: nc.title, reference: nc.reference });
                out.push({ row, action: 'create', note: `Založí se i nová věc „${key}“.`, caseId: id, newCase: nc });
                continue;
            }
            out.push({ row, action: 'error', note });
        }
    }
    return out;
}

// Celý sešit najednou: listy se plánují v pořadí klienti → věci → lhůty, kontakty, čas, aby se další listy mohly připojit k tomu, co založí předchozí
export const ENTITY_ORDER: Entity[] = ['klienti', 'veci', 'lhuty', 'kontakty', 'cas'];
export function planWorkbook(parts: { entity: Entity; rows: Row[] }[], existing: Existing, opt: PlanOptions): Planned[][] {
    const ctx = createPlanContext(existing);
    const out: Planned[][] = parts.map(() => []);
    const order = parts.map((p, i) => i).sort((a, b) => ENTITY_ORDER.indexOf(parts[a].entity) - ENTITY_ORDER.indexOf(parts[b].entity) || a - b);
    for (const i of order) out[i] = planImport(parts[i].entity, parts[i].rows, existing, opt, ctx);
    return out;
}

export function summarize(plan: Planned[]) {
    const n = (a: Planned['action']) => plan.filter((p) => p.action === a).length;
    return { create: n('create'), update: n('update'), skip: n('skip'), error: n('error'), warnings: plan.filter((p) => p.row.issues.some((i) => i.level === 'warn')).length, newClients: plan.filter((p) => p.newClient).length, newCases: plan.filter((p) => p.newCase).length };
}
