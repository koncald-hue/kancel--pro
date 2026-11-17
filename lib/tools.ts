// Katalog nástrojů a stránek Kanceláře pro hledání podle záměru („chci do katastru“, „zjistit kdo je jednatel“).
// Nejdřív se hledá lokálně podle slov a příbuzných výrazů, AI se zapojí, jen když lokální hledání nic nenajde.
export type Tool = { id: string; name: string; href: string; desc: string; words: string[] };

export const TOOLS: Tool[] = [
    { id: 'prehled', name: 'Přehled', href: '/kancelar', desc: 'Nejbližší lhůty, práce k zapsání, radar a právní novinky.', words: ['dashboard', 'dnes', 'novinky', 'zmeny zakonu', 'nastenka', 'uvod', 'lhuty dnes'] },
    { id: 'veci', name: 'Věci', href: '/kancelar/veci', desc: 'Spisy: soubory, lhůty, chronologie, kontakty, klientská stránka.', words: ['spis', 'kauza', 'pripad', 'nova vec', 'zalozit vec', 'lhuty', 'chronologie'] },
    { id: 'klienti', name: 'Klienti', href: '/kancelar/klienti', desc: 'Adresář klientů, jejich věci, výkazy a insolvenční stav.', words: ['klient', 'zakaznik', 'adresar', 'kontakt', 'novy klient'] },
    { id: 'email', name: 'E-mail', href: '/kancelar/email', desc: 'Čtení a psaní e-mailů, ukládání zpráv a příloh do věcí.', words: ['mail', 'posta', 'gmail', 'seznam', 'odpovedet', 'priloha', 'schranka'] },
    { id: 'schranka', name: 'Datové schránky', href: '/kancelar/schranka', desc: 'Datové zprávy, odeslání podání, lhůty z rozhodnutí.', words: ['datovka', 'isds', 'datova zprava', 'podani', 'odeslat podani', 'soud', 'dorucene', 'mobilni klic'] },
    { id: 'katastr', name: 'Katastr nemovitostí', href: '/kancelar/katastr', desc: 'Parcely a stavby na mapě i podle čísla, údaje o nemovitosti.', words: ['nemovitost', 'pozemek', 'parcela', 'budova', 'list vlastnictvi', 'lv', 'vlastnik', 'cuzk', 'mapa', 'stavba'] },
    { id: 'rejstriky', name: 'Rejstříky (obchodní a živnostenský)', href: '/kancelar/rejstriky', desc: 'Kdo firmu zastupuje, společníci, kapitál, sídlo a živnosti z ARES.', words: ['firma', 'ico', 'jednatel', 'statutar', 'obchodni rejstrik', 'zivnostensky', 'zivnost', 'spolecnik', 'ares', 'sidlo', 'kapital', 'or', 'podnikatel'] },
    { id: 'insolvence', name: 'Insolvence', href: '/kancelar/insolvence', desc: 'Hlídání osob a firem v insolvenčním rejstříku.', words: ['upadek', 'dluznik', 'isir', 'konkurz', 'oddluzeni', 'prihlaska pohledavky', 'hlidani'] },
    { id: 'poptavky', name: 'Poptávky', href: '/kancelar/poptavky', desc: 'Dotazy nových klientů z formuláře kanceláře.', words: ['novy klient', 'dotaz', 'formular', 'prijmout', 'odmitnout'] },
    { id: 'knihovna', name: 'Knihovna vzorů', href: '/kancelar/knihovna', desc: 'Smlouvy, plné moci, výzvy a podání s vyplněnými poli, výstup do Wordu.', words: ['vzor', 'sablona', 'smlouva', 'plna moc', 'dokument', 'word', 'vyzva', 'predzalobni', 'formular'] },
    { id: 'vykazy', name: 'Výkazy práce', href: '/kancelar/vykazy', desc: 'Zápis času, stopky a automatický návrh výkazu.', words: ['cas', 'hodiny', 'odpracovano', 'stopky', 'timesheet', 'zapsat cas', 'vykaz'] },
    { id: 'faktury', name: 'Faktury', href: '/kancelar/faktury', desc: 'Vyúčtování a faktury s QR platbou, upomínky.', words: ['vyuctovani', 'fakturovat', 'qr platba', 'upominka', 'dluh klienta', 'splatnost', 'odmena', 'nezaplatil', 'neplati', 'dluzi', 'pohledavka', 'upomenout'] },
    { id: 'platby', name: 'Platby z banky', href: '/kancelar/platby', desc: 'Příchozí platby, párování s fakturami, upomínky.', words: ['banka', 'fio', 'vypis', 'zaplaceno', 'zaplatil', 'sparovat', 'platba'] },
    { id: 'export', name: 'Export pro účetní', href: '/kancelar/export', desc: 'ZIP s přehledem faktur, DPH a ISDOC pro účetní.', words: ['ucetni', 'dph', 'isdoc', 'pohoda', 'money', 'ucetnictvi', 'kontrolni hlaseni'] },
    { id: 'kalkulacky', name: 'Kalkulačky', href: '/kancelar/kalkulacky', desc: 'Odměna podle advokátního tarifu a úrok z prodlení.', words: ['tarif', 'urok', 'prodleni', 'sazba', 'odmena', 'vypocet', 'repo'] },
    { id: 'import', name: 'Import dat', href: '/kancelar/import', desc: 'Nahrání klientů, věcí, lhůt a času z Excelu, CSV nebo vCard.', words: ['excel', 'csv', 'prenos', 'migrace', 'nahrat data', 'jiny program', 'xlsx'] },
    { id: 'tym', name: 'Tým', href: '/kancelar/tym', desc: 'Kolegové z kanceláře, pozvánky a role.', words: ['kolega', 'pozvat', 'clen', 'kancelar', 'role', 'sdileni'] },
    { id: 'chat', name: 'Chat kanceláře', href: '/kancelar/chat', desc: 'Šifrované zprávy a předávání souborů mezi kolegy.', words: ['zprava kolegovi', 'poslat soubor', 'predat spis', 'sifrovany chat'] },
    { id: 'nastaveni', name: 'Nastavení', href: '/kancelar/nastaveni', desc: 'Profil, fakturační údaje, předplatné, kalendáře a zabezpečení.', words: ['profil', 'predplatne', 'platba', 'ucet', 'heslo', 'sifrovani', 'kalendar', 'google', 'telefon', 'ical', 'fakturacni udaje', 'bankovni ucet'] },
    { id: 'rese', name: 'Právní rešerše (ve věci)', href: '/kancelar/veci', desc: 'Rešerše judikatury a předpisů s AI, otevřete věc a záložku Právní práce.', words: ['reser', 'judikatura', 'rozsudek', 'zakon', 'paragraf', 'ustavni soud', 'directcase', 'najit rozhodnuti'] },
    { id: 'podpisy', name: 'Podpisy a identifikace (ve věci)', href: '/kancelar/veci', desc: 'Podpis dokumentu klientem a identifikace klienta pro AML, ve věci v záložce Klient.', words: ['podpis', 'podepsat', 'aml', 'identifikace', 'totoznost', 'smlouva klient'] },
];

