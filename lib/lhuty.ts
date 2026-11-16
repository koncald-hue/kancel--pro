// Počítání procesních lhůt podle § 57 občanského soudního řádu (stejná pravidla mají i § 60 trestního řádu, § 40 soudního řádu správního
// a § 40 správního řádu): do lhůty se nezapočítává den události; lhůty podle týdnů, měsíců a let končí dnem shodným s dnem události
// (není-li v měsíci, posledním dnem měsíce); připadne-li konec na sobotu, neděli nebo svátek, je posledním dnem nejbližší následující pracovní den.
// Svátky podle zákona č. 245/2000 Sb. (státní i ostatní svátky včetně Velkého pátku a Štědrého dne).
// Doručení do datové schránky podle § 17 odst. 3 a 4 zákona č. 300/2008 Sb.: okamžikem přihlášení, jinak posledním dnem 10denní lhůty od dodání.
export type Unit = 'den' | 'tyden' | 'mesic' | 'rok';
export const UNIT_LABELS: Record<Unit, [string, string, string]> = { den: ['den', 'dny', 'dnů'], tyden: ['týden', 'týdny', 'týdnů'], mesic: ['měsíc', 'měsíce', 'měsíců'], rok: ['rok', 'roky', 'let'] };
export const unitText = (n: number, u: Unit) => { const [one, few, many] = UNIT_LABELS[u]; return `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`; };

const MS = 86_400_000;
const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUtc(utc(s)) === s;
export const addDays = (iso: string, n: number) => fromUtc(utc(iso) + n * MS);
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / MS);
export const WEEKDAYS = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
export const weekdayOf = (iso: string) => WEEKDAYS[new Date(utc(iso)).getUTCDay()];

