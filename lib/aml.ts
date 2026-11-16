// Identifikace klienta pro zákon č. 253/2008 Sb. Jen pomocné funkce; rozhodnutí, zda a jak identifikovat, zůstává na advokátovi.
export type Ident = { method: 'bankid' | 'osobne' | 'jine'; status: 'requested' | 'verified_online' | 'draft' | 'confirmed'; full_name: string; birth_date: string | null; address: string; doc_type: string; doc_number: string; doc_expires: string | null; is_company: boolean; company_ico: string; beneficial_owner: string; pep: 'ne' | 'ano' | 'nevim'; pep_note: string; risk: 'nizke' | 'standardni' | 'vysoke'; purpose: string; online_result: unknown };

export const METHOD_LABEL: Record<Ident['method'], string> = { bankid: 'Online přes Bank iD', osobne: 'Osobně, podle dokladu totožnosti', jine: 'Jiným způsobem' };
export const STATUS_LABEL: Record<Ident['status'], string> = { requested: 'Čeká na klienta', verified_online: 'Klient ověřen online, čeká na potvrzení', draft: 'Rozpracováno', confirmed: 'Potvrzeno' };

// Co chybí, aby šlo identifikaci potvrdit. Prázdný seznam = lze potvrdit.
export function missingForConfirm(i: Ident, today = new Date().toISOString().slice(0, 10)): string[] {
    const out: string[] = [];
    if (i.full_name.trim().length < 3) out.push('jméno a příjmení');
    if (!i.birth_date && !i.is_company) out.push('datum narození');
    if (i.address.trim().length < 5) out.push('adresa');
    if (i.method === 'osobne') {
        if (!i.doc_type.trim()) out.push('druh dokladu totožnosti');
        if (!i.doc_number.trim()) out.push('číslo dokladu');
        if (!i.doc_expires) out.push('platnost dokladu');
        else if (i.doc_expires < today) out.push('doklad je prošlý');
    }
    if (i.method === 'bankid' && !i.online_result) out.push('klient zatím neprovedl ověření');
    if (i.is_company && i.beneficial_owner.trim().length < 3) out.push('skutečný majitel');
    if (i.pep === 'nevim') out.push('posouzení politicky exponované osoby');
    if (i.pep === 'ano' && i.risk === 'nizke') out.push('u politicky exponované osoby nelze zvolit nízké riziko');
    if (i.purpose.trim().length < 3) out.push('účel a povaha obchodního vztahu');
    return out;
}

// Doporučená lhůta pro nové posouzení: u vyššího rizika dříve (jen návrh, advokát ji může změnit)
export function suggestReview(risk: Ident['risk'], from = new Date()): string {
    const d = new Date(from); d.setUTCFullYear(d.getUTCFullYear() + (risk === 'vysoke' ? 1 : risk === 'standardni' ? 2 : 3));
    return d.toISOString().slice(0, 10);
}
