'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Check, Landmark, Loader2, Plus, Search, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MapParcel } from '@/lib/katastrMap';
import { INFO_DISCLAIMER, RIZENI_TYPY, parseParcelNumber, type CastObce, type JednotkaView, type KatastralniUzemi, type NeighborView, type ParcelaView, type PropertySnapshot, type RizeniView, type StavbaView } from '@/lib/katastr';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';

const ERRORS: Record<string, string> = {
    not_configured: 'Katastr zatím není zapnutý. Provozovatel musí do aplikace doplnit klíč k API katastru (registrace u ČÚZK).',
    unauthorized: 'Přihlaste se prosím znovu.',
    forbidden: 'Katastr je dostupný jen s vyplněným profilem a platným přístupem.',
    rate: 'Příliš mnoho dotazů. Zkuste to za chvíli.',
    upstream_rate: 'Služba katastru má vyčerpaný limit dotazů. Zkuste to později.',
    upstream_auth: 'Katastr odmítl přístupový klíč aplikace. Kontaktujte provozovatele.',
    upstream: 'Katastr se nepodařilo zeptat. Zkuste to později.',
    bad_request: 'Zkontrolujte zadané údaje.',
};

const KatastrMap = dynamic(() => import('./KatastrMap'), { ssr: false, loading: () => <p className="text-sm text-slate-500" role="status">Načítám mapu…</p> });

