import { isEmail } from './mail';

// Hromadný e-mail klientům: každému zvlášť (nikdy společná kopie), s osobním oslovením a kontrolou před odesláním.
export type Recipient = { id: string; name: string; email: string; vec: string };
export const MAX_BULK = 100;
export const PLACEHOLDERS = ['jmeno', 'vec', 'kancelar'] as const;

export function render(text: string, r: Recipient, kancelar: string): string {
    const vars: Record<string, string> = { jmeno: r.name, vec: r.vec, kancelar };
    return text.replace(/\{\s*(\w+)\s*\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}
export const unknownPlaceholders = (text: string) => [...new Set([...text.matchAll(/\{\s*(\w+)\s*\}/g)].map((m) => m[1]).filter((k) => !(PLACEHOLDERS as readonly string[]).includes(k)))];

// Příjemci: jen platné adresy, bez duplicit (stejná adresa dvakrát nedostane e-mail dvakrát)
export function cleanRecipients<T extends { email: string }>(list: T[]): { ok: T[]; invalid: number; duplicates: number } {
    const seen = new Set<string>(); const ok: T[] = []; let invalid = 0, duplicates = 0;
    for (const r of list) {
        const e = r.email.trim().toLowerCase();
        if (!isEmail(e)) { invalid++; continue; }
        if (seen.has(e)) { duplicates++; continue; }
        seen.add(e); ok.push(r);
    }
    return { ok, invalid, duplicates };
}

export const BULK_PRESETS: { id: string; label: string; subject: string; body: string }[] = [
    { id: 'sazba', label: 'Změna sazby', subject: 'Změna hodinové sazby od ______', body: 'Dobrý den,\n\nchtěl(a) bych Vás předem informovat, že od ______ se mění hodinová sazba za právní služby na ______ Kč bez DPH. Na již sjednané paušální odměny se změna nevztahuje.\n\nPokud máte k čemukoli otázky, rád(a) je s Vámi proberu.\n\nS pozdravem\n{kancelar}' },
    { id: 'podklady', label: 'Výzva k doplnění podkladů', subject: 'Doplnění podkladů ve věci {vec}', body: 'Dobrý den,\n\nk Vaší věci „{vec}“ stále potřebuji doplnit tyto podklady:\n\n- \n- \n\nProsím o jejich zaslání do ______, abychom mohli včas postupovat dál.\n\nS pozdravem\n{kancelar}' },
    { id: 'info', label: 'Obecné sdělení', subject: '', body: 'Dobrý den,\n\n\n\nS pozdravem\n{kancelar}' },
];
