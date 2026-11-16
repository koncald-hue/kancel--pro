// Zákonný úrok z prodlení podle § 2 odst. 1 nařízení vlády č. 351/2013 Sb.: repo sazba ČNB platná pro první den kalendářního pololetí,
// v němž došlo k prodlení, zvýšená o 8 procentních bodů. Sazba zůstává po celou dobu prodlení stejná.
// Historie 2T repo sazby: ČNB, soubor „Historie 2T repo sazby“ (cnb.cz), poslední změna 6. 11. 2026.
export const REPO_HISTORY: [string, number][] = [
    ['2012-11-02', 0.05], ['2017-08-04', 0.25], ['2017-11-03', 0.5], ['2018-02-02', 0.75], ['2018-06-28', 1.0], ['2018-08-03', 1.25], ['2018-09-27', 1.5], ['2018-11-02', 1.75],
    ['2019-05-03', 2.0], ['2020-02-07', 2.25], ['2020-03-17', 1.75], ['2020-03-27', 1.0], ['2020-05-11', 0.25], ['2021-06-24', 0.5], ['2021-08-06', 0.75], ['2021-10-01', 1.5],
    ['2021-11-05', 2.75], ['2021-12-23', 3.75], ['2022-02-04', 4.5], ['2022-04-01', 5.0], ['2022-05-06', 5.75], ['2022-06-23', 7.0], ['2023-12-22', 6.75], ['2024-02-09', 6.25],
    ['2024-03-21', 5.75], ['2024-05-03', 5.25], ['2024-06-28', 4.75], ['2024-08-02', 4.5], ['2024-09-26', 4.25], ['2024-11-08', 4.0], ['2025-02-07', 3.75], ['2025-05-09', 3.5],
    ['2026-06-19', 3.75], ['2026-11-06', 4.0],
];
export const REPO_UPDATED = '2026-11-06';
export const SURCHARGE = 8;
export const EARLIEST = '2014-01-01'; // nařízení vlády č. 351/2013 Sb. se použije na prodlení od 1. 1. 2014

const MS = 86_400_000;
const parse = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const daysBetween = (fromIso: string, toIso: string) => Math.round((parse(toIso) - parse(fromIso)) / MS);
export const addDays = (iso: string, n: number) => new Date(parse(iso) + n * MS).toISOString().slice(0, 10);
export const isIso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s)) && new Date(parse(s)).toISOString().slice(0, 10) === s;

// Repo sazba platná k danému dni (změna platí od uvedeného dne včetně)
export function repoOn(iso: string): number | null {
    let rate: number | null = null;
    for (const [from, r] of REPO_HISTORY) if (from <= iso) rate = r;
    return rate;
}

// První den pololetí, v němž prodlení vzniklo (prodlení začíná dnem po splatnosti)
export const halfYearStart = (iso: string) => `${iso.slice(0, 4)}-${Number(iso.slice(5, 7)) <= 6 ? '01' : '07'}-01`;

export type SazbaInfo = { startProdleni: string; pololeti: string; repo: number; rocni: number };
export function zakonnaSazba(splatnost: string): SazbaInfo | null {
    const start = addDays(splatnost, 1);
    const hy = halfYearStart(start);
    if (hy < EARLIEST) return null;
    const repo = repoOn(hy);
    if (repo === null) return null;
    return { startProdleni: start, pololeti: hy, repo, rocni: Math.round((repo + SURCHARGE) * 100) / 100 };
}

export type Splatka = { date: string; amount: number };
export type Radek = { od: string; do: string; dnu: number; jistina: number; urok: number };
export type UrokVysledek = { sazbaPct: number; radky: Radek[]; dnuCelkem: number; urok: number; zbyvaJistina: number; zaplaceno: number };

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Úrok z prodlení po úsecích: po každé částečné platbě se jistina sníží od následujícího dne. Počítá se každý den po splatnosti
// až do dne zaplacení včetně, rok má 365 dní.
export function vypocetUroku(p: { jistina: number; splatnost: string; do: string; splatky?: Splatka[]; sazbaPct: number }): UrokVysledek {
    const end = p.do;
    const payments = (p.splatky ?? []).filter((s) => s.amount > 0 && s.date > p.splatnost && s.date <= end).sort((a, b) => a.date.localeCompare(b.date));
    let principal = Math.max(0, p.jistina);
    let cursor = p.splatnost;
    const radky: Radek[] = [];
    let paid = 0;
    const segment = (to: string) => {
        const dnu = daysBetween(cursor, to);
        if (dnu > 0 && principal > 0) radky.push({ od: addDays(cursor, 1), do: to, dnu, jistina: r2(principal), urok: r2((principal * p.sazbaPct / 100 * dnu) / 365) });
        cursor = to;
    };
    for (const s of payments) {
        segment(s.date);
        const applied = Math.min(principal, s.amount);
        principal = r2(principal - applied); paid = r2(paid + applied);
    }
    segment(end);
    return { sazbaPct: p.sazbaPct, radky, dnuCelkem: radky.reduce((s, r) => s + r.dnu, 0), urok: r2(radky.reduce((s, r) => s + r.urok, 0)), zbyvaJistina: principal, zaplaceno: paid };
}