async function call(params: Record<string, string>): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; message: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, message: ERRORS.unauthorized };
    try {
        const res = await fetch(`/api/katastr?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        if (!res.ok) return { ok: false, message: ERRORS[String(body.error)] ?? ERRORS.upstream };
        return { ok: true, data: body };
    } catch { return { ok: false, message: ERRORS.upstream }; }
}

const nf = new Intl.NumberFormat('cs-CZ');
const Row = ({ label, value }: { label: string; value: React.ReactNode }) => value ? <div className="flex gap-3 text-sm"><dt className="w-36 shrink-0 text-slate-500">{label}</dt><dd className="min-w-0 text-slate-900">{value}</dd></div> : null;
const Shell = ({ title, subtitle, dataAsOf, plomby, children, footer }: { title: string; subtitle?: string; dataAsOf?: string | null; plomby?: { typ: string; cislo: string }[]; children: React.ReactNode; footer?: React.ReactNode }) => (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="text-lg font-bold text-slate-900">{title}</h3>{subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}</div>
            {footer}
        </div>
        <dl className="mt-3 space-y-1.5">{children}</dl>
        {plomby && plomby.length > 0 && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><strong>Probíhající řízení (plomby):</strong> {plomby.map((r) => `${r.typ} ${r.cislo}`).join(', ')}</p>}
        <p className="mt-3 text-xs text-slate-500">{INFO_DISCLAIMER}{dataAsOf ? ` Údaje k ${dataAsOf.slice(0, 10)}.` : ''} Vlastníky zobrazit nelze, bezplatné API katastru osobní údaje neposkytuje.</p>
    </article>
);
const lvText = (lv: { cislo: number; katastralniUzemi: string } | null) => (lv ? `č. ${lv.cislo}${lv.katastralniUzemi ? `, k. ú. ${lv.katastralniUzemi}` : ''}` : null);

export function ParcelCard({ p, dataAsOf, children, onNeighbor }: { p: ParcelaView; dataAsOf?: string | null; children?: React.ReactNode; onNeighbor?: (id: number) => void }) {
    const [neighbors, setNeighbors] = useState<NeighborView[] | null>(null);
    const [loading, setLoading] = useState(false);
    async function loadNeighbors() {
        setLoading(true);
        const r = await call({ op: 'sousedni', id: String(p.id) });
        setLoading(false);
        setNeighbors(r.ok ? ((r.data.neighbors as NeighborView[]) ?? []) : []);
    }
    return (
        <Shell title={`Parcela ${p.oznaceni}`} subtitle={`k. ú. ${p.katastralniUzemi.nazev} (${p.katastralniUzemi.kod})`} dataAsOf={dataAsOf} plomby={p.plomby} footer={children}>
            <Row label="List vlastnictví" value={lvText(p.lv)} />
            <Row label="Výměra" value={p.vymera !== null ? `${nf.format(p.vymera)} m²${p.zpusobUrceniVymery ? ` (${p.zpusobUrceniVymery.toLowerCase()})` : ''}` : null} />
            <Row label="Druh pozemku" value={p.druhPozemku} />
            <Row label="Způsob využití" value={p.zpusobVyuziti} />
            <Row label="Stavba na parcele" value={p.stavba} />
            <Row label="Ochrana" value={p.zpusobyOchrany.join(', ')} />
            <Row label="BPEJ" value={p.bpej.length ? p.bpej.map((b) => `${b.kod} (${nf.format(b.vymera)} m²)`).join(', ') : null} />
            <Row label="Mapový list" value={p.mapovyList} />
            <Row label="Souřadnice (S-JTSK)" value={p.souradnice ? `${nf.format(Math.round(p.souradnice.x))}, ${nf.format(Math.round(p.souradnice.y))}` : null} />
            <Row label="Původní k. ú." value={p.puvodniKu} />
            <Row label="Typ" value={p.typ === 'PZE' ? 'parcela zjednodušené evidence' : 'parcela katastru nemovitostí'} />
            {onNeighbor && (
                <div className="pt-2">
                    {neighbors === null ? <button type="button" onClick={() => void loadNeighbors()} disabled={loading} className={ghostBtn}>{loading ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />} Sousední parcely</button> : neighbors.length === 0 ? <p className="text-xs text-slate-500">Sousední parcely nejsou k dispozici.</p> : (
                        <div><p className="text-xs font-semibold text-slate-600">Sousední parcely ({neighbors.length})</p><div className="mt-1 flex flex-wrap gap-1.5">{neighbors.map((n) => <button key={n.id} type="button" onClick={() => onNeighbor(n.id)} className="rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50">{n.oznaceni}{n.katastralniUzemi !== p.katastralniUzemi.nazev ? ` · ${n.katastralniUzemi}` : ''}</button>)}</div></div>
                    )}
                </div>
            )}
        </Shell>
    );
}

export function StavbaCard({ b, dataAsOf, children }: { b: StavbaView; dataAsOf?: string | null; children?: React.ReactNode }) {
    return (
        <Shell title={`${b.typ || 'Stavba'}${b.cisla ? ` č. ${b.cisla}` : ''}`} subtitle={b.castObce ? `část obce ${b.castObce}` : undefined} dataAsOf={dataAsOf} plomby={b.plomby} footer={children}>
            <Row label="List vlastnictví" value={lvText(b.lv)} />
            <Row label="Způsob využití" value={b.zpusobVyuziti} />
            <Row label="Ochrana" value={b.zpusobyOchrany.join(', ')} />
            <Row label="Stojí na parcelách" value={b.parcely.length ? b.parcely.map((p) => `${p.oznaceni} (${p.katastralniUzemi})`).join(', ') : null} />
            <Row label="Jednotky" value={b.pocetJednotek ? `${b.pocetJednotek}` : null} />
            <Row label="Stavba" value={b.docasna ? 'dočasná' : null} />
        </Shell>
    );
}

export function JednotkaCard({ j, dataAsOf, children }: { j: JednotkaView; dataAsOf?: string | null; children?: React.ReactNode }) {
    return (
        <Shell title={`Jednotka${j.cislo !== null ? ` č. ${j.cislo}` : ''}`} subtitle={j.typ || undefined} dataAsOf={dataAsOf} plomby={j.plomby} footer={children}>
            <Row label="List vlastnictví" value={lvText(j.lv)} />
            <Row label="Ve stavbě" value={j.stavba} />
            <Row label="Způsob využití" value={j.zpusobVyuziti} />
            <Row label="Podíl na společných částech" value={j.podil} />
            <Row label="Ochrana" value={j.zpusobyOchrany.join(', ')} />
        </Shell>
    );
}

export function RizeniCard({ r, dataAsOf, children }: { r: RizeniView; dataAsOf?: string | null; children?: React.ReactNode }) {
    return (
        <Shell title={`${r.typNazev} ${r.cislo}`} subtitle={`pracoviště ${r.kodPracoviste}`} dataAsOf={dataAsOf} footer={children}>
            <Row label="Přijato" value={r.datumPrijeti ? new Date(`${r.datumPrijeti}T12:00:00`).toLocaleDateString('cs-CZ') : null} />
            <Row label="Stav" value={r.stav} />
            <Row label="Úhrada poplatku" value={r.stavUhrady} />
            <Row label="Navazující řízení" value={r.navazana.length ? r.navazana.join(', ') : null} />
            <Row label="Poznámky" value={r.poznamky.length ? r.poznamky.join(' · ') : null} />
        </Shell>
    );
}

// Karta podle typu uloženého snímku
export function PropertyCard({ snap, dataAsOf, children }: { snap: PropertySnapshot | ParcelaView; dataAsOf?: string | null; children?: React.ReactNode }) {
    const s = snap as PropertySnapshot;
    if (s.kind === 'stavba') return <StavbaCard b={s} dataAsOf={dataAsOf}>{children}</StavbaCard>;
    if (s.kind === 'jednotka') return <JednotkaCard j={s} dataAsOf={dataAsOf}>{children}</JednotkaCard>;
    if (s.kind === 'rizeni') return <RizeniCard r={s} dataAsOf={dataAsOf}>{children}</RizeniCard>;
    return <ParcelCard p={snap as ParcelaView} dataAsOf={dataAsOf}>{children}</ParcelCard>;
}

export const snapshotLabel = (s: PropertySnapshot): string => {
    if (s.kind === 'stavba') return `${s.typ || 'Stavba'}${s.cisla ? ` č. ${s.cisla}` : ''}${s.castObce ? `, ${s.castObce}` : ''}`;
    if (s.kind === 'jednotka') return `Jednotka${s.cislo !== null ? ` č. ${s.cislo}` : ''}, ${s.stavba || 'stavba'}`;
    if (s.kind === 'rizeni') return `${s.typNazev} ${s.cislo}`;
    return `Parcela ${s.oznaceni}, k. ú. ${s.katastralniUzemi.nazev}`;
};

type Mode = 'mapa' | 'stavba' | 'jednotka' | 'rizeni';
const MODES: [Mode, string][] = [['mapa', 'Parcela (mapa, adresa, číslo)'], ['stavba', 'Stavba'], ['jednotka', 'Jednotka'], ['rizeni', 'Řízení']];
type Found = { items: PropertySnapshot[]; dataAsOf: string | null };

// Autocomplete: pole s nabídkou položek z číselníku
function Suggest<T extends { kod: number }>({ id, label, value, onType, onPick, suggestions, show, render, placeholder }: { id: string; label: string; value: string; onType: (v: string) => void; onPick: (v: T) => void; suggestions: T[]; show: boolean; render: (v: T) => string; placeholder: string }) {
    return (
        <div className="relative">
            <label htmlFor={id} className="block text-xs font-semibold text-slate-600">{label}</label>
            <input id={id} value={value} onChange={(e) => onType(e.target.value)} autoComplete="off" role="combobox" aria-expanded={show && suggestions.length > 0} aria-controls={`${id}-list`} className={`${inputCls} mt-1 font-normal`} placeholder={placeholder} />
            {show && suggestions.length > 0 && (
                <ul id={`${id}-list`} role="listbox" className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {suggestions.map((s) => <li key={s.kod} role="option" aria-selected={false}><button type="button" onClick={() => onPick(s)} className="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50">{render(s)}</button></li>)}
                </ul>
            )}
        </div>
    );
}

// Vyhledání v katastru (parcela, stavba, jednotka, řízení); ve spisu lze nalezené uložit.
export default function KatastrSearch({ onSave }: { onSave?: (snapshot: PropertySnapshot, dataAsOf: string) => Promise<void> }) {
    const [mode, setMode] = useState<Mode>('mapa');
    const [kuText, setKuText] = useState(''); const [ku, setKu] = useState<KatastralniUzemi | null>(null); const [kuList, setKuList] = useState<KatastralniUzemi[]>([]);
    const [coText, setCoText] = useState(''); const [co, setCo] = useState<CastObce | null>(null); const [coList, setCoList] = useState<CastObce[]>([]);
    const [number, setNumber] = useState(''); const [evid, setEvid] = useState<'PKN' | 'PZE'>('PKN');
    const [typStavby, setTypStavby] = useState('1'); const [cj, setCj] = useState('');
    const [rTyp, setRTyp] = useState('V'); const [rCislo, setRCislo] = useState(''); const [rRok, setRRok] = useState(String(new Date().getFullYear())); const [ws, setWs] = useState(''); const [wsList, setWsList] = useState<{ kod: number; nazev: string }[]>([]);
    const [busy, setBusy] = useState(false); const [error, setError] = useState('');
    const [found, setFound] = useState<Found | null>(null);
    const [focus, setFocus] = useState<MapParcel | null>(null);
    const results = useRef<HTMLDivElement>(null);
    const [savedKeys, setSavedKeys] = useState<string[]>([]);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (mode !== 'rizeni' || wsList.length) return;
        let cancelled = false;
        call({ op: 'pracoviste' }).then((r) => { if (!cancelled && r.ok) setWsList((r.data.results as { kod: number; nazev: string }[]) ?? []); });
        return () => { cancelled = true; };
    }, [mode, wsList.length]);

    // Po nalezení se stránka sama posune na výsledek
    useEffect(() => {
        if (found) results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [found]);

    function suggest(op: 'ku' | 'castiobce', value: string) {
        setError('');
        if (timer.current) clearTimeout(timer.current);
        if (value.trim().length < 2) { if (op === 'ku') setKuList([]); else setCoList([]); return; }
        timer.current = setTimeout(async () => {
            const r = await call({ op, q: value });
            if (!r.ok) { setError(r.message); return; }
            if (op === 'ku') setKuList((r.data.results as KatastralniUzemi[]) ?? []); else setCoList((r.data.results as CastObce[]) ?? []);
        }, 300);
    }

    const switchMode = (m: Mode) => { setMode(m); setError(''); setFound(null); };

    async function run(params: Record<string, string>, toItems: (data: Record<string, unknown>) => PropertySnapshot[], emptyMessage: string) {
        setError(''); setFound(null); setSavedKeys([]); setBusy(true);
        const r = await call(params);
        setBusy(false);
        if (!r.ok) { setError(r.message); return; }
        const items = toItems(r.data);
        if (!items.length) { setError(emptyMessage); return; }
        setFound({ items, dataAsOf: (r.data.aktualnostDatK as string | null) ?? null });
    }

    async function search(e: React.FormEvent) {
        e.preventDefault();
        if (mode === 'mapa') {
            if (!ku) { setError('Vyberte obec (katastrální území) ze seznamu.'); return; }
            const parsed = parseParcelNumber(number);
            if (!parsed) { setError('Zadejte parcelní číslo, např. 123/4 nebo st. 56.'); return; }
            setError(''); setFound(null); setSavedKeys([]); setBusy(true);
            const r = await call({ op: 'parcela', ku: String(ku.kod), kmen: String(parsed.kmen), druh: String(parsed.druh), evid, ...(parsed.poddeleni !== undefined ? { podd: String(parsed.poddeleni) } : {}) });
            if (!r.ok) { setBusy(false); setError(r.message); return; }
            const parcels = (r.data.parcels as ParcelaView[]) ?? [];
            if (!parcels.length) { setBusy(false); setError('Parcela s tímto číslem v daném katastrálním území nebyla nalezena.'); return; }
            setFound({ items: parcels.map((x) => ({ kind: 'parcela' as const, ...x })), dataAsOf: (r.data.aktualnostDatK as string | null) ?? null });
            // Obrys na mapě (vybere se parcela se stejnou výměrou, protože služba neodlišuje stavební parcely)
            const shape = await call({ op: 'obrys', ku: String(ku.kod), kmen: String(parsed.kmen), ...(parsed.poddeleni !== undefined ? { podd: String(parsed.poddeleni) } : {}), ...(parcels[0].vymera !== null ? { area: String(parcels[0].vymera) } : {}) });
            setBusy(false);
            if (shape.ok && shape.data.parcel) setFocus(shape.data.parcel as MapParcel);
        } else if (mode === 'stavba' || mode === 'jednotka') {
            if (!co) { setError('Vyberte část obce ze seznamu.'); return; }
            const cp = Number(number.replace(/\D/g, ''));
            if (!cp) { setError('Zadejte číslo popisné nebo evidenční.'); return; }
            if (mode === 'jednotka' && !Number(cj)) { setError('Zadejte číslo jednotky.'); return; }
            await run({ op: mode, co: String(co.kod), typ: typStavby, cp: String(cp), ...(mode === 'jednotka' ? { cj } : {}) },
                (d) => ((d.items as (StavbaView | JednotkaView)[]) ?? []).map((x) => (mode === 'stavba' ? { kind: 'stavba' as const, ...(x as StavbaView) } : { kind: 'jednotka' as const, ...(x as JednotkaView) })),
                mode === 'stavba' ? 'Stavba s tímto číslem v dané části obce nebyla nalezena.' : 'Jednotka nebyla nalezena.');
        } else {
            if (!Number(rCislo) || !Number(rRok) || !Number(ws)) { setError('Vyplňte typ, číslo, rok a pracoviště.'); return; }
            await run({ op: 'rizeni', typ: rTyp, cislo: rCislo, rok: rRok, ws }, (d) => ((d.items as RizeniView[]) ?? []).map((x) => ({ kind: 'rizeni' as const, ...x })), 'Řízení nebylo nalezeno.');
        }
    }

    async function openFromMap(p: MapParcel) {
        setError(''); setFound(null); setSavedKeys([]); setBusy(true);
        // Služba s mapou neodlišuje stavební parcely, zkusí se obě číslování a vybere se parcela se stejnou výměrou
        let fallback: ParcelaView[] = []; let asOf: string | null = null;
        for (const druh of p.druh === 1 ? [1, 2] : [2, 1]) {
            const r = await call({ op: 'parcela', ku: String(p.ku), kmen: String(p.kmen), druh: String(druh), evid: 'PKN', ...(p.poddeleni !== undefined ? { podd: String(p.poddeleni) } : {}) });
            if (!r.ok) { setBusy(false); setError(r.message); return; }
            const parcels = (r.data.parcels as ParcelaView[]) ?? [];
            const exact = parcels.filter((x) => x.vymera === p.area);
            asOf = (r.data.aktualnostDatK as string | null) ?? asOf;
            if (exact.length) { fallback = exact; break; }
            if (!fallback.length) fallback = parcels;
        }
        setBusy(false);
        if (!fallback.length) { setError(`Parcela ${p.label} v k. ú. ${p.ku} není v katastru nemovitostí vedena (může jít o parcelu zjednodušené evidence).`); return; }
        setFound({ items: fallback.map((x) => ({ kind: 'parcela' as const, ...x })), dataAsOf: asOf });
    }

    async function openNeighbor(id: number) {
        setError(''); setBusy(true);
        const r = await call({ op: 'parcelaId', id: String(id) });
        setBusy(false);
        if (!r.ok) { setError(r.message); return; }
        const parcels = (r.data.parcels as ParcelaView[]) ?? [];
        if (!parcels.length) { setError('Sousední parcelu se nepodařilo načíst.'); return; }
        setFound({ items: parcels.map((p) => ({ kind: 'parcela' as const, ...p })), dataAsOf: (r.data.aktualnostDatK as string | null) ?? null });
        setSavedKeys([]);
    }

    async function save(item: PropertySnapshot) {
        if (!onSave) return;
        setBusy(true);
        try { await onSave(item, found?.dataAsOf ?? ''); setSavedKeys((k) => [...k, `${item.kind}-${item.id}`]); } catch (err) { setError(err instanceof Error ? err.message : 'Uložení se nepovedlo.'); } finally { setBusy(false); }
    }

    const saveButton = (item: PropertySnapshot) => onSave ? (savedKeys.includes(`${item.kind}-${item.id}`)
        ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800"><Check size={15} /> Uloženo do spisu</span>
        : <button type="button" onClick={() => void save(item)} disabled={busy} className={ghostBtn}><Plus size={15} /> Přidat do spisu</button>) : null;

    const label = 'block text-xs font-semibold text-slate-600';
    return (
        <div className="space-y-4">
            <form onSubmit={search} className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Landmark size={18} className="text-indigo-700" /> Vyhledávání v katastru nemovitostí</h2>
                <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Co hledáte">
                    {MODES.map(([id, name]) => <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => switchMode(id)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${mode === id ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{name}</button>)}
                </div>

                {mode === 'mapa' && <div className="mt-4"><KatastrMap call={call} onParcel={(p) => void openFromMap(p)} busy={busy} focus={focus} /><p className="mb-1 mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">Nebo podle obce a čísla parcely</p></div>}
                <div className="mt-4 grid gap-3 sm:grid-cols-6 sm:items-end">
                    {mode === 'mapa' && <>
                        <div className="sm:col-span-3"><Suggest id="ku" label="Obec / katastrální území (název nebo kód)" value={kuText} onType={(v) => { setKuText(v); setKu(null); suggest('ku', v); }} onPick={(k: KatastralniUzemi) => { setKu(k); setKuText(`${k.nazev} (${k.kod})`); setKuList([]); }} suggestions={kuList} show={!ku} render={(k) => `${k.nazev} · ${k.kod}`} placeholder="např. Plzeň" /></div>
                        <label className={`${label} sm:col-span-2`}>Parcelní číslo<input value={number} onChange={(e) => setNumber(e.target.value)} className={`${inputCls} mt-1 font-normal`} placeholder="123/4 nebo st. 56" /></label>
                        <label className={label}>Evidence<select value={evid} onChange={(e) => setEvid(e.target.value as 'PKN' | 'PZE')} className={`${inputCls} mt-1 font-normal`}><option value="PKN">Katastr nemovitostí</option><option value="PZE">Zjednodušená evidence</option></select></label>
                    </>}
                    {(mode === 'stavba' || mode === 'jednotka') && <>
                        <div className="sm:col-span-3"><Suggest id="co" label="Část obce (název nebo obec)" value={coText} onType={(v) => { setCoText(v); setCo(null); suggest('castiobce', v); }} onPick={(c: CastObce) => { setCo(c); setCoText(`${c.nazev}${c.obec ? `, ${c.obec}` : ''}`); setCoList([]); }} suggestions={coList} show={!co} render={(c) => `${c.nazev}${c.obec ? ` · ${c.obec}` : ''}`} placeholder="např. Vnitřní Město" /></div>
                        <label className={label}>Druh čísla<select value={typStavby} onChange={(e) => setTypStavby(e.target.value)} className={`${inputCls} mt-1 font-normal`}><option value="1">č. popisné</option><option value="2">č. evidenční</option></select></label>
                        <label className={label}>Číslo<input value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric" className={`${inputCls} mt-1 font-normal`} placeholder="327" /></label>
                        {mode === 'jednotka' && <label className={label}>Č. jednotky<input value={cj} onChange={(e) => setCj(e.target.value)} inputMode="numeric" className={`${inputCls} mt-1 font-normal`} placeholder="12" /></label>}
                    </>}
                    {mode === 'rizeni' && <>
                        <label className={`${label} sm:col-span-2`}>Typ řízení<select value={rTyp} onChange={(e) => setRTyp(e.target.value)} className={`${inputCls} mt-1 font-normal`}>{Object.entries(RIZENI_TYPY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                        <label className={label}>Číslo<input value={rCislo} onChange={(e) => setRCislo(e.target.value)} inputMode="numeric" className={`${inputCls} mt-1 font-normal`} placeholder="1234" /></label>
                        <label className={label}>Rok<input value={rRok} onChange={(e) => setRRok(e.target.value)} inputMode="numeric" className={`${inputCls} mt-1 font-normal`} /></label>
                        <label className={`${label} sm:col-span-2`}>Katastrální pracoviště<select value={ws} onChange={(e) => setWs(e.target.value)} className={`${inputCls} mt-1 font-normal`}><option value="">{wsList.length ? 'Vyberte…' : 'Načítám…'}</option>{wsList.map((w) => <option key={w.kod} value={w.kod}>{w.nazev}</option>)}</select></label>
                    </>}
                    <button type="submit" disabled={busy} className={`${primaryBtn} justify-center sm:col-span-6 sm:justify-self-start`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Hledat</button>
                </div>
                <p className="mt-3 text-xs text-slate-500">{mode === 'mapa' ? 'Stavební parcelu zadejte s předponou „st.“. ' : ''}Zdroj: bezplatné API katastru nemovitostí ČÚZK. Počet dotazů je omezený.</p>
                {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            </form>
            <div ref={results} className="scroll-mt-4 space-y-4">
            {found?.items.map((item) => {
                const key = `${item.kind}-${item.id}`;
                const btn = saveButton(item);
                if (item.kind === 'parcela') return <ParcelCard key={key} p={item} dataAsOf={found.dataAsOf} onNeighbor={(id) => void openNeighbor(id)}>{btn}</ParcelCard>;
                return <PropertyCard key={key} snap={item} dataAsOf={found.dataAsOf}>{btn}</PropertyCard>;
            })}
            </div>
        </div>
    );
}