function easter(year: number): string {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
const FIXED: Record<string, string> = { '01-01': 'Nový rok, Den obnovy samostatného českého státu', '05-01': 'Svátek práce', '05-08': 'Den vítězství', '07-05': 'Den slovanských věrozvěstů Cyrila a Metoděje', '07-06': 'Den upálení mistra Jana Husa', '09-28': 'Den české státnosti', '10-28': 'Den vzniku samostatného československého státu', '11-17': 'Den boje za svobodu a demokracii', '12-24': 'Štědrý den', '12-25': '1. svátek vánoční', '12-26': '2. svátek vánoční' };

// Důvod, proč den není pracovní (sobota, neděle, svátek), nebo prázdný řetězec
export function nonWorkingReason(iso: string): string {
    const wd = new Date(utc(iso)).getUTCDay();
    if (wd === 6) return 'sobota';
    if (wd === 0) return 'neděle';
    const fixed = FIXED[iso.slice(5)];
    if (fixed) return `svátek (${fixed})`;
    const e = easter(Number(iso.slice(0, 4)));
    if (iso === addDays(e, -2)) return 'svátek (Velký pátek)';
    if (iso === addDays(e, 1)) return 'svátek (Velikonoční pondělí)';
    return '';
}

// Přičtení lhůty k dni události podle § 57 odst. 1 a 2 (bez posunu na pracovní den)
export function rawEnd(eventIso: string, n: number, unit: Unit): string {
    if (unit === 'den') return addDays(eventIso, n);
    if (unit === 'tyden') return addDays(eventIso, 7 * n);
    const [y, m, d] = eventIso.split('-').map(Number);
    const months = unit === 'rok' ? 12 * n : n;
    const total = (y * 12 + (m - 1)) + months;
    const ty = Math.floor(total / 12), tm = total % 12;
    const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
    return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export type LhutaEnd = { event: string; raw: string; end: string; shiftedFrom: string | null; reasons: string[]; weekday: string; internal: string };
// Konec lhůty včetně posunu na nejbližší následující pracovní den a doporučeného interního data (poslední pracovní den před koncem)
export function computeEnd(eventIso: string, n: number, unit: Unit): LhutaEnd {
    const raw = rawEnd(eventIso, n, unit);
    let end = raw; const reasons: string[] = [];
    while (nonWorkingReason(end)) { reasons.push(`${weekdayOf(end)} ${czDate(end)}: ${nonWorkingReason(end)}`); end = addDays(end, 1); }
    let internal = addDays(end, -1);
    while (nonWorkingReason(internal)) internal = addDays(internal, -1);
    return { event: eventIso, raw, end, shiftedFrom: end === raw ? null : raw, reasons, weekday: weekdayOf(end), internal };
}

// Absolutní datum určené rozhodnutím (např. „do 15. 12. 2026“): také se posouvá z nepracovního dne
export function computeAbsolute(iso: string): LhutaEnd {
    let end = iso; const reasons: string[] = [];
    while (nonWorkingReason(end)) { reasons.push(`${weekdayOf(end)} ${czDate(end)}: ${nonWorkingReason(end)}`); end = addDays(end, 1); }
    let internal = addDays(end, -1);
    while (nonWorkingReason(internal)) internal = addDays(internal, -1);
    return { event: iso, raw: iso, end, shiftedFrom: end === iso ? null : iso, reasons, weekday: weekdayOf(end), internal };
}

export const czDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d}. ${m}. ${y}`; };

// Datum podle pražského času (hodnoty z datových schránek bývají s časovým pásmem nebo bez něj)
export function pragueDate(value: string): string {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    }
    return /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : '';
}

// ---------- Datum doručení z datové zprávy ----------
export type Delivery = { date: string; basis: 'prihlaseni' | 'fikce' | 'stazeni' | 'ocekavano'; certain: boolean; explanation: string; warnings: string[] };
export type DeliveryInput = { status: string; delivered: string; accepted: string; downloadedNow?: boolean; today: string };

// Rozhodné datum doručení: přihlášením (dmAcceptanceTime), jinak posledním dnem 10 dnů od dodání; u dosud nedoručené zprávy stažením právě teď
export function deliveryOf(i: DeliveryInput): Delivery {
    const dodani = pragueDate(i.delivered);
    const accepted = pragueDate(i.accepted);
    const warnings: string[] = ['U některých písemností (např. v trestním řízení) fikce doručení neplatí. Rozhodné datum si vždy ověřte podle doručenky nebo poučení (§ 17 odst. 4 zákona č. 300/2008 Sb.).'];
    if (i.downloadedNow && !accepted) return { date: i.today, basis: 'stazeni', certain: true, explanation: `Zpráva byla stažena ${czDate(i.today)}, tím se doručila přihlášením (§ 17 odst. 3 zákona č. 300/2008 Sb.).`, warnings };
    if (accepted && ['5', '6', '7', '9', '10'].includes(i.status)) {
        const fiction = i.status === '5';
        return { date: accepted, basis: fiction ? 'fikce' : 'prihlaseni', certain: true, explanation: fiction ? `Zpráva se považuje za doručenou fikcí ${czDate(accepted)} (poslední den 10denní lhůty od dodání ${dodani ? czDate(dodani) : ''}).` : `Zpráva byla doručena přihlášením ${czDate(accepted)}.`, warnings };
    }
    if (dodani) {
        const fiction = addDays(dodani, 10);
        return { date: fiction, basis: 'ocekavano', certain: false, explanation: `Zpráva je dodaná od ${czDate(dodani)}, ale zatím nedoručená. Nepřihlásí-li se nikdo, doručí se fikcí ${czDate(fiction)}; stažením se doručí ihned.`, warnings: [...warnings, 'Zpráva ještě není doručená, lhůta zatím neběží. Nejzazší doručení je uvedené datum, stažením zprávy se doručí dříve.'] };
    }
    return { date: '', basis: 'ocekavano', certain: false, explanation: 'Datum doručení se nepodařilo určit.', warnings };
}

// Datum zadané ručně (D. M. RRRR nebo RRRR-MM-DD, rok čtyřmístně, 2000 až 2100); neplatné vrátí null
export function parseDateInput(input: string): string | null {
    const t = input.trim();
    const m = t.match(/^(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{4})$/);
    const iso = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : t;
    if (!isIsoDate(iso)) return null;
    const y = Number(iso.slice(0, 4));
    return y >= 2000 && y <= 2100 ? iso : null;
}

// Vysvětlení výpočtu, které se uloží ke lhůtě (aby šlo kdykoli zkontrolovat, jak vznikla)
export function explain(e: LhutaEnd, n: number, unit: Unit, deliveryText: string): string {
    const base = `${deliveryText} Lhůta ${unitText(n, unit)} se počítá od následujícího dne (§ 57 odst. 1 o. s. ř.) a končí ${czDate(e.raw)}.`;
    const shift = e.shiftedFrom ? ` Tento den připadá na nepracovní den (${e.reasons.join('; ')}), proto je posledním dnem lhůty nejbližší následující pracovní den ${czDate(e.end)} (§ 57 odst. 2 o. s. ř.).` : '';
    return `${base}${shift} Konec lhůty: ${weekdayOf(e.end)} ${czDate(e.end)}. Doporučeno podat nejpozději ${czDate(e.internal)}.`;
}
