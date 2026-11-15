'use client';

import { useRef, useState } from 'react';
import { Check, Landmark, Loader2, Plus, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { INFO_DISCLAIMER, parseParcelNumber, type KatastralniUzemi, type ParcelaView } from '@/lib/katastr';
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

export function ParcelCard({ p, dataAsOf, children }: { p: ParcelaView; dataAsOf?: string | null; children?: React.ReactNode }) {
    const row = (label: string, value: React.ReactNode) => value ? <div className="flex gap-3 text-sm"><dt className="w-36 shrink-0 text-slate-500">{label}</dt><dd className="min-w-0 text-slate-900">{value}</dd></div> : null;
    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold text-slate-900">Parcela {p.oznaceni}</h3>
                    <p className="text-sm text-slate-600">k. ú. {p.katastralniUzemi.nazev} ({p.katastralniUzemi.kod})</p>
                </div>
                {children}
            </div>
            <dl className="mt-3 space-y-1.5">
                {row('List vlastnictví', p.lv ? `č. ${p.lv.cislo}${p.lv.katastralniUzemi ? `, k. ú. ${p.lv.katastralniUzemi}` : ''}` : null)}
                {row('Výměra', p.vymera !== null ? `${nf.format(p.vymera)} m²` : null)}
                {row('Druh pozemku', p.druhPozemku)}
                {row('Způsob využití', p.zpusobVyuziti)}
                {row('Stavba na parcele', p.stavba)}
                {row('Ochrana', p.zpusobyOchrany.join(', '))}
                {row('BPEJ', p.bpej.length ? p.bpej.map((b) => `${b.kod} (${nf.format(b.vymera)} m²)`).join(', ') : null)}
                {row('Typ', p.typ === 'PZE' ? 'parcela zjednodušené evidence' : 'parcela katastru nemovitostí')}
            </dl>
            {p.plomby.length > 0 && (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><strong>Probíhající řízení (plomby):</strong> {p.plomby.map((r) => `${r.typ} ${r.cislo}`).join(', ')}</p>
            )}
            <p className="mt-3 text-xs text-slate-500">{INFO_DISCLAIMER}{dataAsOf ? ` Údaje k ${dataAsOf}.` : ''} Vlastníky zobrazit nelze, bezplatné API katastru osobní údaje neposkytuje.</p>
        </article>
    );
}

// Vyhledání parcely v katastru podle katastrálního území a parcelního čísla; ve spisu ji lze uložit.
export default function KatastrSearch({ onSave }: { onSave?: (p: ParcelaView, dataAsOf: string) => Promise<void> }) {
    const [kuText, setKuText] = useState('');
    const [ku, setKu] = useState<KatastralniUzemi | null>(null);
    const [suggestions, setSuggestions] = useState<KatastralniUzemi[]>([]);
    const [number, setNumber] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [results, setResults] = useState<{ parcels: ParcelaView[]; dataAsOf: string | null } | null>(null);
    const [savedId, setSavedId] = useState<number | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    function onKuChange(value: string) {
        setKuText(value); setKu(null); setError('');
        if (timer.current) clearTimeout(timer.current);
        if (value.trim().length < 2) { setSuggestions([]); return; }
        timer.current = setTimeout(async () => {
            const r = await call({ op: 'ku', q: value });
            if (r.ok) setSuggestions((r.data.results as KatastralniUzemi[]) ?? []); else { setSuggestions([]); setError(r.message); }
        }, 300);
    }

    async function search(e: React.FormEvent) {
        e.preventDefault();
        setError(''); setResults(null); setSavedId(null);
        if (!ku) { setError('Vyberte katastrální území ze seznamu.'); return; }
        const parsed = parseParcelNumber(number);
        if (!parsed) { setError('Zadejte parcelní číslo, např. 123/4 nebo st. 56.'); return; }
        setBusy(true);
        const r = await call({ op: 'parcela', ku: String(ku.kod), kmen: String(parsed.kmen), druh: String(parsed.druh), ...(parsed.poddeleni !== undefined ? { podd: String(parsed.poddeleni) } : {}) });
        setBusy(false);
        if (!r.ok) { setError(r.message); return; }
        const parcels = (r.data.parcels as ParcelaView[] | undefined) ?? [];
        if (!parcels.length) { setError('Parcela s tímto číslem v daném katastrálním území nebyla nalezena.'); return; }
        setResults({ parcels, dataAsOf: (r.data.aktualnostDatK as string | null) ?? null });
    }

    async function save(p: ParcelaView) {
        if (!onSave) return;
        setBusy(true);
        try { await onSave(p, results?.dataAsOf ?? ''); setSavedId(p.id); } catch (err) { setError(err instanceof Error ? err.message : 'Uložení se nepovedlo.'); } finally { setBusy(false); }
    }

    return (
        <div className="space-y-4">
            <form onSubmit={search} className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Landmark size={18} className="text-indigo-700" /> Vyhledat parcelu v katastru</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
                    <div className="relative">
                        <label htmlFor="ku" className="block text-xs font-semibold text-slate-600">Katastrální území (název nebo kód)</label>
                        <input id="ku" value={kuText} onChange={(e) => onKuChange(e.target.value)} autoComplete="off" role="combobox" aria-expanded={suggestions.length > 0} aria-controls="ku-list" className={`${inputCls} mt-1 font-normal`} placeholder="např. Plzeň" />
                        {suggestions.length > 0 && !ku && (
                            <ul id="ku-list" role="listbox" className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                                {suggestions.map((k) => <li key={k.kod} role="option" aria-selected={false}><button type="button" onClick={() => { setKu(k); setKuText(`${k.nazev} (${k.kod})`); setSuggestions([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50">{k.nazev} <span className="text-slate-400">· {k.kod}</span></button></li>)}
                            </ul>
                        )}
                    </div>
                    <div>
                        <label htmlFor="parcela" className="block text-xs font-semibold text-slate-600">Parcelní číslo</label>
                        <input id="parcela" value={number} onChange={(e) => setNumber(e.target.value)} className={`${inputCls} mt-1 font-normal`} placeholder="123/4 nebo st. 56" />
                    </div>
                    <button type="submit" disabled={busy} className={primaryBtn}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Hledat</button>
                </div>
                <p className="mt-3 text-xs text-slate-500">Stavební parcelu zadejte s předponou „st.“. Zdroj: bezplatné API katastru nemovitostí ČÚZK.</p>
                {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            </form>
            {results?.parcels.map((p) => (
                <ParcelCard key={p.id} p={p} dataAsOf={results.dataAsOf}>
                    {onSave && (savedId === p.id
                        ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800"><Check size={15} /> Uloženo do spisu</span>
                        : <button type="button" onClick={() => void save(p)} disabled={busy} className={ghostBtn}><Plus size={15} /> Přidat do spisu</button>)}
                </ParcelCard>
            ))}
        </div>
    );
}
