import type { Unit } from './lhuty';
import { isIsoDate } from './lhuty';
import { remedyProposal } from './remedyDefaults';

// Vyhledání lhůt v textu soudního nebo úředního rozhodnutí (typicky v poučení). Pracuje výhradně pravidly bez umělé inteligence:
// každý nález má doslovný citát z dokumentu a může být neúplný. Nenalezení lhůty NEZNAMENÁ, že žádná neběží.
export type Trigger = 'doruceni' | 'pravni_moc' | 'vyhlaseni' | 'zverejneni' | 'neuveden';
export type Confidence = 'vysoka' | 'stredni' | 'nizka';
export type Candidate = { id: string; label: string; kind: 'relativni' | 'absolutni'; n?: number; unit?: Unit; date?: string; trigger: Trigger; quote: string; confidence: Confidence; warnings: string[]; source: string; lawKey?: string; statutory?: boolean };
export type Analysis = { docType: string; candidates: Candidate[]; poucení: string[]; notes: string[] };

export const TRIGGER_LABELS: Record<Trigger, string> = { doruceni: 'od doručení', pravni_moc: 'od právní moci', vyhlaseni: 'od vyhlášení', zverejneni: 'od zveřejnění', neuveden: 'začátek neuveden' };

const WORDS: Record<string, number> = { jednoho: 1, jednom: 1, dvou: 2, tří: 3, čtyř: 4, pěti: 5, šesti: 6, sedmi: 7, osmi: 8, devíti: 9, deseti: 10, jedenácti: 11, dvanácti: 12, třinácti: 13, čtrnácti: 14, patnácti: 15, dvaceti: 20, třiceti: 30, čtyřiceti: 40, šedesáti: 60, devadesáti: 90 };
const NUM = `(\\d{1,3}|${Object.keys(WORDS).join('|')})`;
const CUE = '(?:ve\\s+lh[ůu]t[ěe]|lh[ůu]t[auěy]|do|b[ěe]hem|po\\s+dobu|nejpozd[ěe]ji\\s+do|v\\s+pr[ůu]b[ěe]hu)';
const UNITRE = '(kalendářních\\s+|pracovních\\s+)?(dn[ůí]|dny|dne|den|týdn[ůy]|týden|měsíc[ůe]?|rok[ůu]|roky|let|rok)(?!\\p{L})';
const RELATIVE = new RegExp(`${CUE}[^.;\\n]{0,40}?(?<![\\d.,/])${NUM}(?:\\s*\\([^)]{1,25}\\))?\\s*${UNITRE}`, 'giu');
const MONTHS: Record<string, number> = { ledna: 1, února: 2, března: 3, dubna: 4, května: 5, června: 6, července: 7, srpna: 8, září: 9, října: 10, listopadu: 11, prosince: 12 };
const ABSOLUTE = new RegExp(`(?:nejpozději\\s+do|nejpozději\\s+dne|lhůt[auěy]\\s+do|ve\\s+lhůtě\\s+do|do\\s+dne|do)\\s+(\\d{1,2})\\s*\\.\\s*(?:(\\d{1,2})\\s*\\.|(${Object.keys(MONTHS).join('|')}))\\s*(\\d{4})`, 'giu');

const LABELS: [RegExp, string][] = [
    [/odpor/i, 'Odpor proti platebnímu rozkazu'], [/dovolán/i, 'Dovolání'], [/odvolán/i, 'Odvolání'], [/rozklad/i, 'Rozklad'], [/námitk/i, 'Námitky'],
    [/ústavní\s+stížnost/i, 'Ústavní stížnost'], [/kasační\s+stížnost/i, 'Kasační stížnost'], [/stížnost/i, 'Stížnost'], [/žalob(?!c|kyn)/i, 'Žaloba'], [/vyjádř/i, 'Vyjádření'],
    [/dopln|odstran\w*\s+vad|oprav(it|il)/i, 'Doplnění nebo odstranění vad podání'], [/soudní\s+poplat|zálohu|záloha|složit|složil/i, 'Úhrada poplatku nebo zálohy'], [/zaplatit|zaplatil|uhradit|uhradil/i, 'Splnění povinnosti (platba)'],
    [/předložit|doložit|označit\s+důkaz|navrhnout\s+důkaz|listin/i, 'Předložení listin nebo důkazů'], [/splnit|splnil|plnění|plnit/i, 'Splnění povinnosti'], [/návrh/i, 'Návrh'], [/žádost/i, 'Žádost'],
];
const DEFAULT_LABEL = 'Lhůta z dokumentu';

const norm = (t: string) => t.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim();

