'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, ExternalLink, Loader2, Lock, Plus, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PLANS } from '@/lib/plans';
import { parseCzDate } from '@/lib/isir';
import { czk } from '@/lib/lawyer';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import AresPicker from './AresPicker';

type Status = { active: boolean; scope: 'firm' | 'solo'; until: string | null; can_buy: boolean; firm: string | null };
type Prices = { solo: Record<string, number>; firm: Record<string, number> };
type Watch = { id: string; label: string; kind: 'firma' | 'osoba'; ic: string; name: string; first_name: string; birth: string | null; last_checked_at: string | null; last_error: string };
type Hit = { id: string; watch_id: string; spis: string; court: string; debtor: string; state: string; started: string | null; ended: string | null; url: string; seen: boolean; first_seen_at: string; changed_at: string };

const fmt = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('cs-CZ') : '–');
const STALE_MS = 12 * 3_600_000;

async function api(body: Record<string, unknown>) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/isir', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({})) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, json };
}

// Hlídání insolvenčního rejstříku: placený příplatek (kancelář platí jednou za všechny, samostatný advokát za sebe)
export default function LawyerInsolvency() {
    const [status, setStatus] = useState<Status | null | undefined>(undefined);
    const [prices, setPrices] = useState<Prices | null>(null);
    const [watches, setWatches] = useState<Watch[]>([]);
    const [hits, setHits] = useState<Hit[]>([]);
    const [busy, setBusy] = useState('');
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');
    const [plan, setPlan] = useState<'month' | 'half' | 'year'>('half');
    const [kind, setKind] = useState<'firma' | 'osoba'>('firma');
    const [form, setForm] = useState({ label: '', ic: '', name: '', firstName: '', birth: '' });

    const load = useCallback(async () => {
        const [st, pr] = await Promise.all([supabase.rpc('isir_status'), supabase.rpc('isir_prices')]);
        if (st.error) { setStatus(null); setError(/isir_status|find the function|schema cache/i.test(st.error.message) ? 'Hlídání insolvence zatím není v databázi zapnuté (chybí spuštění souboru insolvence.sql).' : st.error.message); return; }
        const s = st.data as Status;
        setStatus(s); setPrices((pr.data as Prices) ?? null);
        if (!s.active) return;
        const [w, h] = await Promise.all([supabase.from('isir_watches').select('*').order('created_at', { ascending: false }), supabase.from('isir_hits').select('*').order('changed_at', { ascending: false })]);
        setWatches((w.data ?? []) as Watch[]); setHits((h.data ?? []) as Hit[]);
    }, []);
    useEffect(() => { let alive = true; Promise.resolve().then(() => { if (alive) void load(); }); return () => { alive = false; }; }, [load]);
    // Předvyplnění z karty klienta: ?ic=…&name=…
    useEffect(() => {
        const q = new URLSearchParams(window.location.search);
        const ic = q.get('ic'); const name = q.get('name');
        if (!ic) return;
        const t = window.setTimeout(() => { setKind('firma'); setForm((f) => ({ ...f, ic, label: name ?? f.label })); }, 0);
        return () => window.clearTimeout(t);
    }, []);

    // Při otevření se zastaralé kontroly (starší 12 hodin) provedou samy
    useEffect(() => {
        if (!status?.active || !watches.length) return;
        if (watches.some((w) => !w.last_checked_at || Date.now() - new Date(w.last_checked_at).getTime() > STALE_MS)) {
            let alive = true;
            api({ action: 'check' }).then(() => { if (alive) void load(); });
            return () => { alive = false; };
        }
    }, [status?.active, watches.length]); // eslint-disable-line react-hooks/exhaustive-deps

    async function order() {
        setBusy('order'); setError(''); setMsg('');
        const { error: err } = await supabase.rpc('create_isir_order', { p_plan: plan });
        setBusy('');
        if (err) { setError(err.message); return; }
        setMsg('Objednávka je vytvořená. Platební brána se zapojuje, do té doby platbu potvrdí provozovatel ručně po zaplacení. Hlídání se pak samo odemkne.');
    }

    async function add(e: React.FormEvent) {
        e.preventDefault();
        setError(''); setMsg('');
        const birthIso = kind === 'osoba' ? parseCzDate(form.birth) : null;
        if (kind === 'osoba' && !birthIso) { setError('Datum narození zadejte ve tvaru den. měsíc. rok, např. 5. 3. 1980 (rok čtyřmístně).'); return; }
        setBusy('add');
        const row = kind === 'firma'
            ? { kind, label: form.label.trim() || `IČO ${form.ic}`, ic: form.ic.replace(/\s+/g, '') }
            : { kind, label: form.label.trim() || `${form.firstName} ${form.name}`.trim(), name: form.name.trim(), first_name: form.firstName.trim(), birth: birthIso };
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error: err } = await supabase.from('isir_watches').insert({ ...row, user_id: user?.id }).select('*').single();
        if (err) { setBusy(''); setError(/check constraint/i.test(err.message) ? (kind === 'firma' ? 'Zadejte 8místné IČO.' : 'Vyplňte jméno, příjmení a datum narození.') : err.message); return; }
        const r = await api({ action: 'check', watchId: (data as Watch).id });
        setBusy('');
        setForm({ label: '', ic: '', name: '', firstName: '', birth: '' });
        setMsg(r.ok ? `Přidáno k hlídání. Nalezeno řízení: ${Number(r.json.added ?? 0)}.` : 'Přidáno k hlídání, první kontrola se nepodařila. Zkuste „Zkontrolovat nyní“.');
        await load();
    }

    async function checkAll() {
        setBusy('check'); setError(''); setMsg('');
        const r = await api({ action: 'check' });
        setBusy('');
        if (!r.ok) { setError(r.status === 429 ? 'Příliš mnoho kontrol, zkuste to za chvíli.' : 'Kontrola se nepodařila.'); return; }
        const errors = (r.json.errors as string[] | undefined) ?? [];
        setMsg(`Zkontrolováno ${Number(r.json.checked)} osob. Nová řízení: ${Number(r.json.added)}, změny: ${Number(r.json.changed)}.${errors.length ? ` Rejstřík hlásí: ${errors.join('; ')}` : ''}`);
        await load();
    }

    async function remove(w: Watch) {
        if (!window.confirm(`Přestat hlídat „${w.label}“? Smažou se i uložené nálezy.`)) return;
        const { error: err } = await supabase.from('isir_watches').delete().eq('id', w.id);
        if (err) { setError(err.message); return; }
        await load();
    }
    async function markSeen(ids: string[]) {
        await supabase.from('isir_hits').update({ seen: true }).in('id', ids);
        setHits((l) => l.map((h) => (ids.includes(h.id) ? { ...h, seen: true } : h)));
    }

    if (status === undefined) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (status === null) return <p role="alert" className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">{error}</p>;

    // Bez příplatku: nabídka
    if (!status.active) {
        const table = prices?.[status.scope] ?? {};
        return (
            <div className="space-y-5">
                <section className="rounded-2xl border border-slate-200 bg-white p-6">
                    <ShieldAlert size={28} className="text-indigo-700" aria-hidden="true" />
                    <h2 className="mt-3 text-xl font-bold text-slate-900">Hlídání v insolvenčním rejstříku</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Zadáte klienty a protistrany, které chcete sledovat, a aplikace je pravidelně kontroluje v insolvenčním rejstříku. Nové insolvenční řízení nebo změnu stavu uvidíte hned na přehledu, takže nepropásnete lhůtu pro přihlášku pohledávky.</p>
                    <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-950">{status.scope === 'firm'
                        ? <>Příplatek platí <strong>vedoucí kanceláře jednou</strong> a hlídání se odemkne všem členům{status.firm ? ` kanceláře ${status.firm}` : ''}. Každý člen má svůj vlastní seznam hlídaných osob.</>
                        : <>Samostatný advokát si příplatek platí <strong>jen pro sebe</strong>, vedle běžného předplatného.</>}</p>
                    {status.can_buy ? (
                        <div className="mt-5">
                            <div className="grid gap-3 sm:grid-cols-3">
                                {PLANS.map((p) => {
                                    const price = Number(table[p.id] ?? 0);
                                    return <button key={p.id} type="button" aria-pressed={plan === p.id} disabled={price <= 0} onClick={() => setPlan(p.id)} className={`rounded-xl border p-4 text-left disabled:opacity-50 ${plan === p.id ? 'border-2 border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}><span className="block text-sm font-bold text-slate-900">{p.name}</span><span className="mt-1 block text-lg font-bold text-indigo-900">{price > 0 ? czk(price) : 'cena brzy'}</span></button>;
                                })}
                            </div>
                            <button type="button" onClick={() => void order()} disabled={busy === 'order' || !Number(table[plan])} className={`${primaryBtn} mt-4`}>{busy === 'order' && <Loader2 size={15} className="animate-spin" />} Objednat hlídání</button>
                        </div>
                    ) : <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700"><Lock size={15} /> Hlídání insolvence kanceláře objedná vedoucí kanceláře.</p>}
                    {msg && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{msg}</p>}
                    {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
                </section>
                <p className="text-xs text-slate-500">Údaje pocházejí z veřejného insolvenčního rejstříku (Ministerstvo spravedlnosti). Hlídat lze jen osoby, které souvisejí s vaší právní službou (klienti, protistrany).</p>
            </div>
        );
    }

    const unseen = hits.filter((h) => !h.seen);
    const label = 'block text-xs font-semibold text-slate-600';
    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                <Check size={16} aria-hidden="true" />
                <span className="min-w-0 flex-1"><strong>Hlídání je aktivní do {fmt(status.until)}.</strong> {status.scope === 'firm' ? 'Hradí kancelář, platí pro všechny členy.' : 'Platí jen pro vás.'} Kontrola probíhá denně a při otevření této stránky.</span>
                <button type="button" onClick={() => void checkAll()} disabled={busy === 'check' || watches.length === 0} className={ghostBtn}>{busy === 'check' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Zkontrolovat nyní</button>
            </div>
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            {msg && <p role="status" className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{msg}</p>}

            {unseen.length > 0 && (
                <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5" aria-label="Nové nálezy">
                    <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-bold text-amber-950"><AlertTriangle size={18} /> Nové nálezy ({unseen.length})</h2><button type="button" onClick={() => void markSeen(unseen.map((h) => h.id))} className={ghostBtn}>Označit vše jako přečtené</button></div>
                    <ul className="mt-3 space-y-2">{unseen.map((h) => <HitRow key={h.id} h={h} watch={watches.find((w) => w.id === h.watch_id)} onSeen={() => void markSeen([h.id])} />)}</ul>
                </section>
            )}

            <form onSubmit={add} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold text-slate-900">Přidat k hlídání</h2>
                <div className="flex gap-1.5" role="tablist" aria-label="Druh hlídané osoby">
                    {([['firma', 'Firma (IČO)'], ['osoba', 'Fyzická osoba']] as const).map(([id, name]) => <button key={id} type="button" role="tab" aria-selected={kind === id} onClick={() => setKind(id)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${kind === id ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{name}</button>)}
                </div>
                {kind === 'firma' ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2"><AresPicker compact label="Najít firmu v ARES" onPick={(c) => setForm((f) => ({ ...f, ic: c.ico, label: c.name }))} /></div>
                        <label className={label}>IČO *<input value={form.ic} onChange={(e) => setForm((f) => ({ ...f, ic: e.target.value }))} inputMode="numeric" maxLength={12} required className={`${inputCls} mt-1 font-normal`} /></label>
                        <label className={label}>Název (jak se bude zobrazovat)<input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} maxLength={160} className={`${inputCls} mt-1 font-normal`} /></label>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-3">
                        <label className={label}>Jméno *<input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required maxLength={80} className={`${inputCls} mt-1 font-normal`} /></label>
                        <label className={label}>Příjmení *<input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required maxLength={80} className={`${inputCls} mt-1 font-normal`} /></label>
                        <label className={label}>Datum narození *<input value={form.birth} onChange={(e) => setForm((f) => ({ ...f, birth: e.target.value.replace(/[^\d.\s/-]/g, '') }))} required inputMode="numeric" maxLength={12} placeholder="např. 5. 3. 1980" aria-invalid={form.birth !== '' && !parseCzDate(form.birth)} className={`${inputCls} mt-1 font-normal`} /></label>
                    </div>
                )}
                <button type="submit" disabled={busy === 'add'} className={primaryBtn}>{busy === 'add' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Přidat a zkontrolovat</button>
                <p className="text-xs text-slate-500">Fyzickou osobu rejstřík hledá podle jména, příjmení a data narození. Hlídejte jen klienty a protistrany ve svých věcech; osobní údaje zpracováváte jako správce vy.</p>
            </form>

            <section aria-label="Hlídané osoby">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Hlídané osoby ({watches.length}/50)</h2>
                {watches.length === 0 ? <p className="mt-2 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">Zatím nikoho nehlídáte.</p> : (
                    <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                        {watches.map((w) => {
                            const mine = hits.filter((h) => h.watch_id === w.id);
                            const active = mine.filter((h) => !h.ended);
                            return (
                                <li key={w.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-semibold text-slate-900">{w.label}</p>
                                        <p className="truncate text-xs text-slate-500">{w.kind === 'firma' ? `IČO ${w.ic}` : `nar. ${fmt(w.birth)}`} · {w.last_checked_at ? `zkontrolováno ${fmt(w.last_checked_at)}` : 'ještě nezkontrolováno'}{w.last_error ? ` · chyba: ${w.last_error}` : ''}</p>
                                    </div>
                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${active.length ? 'bg-rose-100 text-rose-900' : mine.length ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-900'}`}>{active.length ? `v insolvenci (${active.length})` : mine.length ? 'řízení ukončeno' : 'bez nálezu'}</span>
                                    <button type="button" onClick={() => void remove(w)} aria-label={`Přestat hlídat ${w.label}`} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={15} /></button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {hits.some((h) => h.seen) && (
                <section aria-label="Dřívější nálezy"><h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Dřívější nálezy</h2>
                    <ul className="mt-2 space-y-2">{hits.filter((h) => h.seen).map((h) => <HitRow key={h.id} h={h} watch={watches.find((w) => w.id === h.watch_id)} />)}</ul>
                </section>
            )}
            <p className="text-xs leading-relaxed text-slate-500">Zdroj: veřejný insolvenční rejstřík (Ministerstvo spravedlnosti). Údaje v rejstříku mohou být zpožděné, vždy si je před jednáním ověřte přímo v rejstříku (odkaz u každého nálezu). Služba nenahrazuje vlastní prověření advokátem.</p>
        </div>
    );
}

function HitRow({ h, watch, onSeen }: { h: Hit; watch?: Watch; onSeen?: () => void }) {
    return (
        <li className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-slate-900">{watch?.label ?? h.debtor}</p><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${h.ended ? 'bg-slate-100 text-slate-700' : 'bg-rose-100 text-rose-900'}`}>{h.state}{h.ended ? ` · ukončeno ${fmt(h.ended)}` : ''}</span></div>
            <p className="mt-1 text-slate-700">{h.spis} · {h.court}</p>
            <p className="mt-0.5 text-xs text-slate-500">{h.started ? `zahájeno ${fmt(h.started)} · ` : ''}zjištěno {fmt(h.first_seen_at)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
                {h.url && <a href={h.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"><ExternalLink size={12} /> Otevřít v rejstříku</a>}
                {onSeen && <button type="button" onClick={onSeen} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer">Přečteno</button>}
            </div>
        </li>
    );
}