export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Lokální shoda: slova dotazu proti názvu, popisu a příbuzným výrazům. Skóre 0 = nic.
export function matchTools(query: string, tools: Tool[] = TOOLS): { tool: Tool; score: number }[] {
    const q = fold(query); if (q.length < 2) return [];
    const words = q.split(' ').filter((w) => w.length >= 2);
    const stem = (w: string) => (w.length > 5 ? w.slice(0, w.length - 1) : w);
    return tools.map((tool) => {
        const name = fold(tool.name); const desc = fold(tool.desc); const kws = tool.words.map(fold);
        let score = 0;
        if (name.includes(q)) score += 10;
        for (const kw of kws) { if (kw === q) score += 9; else if (q.includes(kw) && kw.length >= 4) score += 6; else if (kw.includes(q) && q.length >= 3) score += 5; }
        for (const w of words) {
            if (w.length < 3) continue;
            const s = stem(w);
            if (name.split(' ').some((x) => x.startsWith(s) || s.startsWith(stem(x)) && x.length >= 4)) score += 4;
            if (kws.some((kw) => kw.split(' ').some((x) => x.length >= 3 && (x.startsWith(s) || s.startsWith(stem(x)) && x.length >= 4)))) score += 3;
            if (desc.split(' ').some((x) => x.length >= 4 && (x.startsWith(s) || s.startsWith(stem(x))))) score += 1;
        }
        return { tool, score };
    }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
}

// Odpověď AI se ověří proti katalogu: povolené jsou jen známé nástroje, nic si nevymyslí
export function validateSuggestions(raw: unknown, tools: Tool[] = TOOLS): { tool: Tool; reason: string }[] {
    const list = (raw as { suggestions?: unknown })?.suggestions;
    if (!Array.isArray(list)) return [];
    const out: { tool: Tool; reason: string }[] = []; const seen = new Set<string>();
    for (const x of list) {
        const id = typeof (x as { id?: unknown })?.id === 'string' ? (x as { id: string }).id : ''; const tool = tools.find((t) => t.id === id);
        if (!tool || seen.has(id)) continue; seen.add(id);
        out.push({ tool, reason: (typeof (x as { reason?: unknown }).reason === 'string' ? (x as { reason: string }).reason : '').trim().slice(0, 160) });
        if (out.length === 3) break;
    }
    return out;
}

export const ASSIST_SYSTEM = 'Jsi nápověda aplikace Kancelář pro české advokáty. Uživatel napsal, co chce udělat nebo najít, ale hledání nic nenašlo. Z přiloženého katalogu vyber nejvýše 3 nástroje nebo stránky, které mu nejlépe pomohou. Vrať JSON {"suggestions":[{"id":"…","reason":"jedna krátká věta česky, proč to pomůže"}]}. Používej jen id z katalogu. Pokud nic nesedí, vrať prázdný seznam. Neodpovídej na právní otázky.';
