import type { RizeniView } from './katastr';

// Hlídač: pomocné funkce pro hlídání řízení v katastru. Aplikace jen upozorní na změnu údajů v katastru, nic dalšího nevyvozuje.
export type RizeniChange = { ref: string; title: string; detail: string };

// Z uloženého řízení (typ, číslo/rok, pracoviště) složí parametry dotazu do rozhraní katastru
export function rizeniQuery(snap: Pick<RizeniView, 'typ' | 'cislo' | 'kodPracoviste'>): { typ: string; cislo: number; rok: number; ws: number } | null {
    const m = /^(\d{1,8})\/(\d{4})$/.exec(snap.cislo ?? '');
    if (!m || !snap.typ || !snap.kodPracoviste) return null;
    return { typ: snap.typ, cislo: Number(m[1]), rok: Number(m[2]), ws: snap.kodPracoviste };
}

const list = (a: string[]) => [...a].map((x) => x.trim()).filter(Boolean).sort();
const same = (a: string[], b: string[]) => JSON.stringify(list(a)) === JSON.stringify(list(b));

// Co se u řízení změnilo proti uloženému stavu (stav, úhrada poplatku, navazující řízení, poznámky). Beze změny: null.
export function rizeniChange(prev: RizeniView, cur: RizeniView): RizeniChange | null {
    const parts: string[] = [];
    if (prev.stav.trim() !== cur.stav.trim()) parts.push(`stav: „${prev.stav || '–'}“ → „${cur.stav || '–'}“`);
    if ((prev.stavUhrady || '') !== (cur.stavUhrady || '')) parts.push(`úhrada poplatku: ${prev.stavUhrady || '–'} → ${cur.stavUhrady || '–'}`);
    if (!same(prev.navazana, cur.navazana)) { const added = list(cur.navazana).filter((x) => !list(prev.navazana).includes(x)); parts.push(added.length ? `nové navazující řízení: ${added.join(', ')}` : 'změna navazujících řízení'); }
    if (!same(prev.poznamky, cur.poznamky)) parts.push('změna poznámek u řízení');
    if (!parts.length) return null;
    const label = `${cur.typNazev || cur.typ} ${cur.cislo}`;
    const state = `${cur.stav}|${cur.stavUhrady}|${list(cur.navazana).join(',')}|${list(cur.poznamky).join(',')}`;
    let h = 0; for (let i = 0; i < state.length; i++) h = (h * 31 + state.charCodeAt(i)) >>> 0;
    return { ref: `rizeni:${cur.id}:${h.toString(36)}`.slice(0, 300), title: `Katastr: změna řízení ${label}`.slice(0, 300), detail: parts.join('; ').slice(0, 1000) };
}
