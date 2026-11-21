// E-maily zkušebním uživatelům: po 2. a po 5. dni od registrace, podle toho, kam až se dostali. Čisté funkce.
export type NudgeKind = 'day2' | 'day5';
const DAY = 86_400_000;

// Který e-mail se má poslat? Jen zkušebním uživatelům; pozdě se nic nedohání (po 12. dni už ne).
export function planNudge(r: { status: string; created_at: string; nudge_day2_at: string | null; nudge_day5_at: string | null }, now = new Date()): NudgeKind | null {
    if (r.status !== 'trial') return null;
    const age = (now.getTime() - new Date(r.created_at).getTime()) / DAY;
    if (age >= 5 && age < 12 && !r.nudge_day5_at) return 'day5';
    if (age >= 2 && age < 5 && !r.nudge_day2_at) return 'day2';
    return null;
}

export type Progress = { cases: number; clients: number; links: number; time: number };

// Další krok podle toho, co už uživatel udělal
export function nextStep(p: Progress): { text: string; path: string } {
    if (p.cases === 0) return { text: 'Založte první spis. Když nechcete nic vyplňovat, v Přehledu je tlačítko „Ukázkový spis“, které ho naplní za vás.', path: '/kancelar/veci' };
    if (p.clients === 0) return { text: 'Přidejte prvního klienta, nebo nahrajte celý seznam z Excelu v části Import.', path: '/kancelar/klienti' };
    if (p.links === 0) return { text: 'Pošlete klientovi soukromý odkaz. Nahraje podklady a napíše zprávu bez registrace a bez posílání příloh e-mailem.', path: '/kancelar/veci' };
    if (p.time === 0) return { text: 'Zapište první čas. Stačí klávesa N, odkudkoli v aplikaci. Kancelář z něj pak připraví vyúčtování.', path: '/kancelar' };
    return { text: 'Zkuste poslat klientovi dokument k podpisu, nebo si nechte spočítat lhůtu u svého nejbližšího jednání.', path: '/kancelar/veci' };
}

export function buildNudge(kind: NudgeKind, i: { name: string; progress: Progress; daysLeft: number | null; appUrl: string }): { subject: string; text: string } {
    const step = nextStep(i.progress);
    const hello = i.name ? `Dobrý den, ${i.name},` : 'Dobrý den,';
    const link = i.appUrl ? `${i.appUrl.replace(/\/$/, '')}${step.path}` : '';
    const started = i.progress.cases + i.progress.clients > 0;
    if (kind === 'day2') {
        return {
            subject: 'Jak se vám daří s Kanceláří Pro?',
            text: [hello, '', started ? 'vidím, že jste s Kanceláří Pro začal(a) pracovat. Skvělé. Aby vám co nejdřív začala šetřit čas, doporučuji tento další krok:' : 'zkušební přístup do Kanceláře Pro máte založený, ale zatím jste v ní moc nepracoval(a). Nejrychlejší začátek je tento:', '', step.text, ...(link ? ['', link] : []), '', 'Kdyby cokoli nešlo nebo vám něco chybělo, stačí odpovědět na tento e-mail. Čtu ho osobně.', '', 'Kancelář Pro'].join('\n'),
        };
    }
    const left = i.daysLeft !== null && i.daysLeft >= 0 ? `Zkušební doba vám končí za ${i.daysLeft} ${i.daysLeft === 1 ? 'den' : i.daysLeft >= 2 && i.daysLeft <= 4 ? 'dny' : 'dní'}.` : '';
    return {
        subject: left ? `Zkušební doba Kanceláře Pro: ${left.replace('Zkušební doba vám končí ', 'zbývá ').replace(/\.$/, '')}` : 'Zkušební doba Kanceláře Pro',
        text: [hello, '', left, 'Pokud jste Kancelář ještě nestihl(a) vyzkoušet naplno, zkuste dnes tento krok:', '', step.text, ...(link ? ['', link] : []), '', 'Nezapomeňte, že zkušební doba nevyžaduje kartu a nic se neobnovuje samo. Pokud vám něco brání, napište mi. Opravím to, nebo vám pomohu s nastavením.', '', 'Kancelář Pro'].filter((l, idx, a) => !(l === '' && a[idx - 1] === '' )).join('\n'),
    };
}
