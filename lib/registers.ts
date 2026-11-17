// Obchodní a živnostenský rejstřík z veřejného rozhraní ARES: přehledné zobrazení aktuálního stavu (bez historie a bez soukromých adres osob).
type J = Record<string, unknown>;
const arr = (v: unknown): J[] => (Array.isArray(v) ? (v as J[]) : []);
const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
const cur = (list: unknown): J[] => arr(list).filter((x) => !x.datumVymazu);
const last = (list: unknown): J | undefined => { const c = cur(list); return c[c.length - 1]; };

const COURTS: Record<string, string> = { MSPH: 'Městský soud v Praze', KSPH: 'Krajský soud v Praze', KSCB: 'Krajský soud v Českých Budějovicích', KSPL: 'Krajský soud v Plzni', KSUL: 'Krajský soud v Ústí nad Labem', KSHK: 'Krajský soud v Hradci Králové', KSBR: 'Krajský soud v Brně', KSOS: 'Krajský soud v Ostravě' };
export const FORMS: Record<string, string> = { '101': 'Fyzická osoba podnikající dle živnostenského zákona', '111': 'Veřejná obchodní společnost', '112': 'Společnost s ručením omezeným', '113': 'Komanditní společnost', '121': 'Akciová společnost', '141': 'Obecně prospěšná společnost', '145': 'Společenství vlastníků jednotek', '701': 'Spolek / sdružení', '706': 'Spolek', '721': 'Církevní organizace', '736': 'Pobočný spolek', '801': 'Obec', '804': 'Kraj', '331': 'Příspěvková organizace', '421': 'Zahraniční osoba' };
export const TRADE_TYPE: Record<string, string> = { L: 'Volná', R: 'Řemeslná', V: 'Vázaná', K: 'Koncesovaná' };

// Jména v rejstříku bývají psána velkými písmeny
export const nice = (s: string) => (s && s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()) : s);
const person = (o: J | undefined): string => {
    if (!o) return '';
    const f = (o.fyzickaOsoba ?? null) as J | null; const p = (o.pravnickaOsoba ?? null) as J | null;
    if (f) return [str(f.titulPredJmenem), nice(str(f.jmeno)), nice(str(f.prijmeni)), str(f.titulZaJmenem)].filter(Boolean).join(' ');
    if (p) return [str(p.obchodniJmeno), str(p.ico) ? `(IČO ${str(p.ico)})` : ''].filter(Boolean).join(' ');
    return '';
};
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(';', '.').replace(/\s/g, '')); return Number.isFinite(n) ? n : null; };

export type Member = { name: string; role: string; since: string };
export type Organ = { name: string; rules: string; members: Member[] };
export type RegisterVr = { court: string; capital: { amount: number | null; paid: string } | null; organs: Organ[]; partners: { name: string; share: string }[]; shareholders: string[]; activities: string[]; state: string; founded: string; updated: string };
export type Trade = { name: string; type: string; since: string; ended: string; fields: string[]; reps: string[] };
export type RegisterRzp = { active: number; ended: number; suspended: number; trades: Trade[]; offices: number | null };

function members(list: unknown): Member[] {
    return cur(list).map((m) => {
        const cl = (m.clenstvi ?? {}) as J; const fn = (cl.funkce ?? {}) as J; const ms = (cl.clenstvi ?? {}) as J;
        return { name: person(m), role: str(fn.nazev) || str(m.nazevAngazma), since: str(fn.vznikFunkce) || str(ms.vznikClenstvi) || str(m.datumZapisu) };
    }).filter((m) => m.name);
}

export function normalizeVr(json: unknown): RegisterVr | null {
    const rec = arr((json as J)?.zaznamy)[0]; if (!rec) return null;
    const sz = last(rec.spisovaZnacka);
    const court = sz ? `${COURTS[str(sz.soud)] ?? str(sz.soud)}, oddíl ${str(sz.oddil)}, vložka ${str(sz.vlozka)}` : '';
    const kap = last(rec.zakladniKapital); const vklad = (kap?.vklad ?? null) as J | null; const spl = (kap?.splaceni ?? null) as J | null;
    const organs: Organ[] = [...cur(rec.statutarniOrgany), ...cur(rec.ostatniOrgany)].map((o) => ({ name: str(o.nazevOrganu) || 'Orgán', rules: str(last(o.zpusobJednani)?.hodnota), members: members(o.clenoveOrganu) })).filter((o) => o.members.length || o.rules);
    const partners = arr(rec.spolecnici).flatMap((g) => cur(g.spolecnik)).map((s) => { const p = last(s.podil); const share = str(((p?.velikostPodilu ?? {}) as J).hodnota); const v = num(((p?.vklad ?? {}) as J).hodnota); return { name: person(s.osoba as J), share: [share, v !== null ? `vklad ${Math.round(v).toLocaleString('cs-CZ')} Kč` : ''].filter(Boolean).join(', ') }; }).filter((s) => s.name);
    const shareholders = arr(rec.akcionari).flatMap((g) => members(g.clenoveOrganu)).map((m) => m.name).filter(Boolean);
    const act = (rec.cinnosti ?? {}) as J;
    const activities = [...cur(act.predmetPodnikani), ...cur(act.predmetCinnosti), ...cur(act.ostatniCinnosti)].map((x) => str(x.hodnota).replace(/\s*\n\s*/g, ' ')).filter(Boolean);
    return { court, capital: kap ? { amount: num(vklad?.hodnota), paid: spl ? `${str(spl.hodnota)} ${str(spl.typObnos) === 'PROCENTA' ? '%' : ''}`.trim() : '' } : null, organs, partners, shareholders, activities, state: str(rec.stavSubjektu), founded: str(rec.datumZapisu), updated: str(rec.datumAktualizace) };
}

export function normalizeRzp(json: unknown): RegisterRzp | null {
    const rec = arr((json as J)?.zaznamy)[0]; if (!rec) return null;
    const st = (rec.zivnostiStav ?? {}) as J; const pv = (rec.provozovnyStav ?? {}) as J;
    const trades: Trade[] = arr(rec.zivnosti).map((z) => ({
        name: str(z.predmetPodnikani), type: TRADE_TYPE[str(z.druhZivnosti)] ?? '', since: str(z.datumVzniku), ended: str(z.datumZaniku),
        fields: arr(z.oboryCinnosti).map((o) => str(o.oborNazev)).filter(Boolean),
        reps: arr(z.odpovedniZastupci).filter((r) => !r.platnostDo).map((r) => [str(r.titulPredJmenem), nice(str(r.jmeno)), nice(str(r.prijmeni))].filter(Boolean).join(' ')).filter(Boolean),
    })).filter((t) => t.name);
    return { active: Number(st.pocetAktivnich ?? trades.filter((t) => !t.ended).length), ended: Number(st.pocetZaniklych ?? trades.filter((t) => t.ended).length), suspended: Number(st.pocetPozastavenych ?? 0), trades, offices: pv.pocetAktivnich !== undefined ? Number(pv.pocetAktivnich) : null };
}

export const orUrl = (ico: string) => `https://or.justice.cz/ias/ui/rejstrik-$firma?ico=${encodeURIComponent(ico)}`;
export const aresUrl = (ico: string) => `https://ares.gov.cz/ekonomicke-subjekty?ico=${encodeURIComponent(ico)}`;
export const dmy = (iso: string) => (iso ? `${Number(iso.slice(8, 10))}. ${Number(iso.slice(5, 7))}. ${iso.slice(0, 4)}` : '');