// Slovesa hned za lhůtou („aby ve lhůtě 7 dnů doplnil žalobu“) určují, k čemu se lhůta vztahuje, přednostně před podstatnými jmény před ní
const ACTIONS = ['Doplnění nebo odstranění vad podání', 'Úhrada poplatku nebo zálohy', 'Předložení listin nebo důkazů', 'Splnění povinnosti (platba)', 'Splnění povinnosti', 'Vyjádření'];
function classify(before: string, after: string): { label: string; known: boolean } {
    for (const [re, label] of LABELS) if (ACTIONS.includes(label) && re.test(after.slice(0, 90))) return { label, known: true };
    // Nejbližší klíčové slovo před nálezem, jinak za ním
    let best: { label: string; pos: number } | null = null;
    for (const [re, label] of LABELS) {
        const g = new RegExp(re.source, 'gi'); let m: RegExpExecArray | null; let last = -1;
        while ((m = g.exec(before)) !== null) { last = m.index; if (m[0].length === 0) g.lastIndex++; }
        if (last >= 0 && (!best || last > best.pos)) best = { label, pos: last };
    }
    if (best) return { label: best.label, known: true };
    for (const [re, label] of LABELS) if (re.test(after)) return { label, known: true };
    return { label: DEFAULT_LABEL, known: false };
}

function triggerOf(after: string): Trigger {
    const a = after.slice(0, 110).toLowerCase();
    if (/(od|ode\s+dne|po)\s+(jeho\s+|její\s+|tohoto\s+|této\s+)?(doručení|převzetí|oznámení)/.test(a) || /ode\s+dne,?\s+kdy\s+(bylo|byl|byla)\s+(doručen|oznámen)/.test(a)) return 'doruceni';
    if (/(od|ode\s+dne|po)\s+(jeho\s+|její\s+|tohoto\s+|této\s+)?právní\s+moci/.test(a)) return 'pravni_moc';
    if (/(od|ode\s+dne|po)\s+(jeho\s+|její\s+)?vyhlášení/.test(a)) return 'vyhlaseni';
    if (/(od|ode\s+dne|po)\s+(jeho\s+|její\s+)?zveřejnění/.test(a)) return 'zverejneni';
    return 'neuveden';
}

const unitOf = (w: string): Unit | null => { const s = w.toLowerCase(); if (/^dn|^dne|^den/.test(s)) return 'den'; if (/^týd/.test(s)) return 'tyden'; if (/^měs/.test(s)) return 'mesic'; if (/^rok|^let/.test(s)) return 'rok'; return null; };

function quoteAround(text: string, idx: number, len: number): string {
    const start = Math.max(0, idx - 160); const end = Math.min(text.length, idx + len + 160);
    let q = text.slice(start, end).trim();
    if (start > 0) q = '… ' + q.replace(/^\S*\s/, '');
    if (end < text.length) q = q.replace(/\s\S*$/, '') + ' …';
    return q;
}

export function docTypeOf(text: string): string {
    const head = text.slice(0, 600).toUpperCase();
    for (const [needle, label] of [['PLATEBNÍ ROZKAZ', 'Platební rozkaz'], ['ROZSUDEK', 'Rozsudek'], ['USNESENÍ', 'Usnesení'], ['ROZHODNUTÍ', 'Rozhodnutí'], ['VÝZVA', 'Výzva'], ['PŘÍKAZ', 'Příkaz'], ['OZNÁMENÍ', 'Oznámení'], ['PŘEDVOLÁNÍ', 'Předvolání'], ['USNESENÍ', 'Usnesení']] as const) if (head.includes(needle)) return label;
    return '';
}

