// Anonymizér: nahradí osobní údaje v textu číslovanými značkami ([Osoba 1], [Rodné číslo 1] …) a umí je vrátit zpět.
// Celé se děje v prohlížeči, text ani tabulka nahrazení nikam neodchází a neukládají se. Stejná hodnota dostane vždy stejnou značku,
// takže AI i čtenář rozliší, kdo je kdo. Jména nejsou poznatelná jistě: nabízí se kandidáti a advokát je potvrdí.

export type Kind = 'Osoba' | 'Rodné číslo' | 'Účet' | 'IBAN' | 'E-mail' | 'Telefon' | 'Doklad' | 'IČO' | 'DIČ' | 'Datum narození' | 'Adresa';
export type Entity = { kind: Kind; value: string };
export type Anonymized = { text: string; map: Record<string, string>; counts: Partial<Record<Kind, number>> };

const validRc = (m: string) => { const d = m.replace(/\D/g, ''); if (d.length < 9) return false; const mm = Number(d.slice(2, 4)) % 50 % 20; const dd = Number(d.slice(4, 6)); return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31; };
const validAccount = (m: string) => { const [left, bank] = m.split('/').map((x) => x.replace(/\s/g, '')); return left.replace(/\D/g, '').length >= 6 && !/^(19|20)\d{2}$/.test(bank ?? ''); };

// Pořadí je důležité: delší a přesnější tvary dřív, aby je nerozbilo něco obecnějšího
const RULES: [Kind, RegExp, ((m: string) => boolean)?][] = [
    ['IBAN', /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/g],
    ['Rodné číslo', /\b\d{6}\s?\/\s?\d{3,4}\b/g, validRc],
    ['Účet', /\b(?:\d{1,6}-)?\d{2,10}\s?\/\s?\d{4}\b(?![.,]\d)/g, validAccount],
    ['E-mail', /[\p{L}\d._%+-]+@[\p{L}\d-]+(?:\.[\p{L}\d-]+)+/gu],
    ['Datum narození', /\b(?:nar\.|narozen[aáý]?)\s*(?:dne\s*)?\d{1,2}\.\s*\d{1,2}\.\s*\d{4}/gi],
    ['Doklad', /\b(?:OP|pas|cestovní doklad|číslo dokladu)\s*(?:č\.?|číslo)?\s*[A-Z]{0,2}\s?\d{6,9}\b/gi],
    ['IČO', /\bIČO?\s*:?\s*\d{8}\b/gi],
    ['DIČ', /\bDIČ\s*:?\s*[A-Z]{2}\d{8,10}\b/gi],
    ['Telefon', /(?:\+|00)\s?\d{3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{3}\b/g],
    ['Telefon', /(?<![\d/])\d{3}[\s.-]\d{3}[\s.-]\d{3}(?![\d/])/g],
    // Adresa: ulice s číslem popisným, PSČ a obec („Dlouhá 12, 110 00 Praha 1“)
    ['Adresa', /\b\p{Lu}[\p{L}.\- ]{2,40}\s\d{1,4}(?:\/\d{1,4})?[a-z]?,\s*\d{3}\s?\d{2}\s+\p{Lu}[\p{L}\-]{1,30}(?:\s\p{Lu}[\p{L}\-]{2,30})?(?:\s\d{1,2}\b)?/gu],
];

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TITLES = /^(?:JUDr|Mgr|Ing|Bc|MUDr|Ph\.?D|CSc|DiS|MBA|Dr|prof|doc)\.?$/i;
// Jména se skloňují: hledá se kmen slova (bez posledního písmene u delších slov) a libovolná koncovka
const stem = (t: string) => t.slice(0, t.length > 4 ? t.length - 1 : t.length);

// Slova, která začínají velkým písmenem, ale jméno osoby nejsou
const STOP = new Set(['Praha', 'Brno', 'Ostrava', 'Plzeň', 'Olomouc', 'Liberec', 'Zlín', 'Smlouva', 'Žaloba', 'Soud', 'Okresní', 'Krajský', 'Nejvyšší', 'Městský', 'Vrchní', 'Ústavní', 'Česká', 'České', 'Republika', 'Republiky', 'Občanský', 'Zákoník', 'Zákon', 'Trestní', 'Dne', 'Čl', 'Kč', 'Sb', 'Žalobce', 'Žalovaný', 'Žalovaná', 'Navrhovatel', 'Odpůrce', 'Poškozený', 'Obviněný', 'Pan', 'Paní', 'Firma', 'Společnost', 'Banka']);
const NAME_RE = /(?<![\p{L}])(?:\p{Lu}\p{Ll}{2,})(?:\s+(?:\p{Lu}\p{Ll}{2,})){1,2}(?![\p{L}])/gu;

// Kandidáti na jména osob: dvě až tři slova s velkým písmenem za sebou, bez místních a obecných názvů. Je to jen nabídka k potvrzení.
export function suggestNames(text: string): string[] {
    const seen = new Set<string>();
    for (const m of text.matchAll(NAME_RE)) {
        const words = m[0].split(/\s+/);
        if (words.some((w) => STOP.has(w) || TITLES.test(w))) continue;
        seen.add(words.join(' '));
    }
    return [...seen].slice(0, 40);
}

export function anonymizeText(input: string, people: string[] = []): Anonymized {
    const map: Record<string, string> = {}; // značka -> původní hodnota
    const byValue = new Map<string, string>(); // druh|hodnota -> značka
    const counters: Partial<Record<Kind, number>> = {};
    const tag = (kind: Kind, value: string) => {
        const k = `${kind}|${value.toLowerCase().replace(/\s+/g, ' ')}`;
        const known = byValue.get(k);
        if (known) return known;
        counters[kind] = (counters[kind] ?? 0) + 1;
        const t = `[${kind} ${counters[kind]}]`;
        byValue.set(k, t); map[t] = value;
        return t;
    };
    let text = input;
    // Jména osob nejdřív, ať je nepřebijí obecná pravidla; celé jméno i samotné příjmení patří stejné osobě
    people.map((p) => p.trim()).filter((p) => p.length > 2).forEach((full) => {
        const tokens = full.split(/\s+/).filter((t) => /^\p{L}[\p{L}.-]{2,}$/u.test(t) && !TITLES.test(t));
        if (!tokens.length) return;
        const label = () => tag('Osoba', full);
        const whole = new RegExp(`(?<![\\p{L}])${tokens.map((t) => `${esc(stem(t))}\\p{L}*`).join('\\s+')}(?![\\p{L}])`, 'giu');
        text = text.replace(whole, () => label());
        // Samotné příjmení (poslední slovo) a jméno; krátká slova (do 3 znaků) se nenahrazují, aby nešla rozbít běžná slova
        for (const t of [...tokens].reverse()) { if (t.length < 4) continue; text = text.replace(new RegExp(`(?<![\\p{L}])${esc(stem(t))}\\p{L}*`, 'giu'), () => label()); }
    });
    for (const [kind, re, ok] of RULES) text = text.replace(re, (m) => (ok && !ok(m) ? m : tag(kind, m)));
    return { text, map, counts: counters };
}

// Vrátí původní hodnoty za značky (např. v odpovědi od AI). Značky bez záznamu zůstanou, jak jsou.
export function restoreText(text: string, map: Record<string, string>): string {
    return text.replace(/\[[^\[\]\d]+ \d+\]/g, (t) => map[t] ?? t);
}

export const TOTAL = (c: Partial<Record<Kind, number>>) => Object.values(c).reduce((a, b) => a + (b ?? 0), 0);
