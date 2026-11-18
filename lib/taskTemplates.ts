import { isWeekendOrHoliday } from './workdays';

// Šablony úkolů pro nové věci. Úkol je interní (ne zákonná lhůta), proto se zakládá jako „úkol“ a datum se dá změnit.
export type TemplateItem = { title: string; offset: number; base: 'start' | 'event'; workdays: boolean };
export type CaseTemplate = { id: string; name: string; items: TemplateItem[]; isDefault?: boolean };

export const MAX_ITEMS = 40;
export const MAX_OFFSET = 3650;

const parse = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const isIso = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && fmt(parse(s)) === s;

// Posun o N dní. U pracovních dnů se počítají jen pracovní dny (bez víkendů a svátků), záporný posun jde zpět.
export function shiftDays(iso: string, offset: number, workdays: boolean): string {
    const d = parse(iso);
    if (!workdays) { d.setDate(d.getDate() + offset); return fmt(d); }
    const step = offset < 0 ? -1 : 1;
    let left = Math.abs(offset);
    while (left > 0) { d.setDate(d.getDate() + step); if (!isWeekendOrHoliday(d).isHoliday) left--; }
    // Nula pracovních dnů: nejbližší pracovní den dopředu
    while (offset === 0 && isWeekendOrHoliday(d).isHoliday) d.setDate(d.getDate() + 1);
    return fmt(d);
}

// Termín úkolu; null, když šablona počítá od data události a to věc nemá
export function dueFor(item: TemplateItem, startIso: string, eventIso: string | null): string | null {
    const base = item.base === 'event' ? eventIso : startIso;
    return isIso(base) ? shiftDays(base, item.offset, item.workdays) : null;
}

export function cleanItems(raw: unknown): TemplateItem[] {
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, MAX_ITEMS).flatMap((r) => {
        const o = (r ?? {}) as Record<string, unknown>;
        const title = typeof o.title === 'string' ? o.title.trim().slice(0, 120) : '';
        const offset = Math.trunc(Number(o.offset));
        if (!title || !Number.isFinite(offset) || Math.abs(offset) > MAX_OFFSET) return [];
        return [{ title, offset, base: o.base === 'event' ? 'event' as const : 'start' as const, workdays: o.workdays === true }];
    });
}

// Co se zadá při použití: seznam úkolů s vypočtenými daty a těch, které se nedají spočítat (chybí datum události)
export function planTemplate(items: TemplateItem[], startIso: string, eventIso: string | null) {
    const ready: { title: string; due: string }[] = []; const skipped: string[] = [];
    for (const it of items) { const due = dueFor(it, startIso, eventIso); if (due) ready.push({ title: it.title, due }); else skipped.push(it.title); }
    return { ready, skipped };
}

export const STARTER_TEMPLATES: { name: string; items: TemplateItem[] }[] = [
    { name: 'Nová věc: úvodní kroky', items: [
        { title: 'Podepsat plnou moc a smlouvu o poskytování právních služeb', offset: 1, base: 'start', workdays: true },
        { title: 'Provést identifikaci a kontrolu klienta (AML)', offset: 1, base: 'start', workdays: true },
        { title: 'Vyžádat od klienta podklady', offset: 2, base: 'start', workdays: true },
        { title: 'Poslat klientovi shrnutí dalšího postupu', offset: 7, base: 'start', workdays: true },
    ] },
    { name: 'Soudní řízení: příprava jednání', items: [
        { title: 'Připravit podání a důkazy', offset: -14, base: 'event', workdays: true },
        { title: 'Probrat jednání s klientem', offset: -3, base: 'event', workdays: true },
        { title: 'Zkontrolovat spis před jednáním', offset: -1, base: 'event', workdays: true },
        { title: 'Vyúčtovat hodiny z jednání', offset: 2, base: 'event', workdays: true },
    ] },
];
