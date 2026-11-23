'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ClipboardCheck, Megaphone, Pin, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { confirmAction } from '@/lib/confirm';
import { deliverTeamNotifications } from '@/lib/teamTasks';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';
import { loadTeam, type TeamData } from './TeamOverview';

type Post = { id: string; firm_id: string; author_id: string; kind: 'oznameni' | 'smernice'; title: string; body: string; requires_ack: boolean; pinned: boolean; created_at: string };
type Ack = { post_id: string; user_id: string; acked_at: string };

// Nástěnka kanceláře: vedoucí sem dává oznámení a směrnice. U směrnice každý potvrdí „Přečetl(a) jsem“
// a vedoucí vidí, kdo už potvrdil. Na stránce Dnes se ukazuje zkráceně (manage = false).
export default function FirmBoard({ manage = false }: { manage?: boolean }) {
    const { userId } = useLawyer();
    const [posts, setPosts] = useState<Post[] | null>(null);
    const [acks, setAcks] = useState<Ack[]>([]);
    const [team, setTeam] = useState<TeamData | null>(null);
    const [firmId, setFirmId] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [f, setF] = useState({ title: '', body: '', smernice: false, pinned: false });
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    // Čas načtení: na stránce Dnes se ukazují příspěvky z posledních 14 dnů
    const [loadedAt, setLoadedAt] = useState(0);

    const load = useCallback(async () => {
        const [p, a, t, fid] = await Promise.all([
            supabase.from('firm_posts').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(30),
            supabase.from('firm_post_acks').select('post_id, user_id, acked_at'),
            loadTeam(),
            supabase.rpc('my_firm_id'),
        ]);
        if (p.error) { setPosts(null); return; }
        setPosts((p.data ?? []) as Post[]);
        setAcks(a.error ? [] : (a.data ?? []) as Ack[]);
        setTeam(t);
        setFirmId(typeof fid.data === 'string' ? fid.data : null);
        setLoadedAt(Date.now());
    }, []);
    useEffect(() => { const t = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(t); }, [load]);

    if (posts === null || !firmId) return null; // mimo kancelář nebo před spuštěním migrace
    const isManager = !!team?.manager;
    const others = (team?.members ?? []).filter((m) => m.user_id !== userId);
    const mine = (id: string) => acks.some((a) => a.post_id === id && a.user_id === userId);
    const shown = manage ? posts : posts.filter((p) => p.pinned || (p.requires_ack && !mine(p.id) && p.author_id !== userId) || loadedAt - Date.parse(p.created_at) < 14 * 86_400_000).slice(0, 4);
    if (!manage && shown.length === 0) return null;

    async function ack(p: Post) {
        const { error } = await supabase.from('firm_post_acks').insert({ post_id: p.id, user_id: userId });
        if (!error) setAcks((l) => [...l, { post_id: p.id, user_id: userId, acked_at: new Date().toISOString() }]);
    }
    async function publish(e: React.FormEvent) {
        e.preventDefault();
        if (f.title.trim().length < 2) { setErr('Napište nadpis.'); return; }
        setBusy(true); setErr('');
        const { error } = await supabase.from('firm_posts').insert({ firm_id: firmId, author_id: userId, kind: f.smernice ? 'smernice' : 'oznameni', title: f.title.trim().slice(0, 160), body: f.body.trim().slice(0, 5000), requires_ack: f.smernice, pinned: f.pinned });
        setBusy(false);
        if (error) { setErr(error.message); return; }
        void deliverTeamNotifications();
        setF({ title: '', body: '', smernice: false, pinned: false }); setAdding(false); await load();
    }
    async function remove(p: Post) {
        if (!(await confirmAction(`Smazat z nástěnky „${p.title}“?`, { confirmLabel: 'Smazat', danger: true }))) return;
        const { error } = await supabase.from('firm_posts').delete().eq('id', p.id);
        if (!error) await load();
    }

    return (
        <section id="nastenka" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Nástěnka kanceláře">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Megaphone size={18} className="text-indigo-700" aria-hidden="true" /> Nástěnka kanceláře</h2>
                {manage && isManager && !adding && <button type="button" onClick={() => setAdding(true)} className={primaryBtn}><Plus size={15} /> Nový příspěvek</button>}
            </div>
            {manage && <p className="mt-1 text-sm text-slate-600">{isManager ? 'Oznámení a směrnice pro celou kancelář. Každý dostane upozornění; u směrnice uvidíte, kdo ji potvrdil.' : 'Oznámení a směrnice od vedoucího kanceláře.'}</p>}

            {adding && (
                <form onSubmit={publish} className="mt-4 space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
                    <input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={160} placeholder="Nadpis, např. Od pondělí nové úřední hodiny" className={inputCls} aria-label="Nadpis" />
                    <textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={5000} rows={4} placeholder="Text (nepovinné)" className={inputCls} aria-label="Text" />
                    <div className="flex flex-wrap gap-4 text-sm">
                        <label className="flex cursor-pointer items-center gap-2 font-semibold text-slate-800"><input type="checkbox" checked={f.smernice} onChange={(e) => setF({ ...f, smernice: e.target.checked })} className="h-4 w-4 accent-indigo-700" /> Směrnice: každý musí potvrdit, že ji četl</label>
                        <label className="flex cursor-pointer items-center gap-2 font-semibold text-slate-800"><input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} className="h-4 w-4 accent-indigo-700" /> Připnout nahoru</label>
                    </div>
                    {err && <p role="alert" className="text-sm text-rose-700">{err}</p>}
                    <div className="flex gap-2"><button type="submit" disabled={busy} className={primaryBtn}>Zveřejnit</button><button type="button" onClick={() => setAdding(false)} className={ghostBtn}>Zrušit</button></div>
                </form>
            )}

            {shown.length === 0 ? (
                <p className="mt-4 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">{isManager ? 'Zatím tu nic není. Přidejte první oznámení, třeba provozní informace nebo směrnici k mlčenlivosti.' : 'Zatím tu nic není.'}</p>
            ) : (
                <ul className="mt-4 space-y-3">
                    {shown.map((p) => {
                        const done = acks.filter((a) => a.post_id === p.id);
                        const missing = others.filter((m) => m.user_id !== p.author_id && !done.some((a) => a.user_id === m.user_id));
                        const author = team?.members.find((m) => m.user_id === p.author_id)?.name ?? 'Vedoucí';
                        return (
                            <li key={p.id} className={`rounded-xl border p-4 ${p.requires_ack && !mine(p.id) && p.author_id !== userId ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}>
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500">
                                            {p.pinned && <span className="inline-flex items-center gap-1 text-indigo-800"><Pin size={12} /> Připnuto</span>}
                                            {p.kind === 'smernice' && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">Směrnice</span>}
                                            {author} · {new Date(p.created_at).toLocaleDateString('cs-CZ')}
                                        </p>
                                        <h3 className="mt-1 font-bold text-slate-900">{p.title}</h3>
                                    </div>
                                    {manage && isManager && <button type="button" onClick={() => void remove(p)} aria-label="Smazat" className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"><Trash2 size={15} /></button>}
                                </div>
                                {p.body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{p.body}</p>}
                                {p.requires_ack && p.author_id !== userId && (
                                    mine(p.id)
                                        ? <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800"><Check size={15} /> Potvrzeno</p>
                                        : <button type="button" onClick={() => void ack(p)} className={`${primaryBtn} mt-3`}><ClipboardCheck size={15} /> Přečetl(a) jsem</button>
                                )}
                                {p.requires_ack && isManager && (
                                    <p className="mt-3 text-xs text-slate-600"><strong>Potvrdilo {done.length} z {done.length + missing.length}.</strong>{missing.length > 0 && <> Chybí: {missing.map((m) => m.name).join(', ')}.</>}</p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
