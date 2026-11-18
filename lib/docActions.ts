import { shiftDays } from './taskTemplates';

// Kroky po přijetí dokumentu nebo e-mailu: čas, úkol s termínem odpovědi, návrh odpovědi.
// Čas se počítá po šestiminutových jednotkách (0,1 h), minimum jedna jednotka; pozorné čtení právního textu zhruba 100 slov za minutu.
export function readMinutes(words: number): number { return Math.max(6, Math.ceil(Math.max(0, words) / 100 / 6) * 6); }
export const replyDue = (todayIso: string, workdays = 3) => shiftDays(todayIso, workdays, true);
export const countWords = (t: string) => (t.trim().match(/\S+/g) ?? []).length;

export type ReplyCtx = { name: string; subject: string; caseTitle: string; reference: string; signature: string };
export type ReplyDraft = { id: string; label: string; body: string };
export function replyDrafts(c: ReplyCtx): ReplyDraft[] {
    const hello = c.name ? `Dobrý den, ${c.name},` : 'Dobrý den,'; const ref = c.reference ? ` (sp. zn. ${c.reference})` : '';
    const bye = `\n\nS pozdravem\n${c.signature}`;
    return [
        { id: 'prijeti', label: 'Potvrzení přijetí', body: `${hello}\n\nděkuji za Vaši zprávu${ref}. Potvrzuji její přijetí a ozvu se Vám s dalším postupem co nejdříve, nejpozději do tří pracovních dnů.${bye}` },
        { id: 'podklady', label: 'Vyžádání podkladů', body: `${hello}\n\nk věci „${c.caseTitle}“${ref} potřebuji pro další postup doplnit tyto podklady:\n\n- \n- \n\nProsím o jejich zaslání do ______. Bez nich nemohu postupovat dál.${bye}` },
        { id: 'cas', label: 'Potřebuji čas', body: `${hello}\n\nděkuji za zprávu${ref}. Věc vyžaduje podrobnější prostudování, proto Vám odpovím až po jeho dokončení, nejpozději do ______.${bye}` },
    ];
}