export function analyzeText(raw: string, source: string): Analysis {
    const text = norm(raw);
    const candidates: Candidate[] = [];
    const notes: string[] = [];
    const seen = new Set<string>();
    let idn = 0;

    for (const m of text.matchAll(RELATIVE)) {
        const numWord = m[1].toLowerCase();
        const n = /^\d+$/.test(numWord) ? Number(numWord) : WORDS[numWord];
        const kindWord = m[2]?.trim().toLowerCase() ?? '';
        const unit = unitOf(m[3] ?? '');
        if (!n || !unit || n < 1) continue;
        const idx = m.index ?? 0;
        const after = text.slice(idx + m[0].length, idx + m[0].length + 200);
        const before = text.slice(Math.max(0, idx - 260), idx + m[0].length);
        const { label, known } = classify(before, after.slice(0, 90));
        const trigger = triggerOf(after);
        const warnings: string[] = [];
        if (kindWord.startsWith('pracovn')) { warnings.push('Lhůta je uvedena v pracovních dnech. Aplikace je neumí spočítat, určete konec ručně.'); }
        if ((unit === 'den' && n > 1000) || (unit === 'mesic' && n > 120) || (unit === 'rok' && n > 30) || (unit === 'tyden' && n > 150)) continue;
        if (trigger === 'pravni_moc') warnings.push('Lhůta běží od právní moci, ne od doručení. Zadejte datum právní moci ručně.');
        else if (trigger === 'vyhlaseni' || trigger === 'zverejneni') warnings.push(`Lhůta běží ${TRIGGER_LABELS[trigger]}, ne od doručení. Zadejte počátek ručně.`);
        else if (trigger === 'neuveden') warnings.push('V textu není uvedeno, od kdy lhůta běží. Zkontrolujte poučení a ověřte počátek.');
        if (!known) warnings.push('Nepodařilo se poznat, k čemu se lhůta vztahuje. Přečtěte citaci.');
        const key = `${label}|${n}|${unit}|${trigger}|${kindWord}`;
        if (seen.has(key)) continue; seen.add(key);
        const confidence: Confidence = !kindWord && trigger === 'doruceni' && known ? 'vysoka' : kindWord || (trigger === 'neuveden' && !known) ? 'nizka' : 'stredni';
        candidates.push({ id: `${source}#${++idn}`, label, kind: 'relativni', n, unit, trigger: kindWord.startsWith('pracovn') ? 'neuveden' : trigger, quote: quoteAround(text, idx, m[0].length), confidence, warnings, source });
    }

    for (const m of text.matchAll(ABSOLUTE)) {
        const day = Number(m[1]); const month = m[2] ? Number(m[2]) : MONTHS[m[3].toLowerCase()]; const year = Number(m[4]);
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (!isIsoDate(iso) || year < 2000 || year > 2100) continue;
        const idx = m.index ?? 0;
        const before = text.slice(Math.max(0, idx - 260), idx + m[0].length);
        const range = /\bod\s+\d{1,2}\s*\.\s*(?:\d{1,2}\s*\.|[a-zěščřžýáíéúůď]+)\s*\d{4}[^.]{0,20}$/i.test(text.slice(Math.max(0, idx - 40), idx));
        const { label, known } = classify(before, text.slice(idx + m[0].length, idx + m[0].length + 90));
        const warnings = range ? ['Datum vypadá jako konec období („od … do …“), ne jako lhůta. Zkontrolujte citaci.'] : [];
        if (!known) warnings.push('Nepodařilo se poznat, k čemu se lhůta vztahuje. Přečtěte citaci.');
        const key = `abs|${label}|${iso}`;
        if (seen.has(key)) continue; seen.add(key);
        candidates.push({ id: `${source}#${++idn}`, label, kind: 'absolutni', date: iso, trigger: 'neuveden', quote: quoteAround(text, idx, m[0].length), confidence: range || !known ? 'nizka' : 'stredni', warnings, source });
    }

    // Poučení: odstavce, které začínají slovem „Poučení“; zachytí i varování, že opravný prostředek není přípustný
    const poucení: string[] = [];
    for (const m of text.matchAll(/pou[čc]en[ií]/gi)) {
        const idx = m.index ?? 0;
        if (poucení.length >= 3 || poucení.some((p) => text.indexOf(p.replace(/ …$/, '')) <= idx && idx - text.indexOf(p.replace(/ …$/, '')) < 900)) continue;
        poucení.push(text.slice(idx, idx + 1100).trim() + (text.length > idx + 1100 ? ' …' : ''));
    }
    if (/není\s+(odvolání\s+)?(přípustné|přípustný)|nepřípustn|odvolání\s+se\s+nepřipouští|nelze\s+(se\s+)?(odvolat|podat\s+odvolání)|opravný\s+prostředek\s+není\s+přípustný/i.test(text)) notes.push('Dokument obsahuje větu o tom, že opravný prostředek není přípustný. Přečtěte poučení.');
    // Poučení lhůtu k opravnému prostředku neuvádí (nebo ji pravidla nenašla): návrh podle obecné úpravy a druhu rozhodnutí
    const prop = remedyProposal(text);
    if (prop && !candidates.some((c) => c.label.split(' ')[0] === prop.label.split(' ')[0])) {
        candidates.push({ id: `${source}#${++idn}`, label: prop.label, kind: 'relativni', n: prop.n, unit: prop.unit, trigger: 'doruceni', quote: `Podle obecné úpravy: ${prop.law} (${prop.why}). Poučení v dokumentu tuto lhůtu neuvádí, nebo ji nástroj nenašel.`, confidence: 'stredni', warnings: ['Navrženo podle druhu rozhodnutí, ne z textu poučení. Ověřte poučení, přípustnost opravného prostředku a případný zvláštní předpis.', ...(prop.lawKey === 'dovolani-obcanske-rizeni' ? ['Dovolání je přípustné jen v zákonem stanovených případech.'] : [])], source, lawKey: prop.lawKey, statutory: true });
    }
    if (candidates.length === 0) notes.push('Žádná lhůta nebyla nalezena. To neznamená, že žádná neběží (může být v příloze, ve zvláštním dokumentu nebo vyplývat ze zákona). Přečtěte dokument.');
    return { docType: docTypeOf(text), candidates, poucení, notes };
}
