// Odměna podle advokátního tarifu (vyhláška č. 177/1996 Sb.). Znění § 7, § 11, § 12 a § 13 ověřeno k 16. 11. 2026.
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// § 7: sazba mimosmluvní odměny za jeden úkon z tarifní hodnoty (v Kč)
export function sazba(hodnota: number): number {
    const h = Math.max(0, hodnota);
    if (h <= 500) return 300;
    if (h <= 1_000) return 500;
    if (h <= 5_000) return 1_000;
    if (h <= 10_000) return 1_500;
    if (h <= 200_000) return 1_500 + 40 * Math.ceil((h - 10_000) / 1_000);
    if (h <= 10_000_000) return 9_100 + 40 * Math.ceil((h - 200_000) / 10_000);
    return 48_300 + 40 * Math.ceil((h - 10_000_000) / 100_000);
}

// § 11: úkony právní služby. Odst. 1 = plná sazba, odst. 2 = polovina. Vybrané nejčastější úkony.
export type Ukon = { id: string; label: string; half: boolean; hint?: string };
export const UKONY: Ukon[] = [
    { id: '1a', label: 'Převzetí a příprava zastoupení', half: false, hint: '§ 11 odst. 1 písm. a)' },
    { id: '1c', label: 'Další porada s klientem přesahující 1 hodinu', half: false, hint: '§ 11 odst. 1 písm. c)' },
    { id: '1d', label: 'Písemné podání ve věci samé, výzva k plnění s rozborem', half: false, hint: '§ 11 odst. 1 písm. d)' },
    { id: '1g', label: 'Účast na jednání před soudem nebo orgánem (každé započaté 2 hodiny)', half: false, hint: '§ 11 odst. 1 písm. g)' },
    { id: '1h', label: 'Sepsání právního rozboru věci', half: false, hint: '§ 11 odst. 1 písm. h)' },
    { id: '1i', label: 'Jednání s protistranou (každé započaté 2 hodiny)', half: false, hint: '§ 11 odst. 1 písm. i)' },
    { id: '1k', label: 'Odvolání, dovolání, návrh na obnovu řízení a vyjádření k nim', half: false, hint: '§ 11 odst. 1 písm. k)' },
    { id: '1m', label: 'Sepsání listiny o právním jednání', half: false, hint: '§ 11 odst. 1 písm. m)' },
    { id: '2h', label: 'Jednoduchá výzva k plnění', half: true, hint: '§ 11 odst. 2 písm. h)' },
    { id: '2f', label: 'Účast při jednání, při kterém došlo jen k vyhlášení rozhodnutí', half: true, hint: '§ 11 odst. 2 písm. f)' },
    { id: '2g', label: 'Účast při přípravě jednání', half: true, hint: '§ 11 odst. 2 písm. g)' },
    { id: '2c', label: 'Odvolání proti rozhodnutí, které není ve věci samé, a vyjádření k němu', half: true, hint: '§ 11 odst. 2 písm. c)' },
];

export const PAUSAL_DEFAULT = 450; // § 13 odst. 4: paušální náhrada výdajů na jeden úkon, nedohodnuto-li jinak
export const DPH_DEFAULT = 21;

// § 12 odst. 4: u společných úkonů pro více osob náleží za druhou osobu 80 %, za třetí 60 %, za čtvrtou 40 %, za pátou a další 20 % odměny
export function osobyKoeficient(n: number): number {
    const count = Math.max(1, Math.floor(n));
    let sum = 1;
    for (let i = 2; i <= count; i++) sum += i === 2 ? 0.8 : i === 3 ? 0.6 : i === 4 ? 0.4 : 0.2;
    return round2(sum);
}

export type OdmenaInput = { hodnota: number; pocty: Record<string, number>; upravaPct: number; osoby: number; pausal: number; vydaje: number; platceDph: boolean; dph: number };
export type Polozka = { id: string; label: string; pocet: number; sazbaUkonu: number; castka: number };
export type Odmena = { sazbaPlna: number; polozky: Polozka[]; ukonu: number; odmenaZaklad: number; uprava: number; osoby: number; odmena: number; pausal: number; vydaje: number; zaklad: number; dph: number; celkem: number };

// Úprava odměny podle § 12 odst. 1 a 2: nejméně 50 %, nejvýše 300 %
export const clampUprava = (pct: number) => Math.min(300, Math.max(50, pct));

export function vypocet(inp: OdmenaInput): Odmena {
    const plna = sazba(inp.hodnota);
    const polozky: Polozka[] = UKONY.flatMap((u) => {
        const pocet = Math.max(0, Math.floor(inp.pocty[u.id] ?? 0));
        if (!pocet) return [];
        const s = u.half ? plna / 2 : plna;
        return [{ id: u.id, label: u.label, pocet, sazbaUkonu: round2(s), castka: round2(s * pocet) }];
    });
    const ukonu = polozky.reduce((s, p) => s + p.pocet, 0);
    const odmenaZaklad = round2(polozky.reduce((s, p) => s + p.castka, 0));
    const upr = clampUprava(inp.upravaPct) / 100;
    const osoby = osobyKoeficient(inp.osoby);
    const odmena = round2(odmenaZaklad * upr * osoby);
    const pausal = round2(ukonu * Math.max(0, inp.pausal));
    const vydaje = round2(Math.max(0, inp.vydaje));
    const zaklad = round2(odmena + pausal + vydaje);
    const dph = inp.platceDph ? round2(zaklad * (inp.dph / 100)) : 0;
    return { sazbaPlna: plna, polozky, ukonu, odmenaZaklad, uprava: upr, osoby, odmena, pausal, vydaje, zaklad, dph, celkem: round2(zaklad + dph) };
}
