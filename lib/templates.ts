import JSZip from 'jszip';
import type { LegalCase } from './cases';
import type { LawyerAccess } from './lawyer';

// Vzory dokumentů s poli. Pole se píše do dvojitých složených závorek: {{klient.jmeno}}.
// Pole, která počítač zná (věc, klient, advokát, datum), se vyplní sama; ostatní (např. {{castka}}) se při vyplňování zeptají.
export type LawyerTemplate = { id: string; user_id: string; title: string; category: string; body: string; shared: boolean; created_at: string; updated_at: string };

export type AutoField = { key: string; label: string; group: 'Klient' | 'Věc' | 'Advokát' | 'Obecné' };
export const AUTO_FIELDS: AutoField[] = [
    { key: 'klient.jmeno', label: 'Jméno klienta', group: 'Klient' },
    { key: 'klient.email', label: 'E-mail klienta', group: 'Klient' },
    { key: 'klient.telefon', label: 'Telefon klienta', group: 'Klient' },
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
export function autoValues(c: Pick<LegalCase, 'title' | 'situation' | 'client_name' | 'client_email' | 'client_phone' | 'reference' | 'authority'> | null, me: Partial<LawyerAccess> | null, now = new Date()): Record<string, string> {
    return {
        'klient.jmeno': c?.client_name ?? '', 'klient.email': c?.client_email ?? '', 'klient.telefon': c?.client_phone ?? '',
        'vec.nazev': c?.title ?? '', 'vec.spisova_znacka': c?.reference ?? '', 'vec.urad': c?.authority ?? '', 'vec.popis': c?.situation ?? '',
        'advokat.jmeno': me?.display_name ?? '', 'advokat.kancelar': me?.firm_name ?? '', 'advokat.cak': me?.bar_number ?? '', 'advokat.adresa': me?.office ?? '',
        'advokat.telefon': me?.phone ?? '', 'advokat.email': me?.contact_email || me?.email || '',
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

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Jednoduchý soubor .docx (každý řádek je odstavec); otevře se ve Wordu i v LibreOffice
export async function buildDocx(text: string): Promise<Blob> {
    const paragraphs = text.replace(/\r\n/g, '\n').split('\n').map((line) => `<w:p><w:r><w:t xml:space="preserve">${esc(line)}</w:t></w:r></w:p>`).join('');
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
