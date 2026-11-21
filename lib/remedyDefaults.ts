// Lhůta k opravnému prostředku podle druhu doručeného rozhodnutí, když ji poučení neuvádí nebo ji pravidla v textu nenašla.
// Návrh vychází z obecné zákonné úpravy (údaje i ustanovení bere z app/data/deadlines.ts) a VŽDY ho potvrzuje advokát:
// zvláštní předpisy, nepřípustnost opravného prostředku nebo jiný počátek lhůty tu poznat nelze.
import { LEGAL_DEADLINES } from '@/app/data/deadlines';

export type RemedyRule = { lawKey: string; label: string; why: string };

const has = (t: string, re: RegExp) => re.test(t);
const NOT_ALLOWED = /není\s+(odvolání\s+|stížnost\s+|odpor\s+)?(přípustn)|nepřípustn|odvolání\s+se\s+nepřipouští|nelze\s+(se\s+)?(odvolat|podat\s+(odvolání|stížnost|odpor))|opravný\s+prostředek\s+není\s+přípustný/i;
const CRIMINAL = /trestn[íý]\w*\s+(řád|stíhání|čin|spis)|obžalovan|obviněn|státní\s+zástup|\bpodle\s+§\s*\d+[a-z]?\s+tr\.\s*zákoníku|\b\d+\s*T\s*\d+\s*\/\s*\d{4}/i;
const ADMIN_COURT = /soudní\s+řád\s+správní|s\.\s*ř\.\s*s\.|\b\d+\s*A[d]?\s*\d+\s*\/\s*\d{4}|ve\s+spisu\s+žaloby\s+proti\s+rozhodnutí/i;
const ADMIN_BODY = /správní(ho)?\s+řád|odbor\s+\w+|městsk[ýé]\s+úřad|magistrát|krajsk[ýé]\s+úřad|obecní\s+úřad|správní\s+orgán|č\.\s*j\.\s*[A-Z]{2,}/i;
const APPEAL_COURT = /jako\s+soud\s+odvolací|odvolací\s+soud\s+(rozsudek|potvrzuje|mění)|rozsudek\s+soudu\s+prvního\s+stupně\s+se\s+(potvrzuje|mění)/i;

// Druh rozhodnutí a řízení odhadnutý z textu; null = nic jistého
export function remedyRule(text: string): RemedyRule | null {
    const head = text.slice(0, 1500);
    if (NOT_ALLOWED.test(text)) return null;
    if (has(head, /elektronick[ýé]\s+platební\s+rozkaz|platební\s+rozkaz/i) && !has(head, /evropsk/i)) return { lawKey: 'odpor-platebni-rozkaz', label: 'Odpor proti platebnímu rozkazu', why: 'platební rozkaz' };
    if (has(head, /trestní\s+příkaz/i)) return { lawKey: 'odvolani-trestni-prikaz', label: 'Odpor proti trestnímu příkazu', why: 'trestní příkaz' };
    // Druh rozhodnutí podle nadpisu (velkými písmeny v úvodu); „rozsudek“ v textu usnesení nestačí
    const title = text.slice(0, 400);
    const isUsneseni = has(title, /(^|\s)USNESENÍ(?=\s|$)/);
    const isRozsudek = has(title, /(^|\s)ROZSUDEK(?=\s|$)/) || (!isUsneseni && has(title, /(^|\s)rozsudek(?=\s|$|[.,])/));
    if (isRozsudek && ADMIN_COURT.test(text)) return { lawKey: 'kasacni-stiznost-nss', label: 'Kasační stížnost', why: 'rozsudek ve správním soudnictví' };
    if (isRozsudek && CRIMINAL.test(text)) return { lawKey: 'odvolani-trestni-rozsudek', label: 'Odvolání', why: 'rozsudek v trestním řízení' };
    if (isUsneseni && CRIMINAL.test(text)) return { lawKey: 'stiznost-usneseni-trestni', label: 'Stížnost', why: 'usnesení v trestním řízení' };
    if (isRozsudek && APPEAL_COURT.test(text)) return { lawKey: 'dovolani-obcanske-rizeni', label: 'Dovolání', why: 'rozsudek odvolacího soudu (dovolání jen je-li přípustné)' };
    if (isRozsudek) return { lawKey: 'odvolani-civilni-soud', label: 'Odvolání', why: 'rozsudek soudu prvního stupně v civilním řízení' };
    if (!isRozsudek && !isUsneseni && has(title, /(^|\s)ROZHODNUTÍ(?=\s|$)/) && ADMIN_BODY.test(text)) return { lawKey: 'odvolani-spravni-rizeni', label: 'Odvolání', why: 'rozhodnutí správního orgánu' };
    return null;
}

export type RemedyProposal = RemedyRule & { n: number; unit: 'den' | 'mesic'; law: string; startTrigger: string };

export function remedyProposal(text: string): RemedyProposal | null {
    const rule = remedyRule(text);
    if (!rule) return null;
    const d = LEGAL_DEADLINES.find((x) => x.id === rule.lawKey) as ({ law: string; durationDays?: number; durationMonths?: number; startTrigger?: string } | undefined);
    if (!d) return null;
    const n = d.durationDays ?? d.durationMonths;
    if (!n) return null;
    return { ...rule, n, unit: d.durationDays ? 'den' : 'mesic', law: d.law, startTrigger: d.startTrigger ?? '' };
}
