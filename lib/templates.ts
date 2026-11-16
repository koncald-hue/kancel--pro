import { buildRichDocx, type DocxOptions } from './docx';
import type { LegalCase } from './cases';
import type { LawyerAccess } from './lawyer';

// Vzory dokumentů s poli. Pole se píše do dvojitých složených závorek: {{klient.jmeno}}.
// Pole, která počítač zná (věc, klient, advokát, datum), se vyplní sama; ostatní (např. {{castka}}) se při vyplňování zeptají.
export type LawyerTemplate = { id: string; user_id: string; title: string; category: string; body: string; shared: boolean; created_at: string; updated_at: string; note?: string; starter_id?: string | null };

export type AutoField = { key: string; label: string; group: 'Klient' | 'Věc' | 'Advokát' | 'Obecné' };
export const AUTO_FIELDS: AutoField[] = [
    { key: 'klient.jmeno', label: 'Jméno klienta', group: 'Klient' },
    { key: 'klient.email', label: 'E-mail klienta', group: 'Klient' },
    { key: 'klient.telefon', label: 'Telefon klienta', group: 'Klient' },
    { key: 'klient.adresa', label: 'Adresa / sídlo klienta', group: 'Klient' },
    { key: 'klient.ico', label: 'IČO klienta', group: 'Klient' },
    { key: 'klient.identifikace', label: 'IČO, nebo datum narození klienta', group: 'Klient' },
    { key: 'klient.narozeni', label: 'Datum narození klienta', group: 'Klient' },
    { key: 'klient.dic', label: 'DIČ klienta', group: 'Klient' },
    { key: 'vec.nazev', label: 'Název věci', group: 'Věc' },
    { key: 'vec.spisova_znacka', label: 'Spisová značka / číslo jednací', group: 'Věc' },
    { key: 'vec.urad', label: 'Soud nebo úřad', group: 'Věc' },
    { key: 'vec.popis', label: 'Popis věci', group: 'Věc' },
    { key: 'advokat.jmeno', label: 'Jméno advokáta', group: 'Advokát' },
    { key: 'advokat.kancelar', label: 'Název kanceláře', group: 'Advokát' },
    { key: 'advokat.cak', label: 'Evidenční číslo ČAK', group: 'Advokát' },
    { key: 'advokat.adresa', label: 'Adresa kanceláře', group: 'Advokát' },
    { key: 'advokat.telefon', label: 'Telefon advokáta', group: 'Advokát' },
    { key: 'advokat.email', label: 'E-mail advokáta', group: 'Advokát' },
    { key: 'advokat.ico', label: 'IČO advokáta', group: 'Advokát' },
    { key: 'advokat.ucet', label: 'Číslo účtu advokáta', group: 'Advokát' },
    { key: 'datum', label: 'Dnešní datum', group: 'Obecné' },
];
const AUTO_KEYS = new Set(AUTO_FIELDS.map((f) => f.key));

const FIELD_RE = /\{\{\s*([^{}\n]{1,60}?)\s*\}\}/g;
const norm = (key: string) => key.trim();
const isAuto = (key: string) => AUTO_KEYS.has(key.toLowerCase());

// Všechna pole použitá v textu, bez opakování, v pořadí prvního výskytu
export function fieldsIn(body: string): { auto: string[]; custom: string[] } {
    const auto: string[] = []; const custom: string[] = [];
    for (const m of body.matchAll(FIELD_RE)) {
        const key = norm(m[1]);
        if (isAuto(key)) { if (!auto.includes(key.toLowerCase())) auto.push(key.toLowerCase()); }
        else if (!custom.some((c) => c.toLowerCase() === key.toLowerCase())) custom.push(key);
    }
    return { auto, custom };
}

export const customLabel = (key: string) => { const s = key.replace(/_/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); };

export const todayCs = (d = new Date()) => `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;

// Hodnoty automatických polí z věci a profilu advokáta (co se neví, zůstane prázdné a pole se nechá viditelné)
export function autoValues(c: Pick<LegalCase, 'title' | 'situation' | 'client_name' | 'client_email' | 'client_phone' | 'reference' | 'authority'> | null, me: Partial<LawyerAccess> | null, now = new Date(), client?: { address?: string; ico?: string; dic?: string; birth?: string | null } | null): Record<string, string> {
    return {
        'klient.jmeno': c?.client_name ?? '', 'klient.email': c?.client_email ?? '', 'klient.telefon': c?.client_phone ?? '', 'klient.adresa': client?.address ?? '', 'klient.ico': client?.ico ?? '', 'klient.dic': client?.dic ?? '', 'klient.narozeni': client?.birth ? todayCs(new Date(`${client.birth}T12:00:00`)) : '', 'klient.identifikace': client?.ico ? `IČO ${client.ico}` : client?.birth ? `nar. ${todayCs(new Date(`${client.birth}T12:00:00`))}` : '',
        'vec.nazev': c?.title ?? '', 'vec.spisova_znacka': c?.reference ?? '', 'vec.urad': c?.authority ?? '', 'vec.popis': c?.situation ?? '',
        'advokat.jmeno': me?.display_name ?? '', 'advokat.kancelar': me?.firm_name ?? '', 'advokat.cak': me?.bar_number ?? '', 'advokat.adresa': me?.office ?? '',
        'advokat.ico': me?.ico ?? '', 'advokat.ucet': me?.bank_account ?? '', 'advokat.telefon': me?.phone ?? '', 'advokat.email': me?.contact_email || me?.email || '',
        datum: todayCs(now),
    };
}

// Dosadí hodnoty; pole bez hodnoty zůstane v textu jako {{pole}}, aby bylo vidět, co zbývá doplnit
export function fillTemplate(body: string, auto: Record<string, string>, custom: Record<string, string>): string {
    const customLower = Object.fromEntries(Object.entries(custom).map(([k, v]) => [k.toLowerCase(), v]));
    return body.replace(FIELD_RE, (whole, raw: string) => {
        const key = norm(raw).toLowerCase();
        const value = isAuto(key) ? auto[key] : customLower[key];
        return value && value.trim() ? value : whole;
    });
}

export const missingFields = (filled: string) => fieldsIn(filled);

// Soubor .docx s úpravou stránky, písmem, číslováním stránek a jednoduchým značením (viz lib/docx.ts); otevře se ve Wordu i v LibreOffice
export const buildDocx = (text: string, opt?: DocxOptions): Promise<Blob> => buildRichDocx(text, opt);
