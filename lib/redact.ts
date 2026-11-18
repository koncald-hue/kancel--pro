// Zakrytí osobních identifikátorů před odesláním textu poskytovateli AI. Jde o POMŮCKU: pozná čísla s pevným tvarem
// (rodná čísla, účty, IBAN, e-maily, telefony, čísla spisů ponechává). Jména, adresy a popisy osob NEPOZNÁ.
// Advokát proto vždy vidí, co přesně odejde, a může text upravit.
// Rodné číslo: šest číslic s platným měsícem (01-12, 21-32, 51-62, 71-82) a dnem, lomítko, tři nebo čtyři číslice
const validRc = (m: string) => { const d = m.replace(/\D/g, ''); const mm = Number(d.slice(2, 4)) % 50 % 20; const dd = Number(d.slice(4, 6)); return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31; };
// Číslo účtu: (předčíslí-)číslo/kód banky. Čísla spisů typu „123/2024“ se nepovažují za účet (málo číslic, kód banky jako rok)
const validAccount = (m: string) => { const [left, bank] = m.split('/').map((x) => x.replace(/\s/g, '')); const digits = left.replace(/\D/g, ''); return digits.length >= 6 && !(/^(19|20)\d{2}$/.test(bank) && digits.length < 8); };
const RULES: [RegExp, string, ((m: string) => boolean)?][] = [
    [/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/g, '[IBAN]'],
    [/\b\d{6}\s?\/\s?\d{3,4}\b/g, '[RODNÉ ČÍSLO]', validRc],
    [/\b(?:\d{1,6}-)?\d{2,10}\s?\/\s?\d{4}\b(?![.,]\d)/g, '[ÚČET]', validAccount],
    [/[^\s@<>()"';,]+@[^\s@<>()"';,]+\.[^\s@<>()"';,]+/g, '[E-MAIL]'],
    [/(?:\+|00)\s?\d{3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{3}\b/g, '[TELEFON]'],
    [/(?<![\d/])\d{3}[\s.-]\d{3}[\s.-]\d{3}(?![\d/])/g, '[TELEFON]'],
    [/\b(?:OP|pas|cestovní doklad|číslo dokladu)\s*(?:č\.?|číslo)?\s*[A-Z]{0,2}\s?\d{6,9}\b/gi, '[DOKLAD]'],
];
export function redact(text: string): { text: string; count: number } {
    let count = 0; let out = text;
    for (const [re, label, ok] of RULES) out = out.replace(re, (m) => { if (ok && !ok(m)) return m; count += 1; return label; });
    return { text: out, count };
}
export const AI_MAX_CHARS = 12_000;
