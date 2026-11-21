'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { confirmAction } from '@/lib/confirm';
import { filterRecipients, validateNotice, type Recipient } from '@/lib/notices';

type Sent = { batch: string; title: string; body: string; created_at: string; total: number; read: number };
const STATUS: Record<string, string> = { trial: 'zkouška', active: 'předplatné', expired: 'vypršelo' };

// Zprávy správce vybraným uživatelům Kanceláře: objeví se jim na stránce „Dnes“
export default function AdminNotices() {
    const [people, setPeople] = useState<Recipient[] | null>(null);
    const [sent, setSent] = useState<Sent[]>([]);
    const [missing, setMissing] = useState(false);
    const [q, setQ] = useState('');
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [d, setD] = useState({ title: '', body: '', link: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [ok, setOk] = useState('');

    const load = useCallback(async () => {
        const [a, n] = await Promise.all([
            supabase.from('lawyer_access').select('user_id, email, display_name, status').order('created_at', { ascending: false }).limit(2000),
            supabase.from('admin_notices').select('batch, title, body, created_at, read_at').order('created_at', { ascending: false }).limit(1000),
        ]);
        setPeople(((a.data ?? []) as Recipient[]).map((r) => ({ ...r, display_name: r.display_name ?? '' })));
        if (n.error) { setMissing(true); return; }
        const groups = new Map<string, Sent>();
        for (const r of (n.data ?? []) as { batch: string; title: string; body: string; created_at: string; read_at: string | null }[]) {
            const g = groups.get(r.batch) ?? { batch: r.batch, title: r.title, body: r.body, created_at: r.created_at, total: 0, read: 0 };
            g.total += 1; if (r.read_at) g.read += 1; groups.set(r.batch, g);
        }
        setSent([...groups.values()]);
    }, []);
    useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

    const shown = useMemo(() => filterRecipients(people ?? [], q), [people, q]);
    const toggle = (id: string) => setPicked((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });

    async function send(e: React.FormEvent) {
        e.preventDefault(); setError(''); setOk('');
        const problem = validateNotice(d, picked.size); if (problem) { setError(problem); return; }
        if (!await confirmAction(`Poslat zprávu ${picked.size} uživatelům?`)) return;
        setBusy(true);
        const batch = crypto.randomUUID();
        const rows = [...picked].map((user_id) => ({ user_id, batch, title: d.title.trim(), body: d.body.trim(), link: d.link.trim() }));
        const { error: err } = await supabase.from('admin_notices').insert(rows);
        setBusy(false);
        if (err) { setError('Zprávu se nepodařilo odeslat.'); return; }
        setOk(`Odesláno ${rows.length} uživatelům. Uvidí ji na stránce Dnes.`); setD({ title: '', body: '', link: '' }); setPicked(new Set()); await load();
    }
    async function remove(batch: string) { if (!await confirmAction('Smazat zprávu všem příjemcům? U těch, kdo ji nepřečetli, zmizí.')) return; await supabase.from('admin_notices').delete().eq('batch', batch); await load(); }

    if (missing) return <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">Upozornění zatím nejsou v databázi zapnutá (chybí spuštění souboru upozorneni.sql).</p>;
    if (!people) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <form onSubmit={send} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="font-bold text-slate-900">Nová zpráva</h2>
                <label className="block text-sm font-semibold text-slate-800">Nadpis<input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} maxLength={120} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                <label className="block text-sm font-semibold text-slate-800">Zpráva<textarea value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} maxLength={1500} rows={5} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" /></label>
                <label className="block text-sm font-semibold text-slate-800">Odkaz v aplikaci (nepovinné)<input value={d.link} onChange={(e) => setD({ ...d, link: e.target.value })} placeholder="/kancelar/veci" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                <p className="text-xs text-slate-500">Vybráno: {picked.size}. Zpráva se uživatelům ukáže na stránce Dnes, dokud ji nepotvrdí.</p>
                {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm text-rose-900">{error}</p>}
                {ok && <p role="status" className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-900">{ok}</p>}
                <button type="submit" disabled={busy} className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"><Send size={15} aria-hidden="true" /> Odeslat vybraným</button>
            </form>
            <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Komu poslat">
                    <h2 className="font-bold text-slate-900">Komu poslat</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hledat jméno nebo e-mail" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                        <button type="button" onClick={() => setPicked(new Set(shown.map((r) => r.user_id)))} className="cursor-pointer rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700">Vybrat zobrazené</button>
                        <button type="button" onClick={() => setPicked(new Set())} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600">Zrušit výběr</button>
                    </div>
                    <ul className="mt-3 max-h-72 divide-y divide-slate-100 overflow-auto rounded-xl border border-slate-200 text-sm">
                        {shown.map((r) => <li key={r.user_id}><label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50"><input type="checkbox" checked={picked.has(r.user_id)} onChange={() => toggle(r.user_id)} className="h-4 w-4 accent-indigo-800" /><span className="min-w-0 flex-1 truncate">{r.display_name ? `${r.display_name} · ` : ''}<span className="text-slate-600">{r.email}</span></span><span className="text-xs text-slate-400">{STATUS[r.status] ?? r.status}</span></label></li>)}
                        {!shown.length && <li className="px-3 py-3 text-slate-500">Nikdo nenalezen.</li>}
                    </ul>
                </section>
                <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Odeslané zprávy">
                    <h2 className="font-bold text-slate-900">Odeslané zprávy</h2>
                    {!sent.length ? <p className="mt-2 text-sm text-slate-500">Zatím nic neodešlo.</p> : <ul className="mt-2 space-y-2">{sent.map((s) => <li key={s.batch} className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex items-start justify-between gap-2"><strong className="text-slate-900">{s.title}</strong><button type="button" onClick={() => void remove(s.batch)} aria-label="Smazat" className="cursor-pointer text-rose-800"><Trash2 size={14} /></button></div><p className="text-xs text-slate-500">{new Date(s.created_at).toLocaleString('cs-CZ')} · přečetlo {s.read} z {s.total}</p></li>)}</ul>}
                </section>
            </div>
        </div>
    );
}
