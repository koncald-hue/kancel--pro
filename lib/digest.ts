// Týdenní souhrn e-mailem. Text se skládá jen z dat, která dostane; žádné tajné odkazy ani obsah zpráv.
// Varianta bez detailů obsahuje jen počty (e-mail jde přes poskytovatele rozesílky, proto je výchozí).
export type DigestDeadline = { title: string; due_date: string; case_title: string; kind: 'lhuta' | 'ukol' };
export type DigestInput = {
    name: string; today: string; details: boolean; appUrl: string;
    overdue: DigestDeadline[]; upcoming: DigestDeadline[];
    caseEvents: { case_title: string; count: number }[];
    unbilledMinutes: number; unbilledAmount: number; overdueInvoices: number; newInquiries: number;
    substituting: { name: string; to_on: string; deadlines: number }[];
    archiveExpired: number; deliveriesPending: number;
};

const dmy = (iso: string) => `${Number(iso.slice(8, 10))}. ${Number(iso.slice(5, 7))}.`;
const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`;
const czk = (n: number) => `${new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(Math.round(n))} Kč`;
const plural = (n: number, one: string, few: string, many: string) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;

export function hasAnything(d: DigestInput): boolean {
    return d.overdue.length + d.upcoming.length + d.caseEvents.length + d.overdueInvoices + d.newInquiries + d.substituting.length + d.archiveExpired + d.deliveriesPending > 0 || d.unbilledMinutes > 0;
}

export function buildDigest(d: DigestInput): { subject: string; text: string } {
    const L: string[] = [];
    const head = d.overdue.length ? `${plural(d.overdue.length, 'lhůta nebo úkol', 'lhůty nebo úkoly', 'lhůt nebo úkolů')} po termínu` : d.upcoming.length ? `${plural(d.upcoming.length, 'termín', 'termíny', 'termínů')} na příštích 7 dní` : 'přehled týdne';
    const subject = `Kancelář Pro: ${head}`;
    L.push(`Dobrý den${d.name ? `, ${d.name}` : ''},`, '', `přehled k ${dmy(d.today)} ${d.today.slice(0, 4)}:`, '');
    const list = (items: DigestDeadline[]) => items.slice(0, 15).map((x) => `  • ${dmy(x.due_date)} ${x.kind === 'ukol' ? 'úkol' : 'lhůta'}: ${x.title} (${x.case_title})`).concat(items.length > 15 ? [`  • … a dalších ${items.length - 15}`] : []);
    if (d.overdue.length) { L.push(`PO TERMÍNU: ${d.overdue.length}`); if (d.details) L.push(...list(d.overdue)); L.push(''); }
    L.push(`Termíny na příštích 7 dní: ${d.upcoming.length}`); if (d.details && d.upcoming.length) L.push(...list(d.upcoming)); L.push('');
    if (d.substituting.length) { L.push('Zastupujete:'); for (const s of d.substituting) L.push(`  • ${s.name} do ${dmy(s.to_on)}: ${plural(s.deadlines, 'termín', 'termíny', 'termínů')} na 7 dní`); L.push(''); }
    const ev = d.caseEvents.reduce((s, x) => s + x.count, 0);
    L.push(`Nové záznamy ve věcech za týden: ${ev}${d.caseEvents.length ? ` (${plural(d.caseEvents.length, 'věc', 'věci', 'věcí')})` : ''}`);
    if (d.details && d.caseEvents.length) L.push(...d.caseEvents.slice(0, 10).map((x) => `  • ${x.case_title}: ${x.count}`));
    L.push('');
    if (d.unbilledMinutes > 0) L.push(`Nevyfakturovaná práce: ${hm(d.unbilledMinutes)}${d.unbilledAmount ? ` (${czk(d.unbilledAmount)})` : ''}`);
    if (d.overdueInvoices) L.push(`Faktury po splatnosti: ${d.overdueInvoices}`);
    if (d.newInquiries) L.push(`Nové poptávky: ${d.newInquiries}`);
    if (d.deliveriesPending) L.push(`Odeslaná pošta bez potvrzeného doručení: ${d.deliveriesPending}`);
    if (d.archiveExpired) L.push(`Spisy s uplynulou lhůtou uložení: ${d.archiveExpired}`);
    L.push('', ...(d.appUrl ? [`Podrobnosti v Kanceláři: ${d.appUrl}/kancelar`, ''] : []), 'Souhrn vypnete v Nastavení → Týdenní souhrn.', 'Termíny jsou pomůcka, rozhoduje ověření ve spisu.');
    return { subject, text: L.join('\n') };
}

// Klientovi jen to, že se ve věci něco stalo; obsah ani odkaz se do e-mailu nedávají (odkaz má klient od advokáta)
export function buildClientDigest(o: { who: string; news: number; tasks: number }): { subject: string; text: string } | null {
    if (o.news + o.tasks === 0) return null;
    const parts = [o.news ? plural(o.news, 'nová informace', 'nové informace', 'nových informací') : '', o.tasks ? plural(o.tasks, 'úkol pro Vás', 'úkoly pro Vás', 'úkolů pro Vás') : ''].filter(Boolean).join(' a ');
    return { subject: 'Týdenní přehled Vaší věci', text: `Dobrý den,\n\nve Vaší věci je za poslední týden ${parts}. Podrobnosti najdete na své stránce přes soukromý odkaz, který Vám poslal(a) ${o.who}.\n\nTento e-mail neobsahuje žádné údaje o věci. Pokud ho nechcete dostávat, dejte vědět svému advokátovi.` };
}
