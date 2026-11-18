import { computeEnd, type LhutaEnd } from './lhuty';

// Radar protistrany: co se změnilo u hlídané firmy nebo osoby a co z toho pro věc plyne.
// Aplikace jen upozorňuje a navrhuje; lhůtu i další postup potvrzuje advokát.
export type RadarKind = 'insolvence' | 'insolvence_konec' | 'likvidace' | 'zanik' | 'zmena_nazvu' | 'zmena_sidla' | 'katastr_rizeni';
export type Snapshot = { name: string; address: string; ended: string | null };
export type EventDraft = { kind: RadarKind; ref: string; title: string; detail: string; event_date: string | null };

export const RADAR_INFO: Record<RadarKind, { label: string; tone: 'bad' | 'warn' | 'info'; action: string; deadlineTitle?: string; months?: number }> = {
    insolvence: { label: 'Insolvence', tone: 'bad', action: 'Zkontrolujte rozhodnutí o úpadku v insolvenčním rejstříku. Pohledávku je potřeba přihlásit ve lhůtě uvedené v rozhodnutí (zpravidla 2 měsíce od jeho zveřejnění). Zvažte i dopad na probíhající řízení a exekuce.', deadlineTitle: 'Přihláška pohledávky do insolvenčního řízení', months: 2 },
    insolvence_konec: { label: 'Konec insolvence', tone: 'info', action: 'Insolvenční řízení skončilo. Ověřte způsob skončení a zda lze pokračovat ve vymáhání.' },
    likvidace: { label: 'Likvidace', tone: 'bad', action: 'Firma vstoupila do likvidace. Zjistěte likvidátora a lhůtu pro přihlášení pohledávek u likvidátora (bývá zveřejněna v Obchodním věstníku).', deadlineTitle: 'Přihlášení pohledávky u likvidátora' },
    zanik: { label: 'Zánik', tone: 'bad', action: 'Firma podle ARES zanikla. Ověřte v obchodním rejstříku, kdo je právním nástupcem, a dopad na řízení.' },
    zmena_nazvu: { label: 'Změna názvu', tone: 'info', action: 'Upravte označení účastníka v podáních a kontaktech věci.' },
    katastr_rizeni: { label: 'Katastr: změna řízení', tone: 'warn', action: 'Ověřte v katastru, zda je změna zapsána, a podle ní upravte další postup. Údaje z katastru jsou informativní.' },
    zmena_sidla: { label: 'Změna sídla', tone: 'warn', action: 'Zkontrolujte doručovací adresu a místní příslušnost, případně oznamte změnu soudu.' },
};

const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/[\s,.]+/g, ' ').trim();
export const isLiquidation = (name: string) => /\bv\s+likvidaci\b/i.test(name);
const withoutLiquidation = (name: string) => norm(name.replace(/,?\s*v\s+likvidaci/i, ''));

// Porovnání stavu z ARES s minulým. První kontrola jen zaznamená výchozí stav, ale likvidaci nebo zánik ohlásí hned.
export function aresChanges(prev: Snapshot | null, cur: Snapshot): EventDraft[] {
    const out: EventDraft[] = [];
    if (isLiquidation(cur.name) && !(prev && isLiquidation(prev.name))) out.push({ kind: 'likvidace', ref: 'likvidace', title: `Likvidace: ${cur.name}`, detail: 'Název firmy podle ARES obsahuje „v likvidaci“.', event_date: null });
    if (cur.ended && !(prev && prev.ended)) out.push({ kind: 'zanik', ref: `zanik:${cur.ended}`, title: `Zánik: ${cur.name}`, detail: `Datum zániku podle ARES: ${cur.ended.split('-').reverse().map(Number).join('. ')}.`, event_date: cur.ended });
    if (prev) {
        if (prev.name && cur.name && withoutLiquidation(prev.name) !== withoutLiquidation(cur.name)) out.push({ kind: 'zmena_nazvu', ref: `nazev:${norm(cur.name)}`.slice(0, 300), title: `Změna názvu: ${cur.name}`, detail: `Dříve: ${prev.name}`, event_date: null });
        if (prev.address && cur.address && norm(prev.address) !== norm(cur.address)) out.push({ kind: 'zmena_sidla', ref: `sidlo:${norm(cur.address)}`.slice(0, 300), title: `Změna sídla: ${cur.name}`, detail: `Nové sídlo: ${cur.address}. Dříve: ${prev.address}`, event_date: null });
    }
    return out;
}

// Návrh lhůty k události; u insolvence od data zveřejnění rozhodnutí o úpadku, které advokát ověří a zadá
export function suggestDeadline(kind: RadarKind, fromIso: string | null): (LhutaEnd & { title: string }) | null {
    const info = RADAR_INFO[kind];
    if (!info.deadlineTitle || !info.months || !fromIso || !/^\d{4}-\d{2}-\d{2}$/.test(fromIso)) return null;
    return { ...computeEnd(fromIso, info.months, 'mesic'), title: info.deadlineTitle };
}

export const dueForCheck = (lastIso: string | null | undefined, now = Date.now(), hours = 12) => !lastIso || now - new Date(lastIso).getTime() >= hours * 3_600_000;
