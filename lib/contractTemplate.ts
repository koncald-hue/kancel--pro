// Smlouva o poskytování právních služeb předvyplněná z karty klienta a z profilu advokáta.
// Čisté funkce: z údajů vznikne text (nadpis, články), který se vykreslí do PDF a pošle klientovi k podpisu.
import type { LawyerAccess, LawyerClient } from './lawyer';

export type ContractCase = { title: string; reference?: string; authority?: string; situation?: string };
export type ContractInput = { lawyer: Partial<LawyerAccess>; client: Pick<LawyerClient, 'name' | 'email' | 'phone' | 'hourly_rate'> & Partial<LawyerClient>; item: ContractCase; date?: Date };

const czk = (n: number) => `${Math.round(n).toLocaleString('cs-CZ').replace(/ /g, ' ')} Kč`;
const dateCz = (d: Date) => `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
const birthCz = (b?: string | null) => (b && /^\d{4}-\d{2}-\d{2}$/.test(b) ? `, nar. ${b.split('-').reverse().map(Number).join('. ')}` : '');
const dash = (s: string | undefined | null, fallback: string) => (s && s.trim() ? s.trim() : fallback);

// Chybějící údaje, bez kterých by smlouva byla neúplná; zobrazí se advokátovi před odesláním
export function missingContractData(i: ContractInput): string[] {
    const out: string[] = [];
    if (!(i.lawyer.display_name ?? '').trim()) out.push('jméno advokáta (profil)');
    if (!(i.lawyer.office ?? '').trim()) out.push('adresa kanceláře (profil)');
    if (!(i.client.name ?? '').trim()) out.push('jméno klienta');
    if (!(i.client.address ?? '').trim()) out.push('adresa klienta (karta klienta)');
    if (!(i.client.hourly_rate ?? i.lawyer.default_rate)) out.push('hodinová sazba');
    return out;
}

export function buildContract(i: ContractInput): { title: string; lines: string[] } {
    const { lawyer: l, client: c, item } = i;
    const date = i.date ?? new Date();
    const rate = c.hourly_rate ?? l.default_rate ?? 0;
    const lawyerLine = [dash(l.display_name, '[jméno advokáta]'), l.bar_number ? `advokát evidovaný v seznamu ČAK pod ev. č. ${l.bar_number}` : 'advokát', `se sídlem kanceláře ${dash(l.office, '[adresa kanceláře]')}`, l.ico ? `IČO ${l.ico}` : ''].filter(Boolean).join(', ');
    const clientLine = [dash(c.name, '[jméno klienta]'), c.birth ? birthCz(c.birth).slice(2) : '', c.ico ? `IČO ${c.ico}` : '', `bytem / se sídlem ${dash(c.address, '[adresa klienta]')}`].filter(Boolean).join(', ');
    const subject = [item.title.trim(), item.reference ? `sp. zn. / č. j. ${item.reference}` : '', item.authority ? `před orgánem ${item.authority}` : ''].filter(Boolean).join(', ');
    const vat = l.vat_payer ? 'K odměně se připočítá daň z přidané hodnoty v zákonné výši.' : 'Advokát není plátcem daně z přidané hodnoty.';
    const lines = [
        'SMLOUVA O POSKYTOVÁNÍ PRÁVNÍCH SLUŽEB',
        '',
        'uzavřená podle zákona č. 85/1996 Sb., o advokacii, a občanského zákoníku',
        '',
        'I. Smluvní strany',
        `Advokát: ${lawyerLine} (dále jen „advokát“)`,
        `Klient: ${clientLine} (dále jen „klient“)`,
        '',
        'II. Předmět smlouvy',
        `1. Advokát se zavazuje poskytovat klientovi právní služby ve věci: ${subject}.`,
        '2. Rozsah služeb tvoří zejména právní porada, zastupování klienta, příprava a podávání písemností a jednání s protistranou, soudy a úřady v rámci uvedené věci. Služby nad tento rozsah se poskytnou po dohodě smluvních stran.',
        '3. Advokát nezaručuje výsledek věci. Postupuje s odbornou péčí a v zájmu klienta v mezích právních předpisů a pravidel profesní etiky.',
        '',
        'III. Odměna a náklady',
        `1. Klient je povinen platit advokátovi odměnu ve výši ${rate > 0 ? czk(rate) : '[sazba]'} za každou započatou hodinu práce, vykazovanou v minutových přesnostech. ${vat}`,
        '2. K odměně se přičítají hotové výdaje a náhrady (např. soudní a správní poplatky, cestovné, znalečné), které advokát v zájmu klienta vynaložil.',
        '3. Advokát vyúčtuje odměnu a náklady daňovým dokladem se splatností uvedenou na dokladu. Může požadovat přiměřenou zálohu.',
        '4. Náhrada nákladů řízení přiznaná klientovi protistranou nebo státem nemá vliv na nárok advokáta na odměnu podle této smlouvy.',
        '',
        'IV. Práva a povinnosti',
        '1. Advokát je povinen zachovávat mlčenlivost o všem, co se při poskytování právních služeb dozvěděl, a to i po skončení smlouvy, a je pojištěn pro případ odpovědnosti za škodu v rozsahu požadovaném zákonem o advokacii.',
        '2. Klient je povinen poskytovat advokátovi pravdivé a úplné informace a podklady, dostavit se na sjednané schůzky a jednat včas, zejména dodržovat lhůty, o kterých ho advokát upozornil.',
        '3. Klient bere na vědomí, že advokát je povinen postupovat podle pokynů klienta, nejsou-li v rozporu s právními předpisy; jednání v rozporu s předpisy a pravidly profesní etiky advokát odmítne.',
        '',
        'V. Identifikace klienta a ochrana osobních údajů',
        '1. Advokát je povinnou osobou podle zákona č. 253/2008 Sb. a je povinen klienta identifikovat a provést jeho kontrolu. Klient se zavazuje k tomu poskytnout potřebnou součinnost a pravdivé údaje.',
        '2. Osobní údaje klienta zpracovává advokát jako správce v rozsahu nezbytném pro plnění této smlouvy a plnění zákonných povinností. Podrobné informace o zpracování poskytne advokát na žádost klienta.',
        '3. Klient souhlasí s komunikací s advokátem elektronicky, včetně klientského portálu a e-mailu, a bere na vědomí rizika takové komunikace.',
        '',
        'VI. Trvání a ukončení smlouvy',
        '1. Smlouva se uzavírá na dobu vyřízení věci podle článku II. Každá ze smluvních stran může smlouvu kdykoli písemně vypovědět; výpověď je účinná doručením druhé straně.',
        '2. Advokát je při výpovědi povinen učinit nezbytné úkony, aby klient neutrpěl újmu, a to po dobu, kterou zákon stanoví. Odměna za dosud provedené práce a náklady zůstává splatná.',
        '',
        'VII. Závěrečná ustanovení',
        '1. Smlouva se řídí právním řádem České republiky. Změnit ji lze jen písemným dodatkem.',
        '2. Smlouva je podepsána elektronicky; klient podpisem potvrzuje, že si ji přečetl, rozumí jí a souhlasí s ní. Smlouva nabývá účinnosti dnem podpisu klienta.',
        '',
        `Datum vyhotovení: ${dateCz(date)}`,
        '',
        `Advokát: ${dash(l.display_name, '[jméno advokáta]')}`,
        `Klient: ${dash(c.name, '[jméno klienta]')}`,
    ];
    return { title: 'Smlouva o poskytování právních služeb', lines };
}
