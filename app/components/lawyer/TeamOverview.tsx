'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarPlus, CalendarDays, Check, ListTodo, Mail, Phone, Plane, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { createTask, deliverTeamNotifications } from '@/lib/teamTasks';
import { EVENT_KIND, pragueToIso, type CalEvent } from '@/lib/agenda';
import { ROLE_LABELS, type FirmRole } from '@/lib/firm';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';
import Avatar from './Avatar';

export type TeamMember = { user_id: string; name: string; email: string; phone: string; role: FirmRole; trainee: boolean; avatar: string | null; open_tasks: number | null; overdue_tasks: number | null; today_events: number | null; absent: boolean | null };
export type TeamData = { manager: boolean; members: TeamMember[] };

export async function loadTeam(): Promise<TeamData | null> {
    const { data, error } = await supabase.rpc('team_overview');
    if (error || !data) return null;
    return data as TeamData;
}

const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date());

// Přehled týmu: adresář pro všechny; vedoucí navíc vidí vytížení (jen počty, ne obsah) a může každému
// jedním tlačítkem zadat úkol nebo ho přidat do kalendáře. Kolega dostane upozornění hned.
export default function TeamOverview() {
    const { userId } = useLawyer();
    const [team, setTeam] = useState<TeamData | null | undefined>(undefined);
    const [form, setForm] = useState<{ member: TeamMember; mode: 'task' | 'event' } | null>(null);
    const [msg, setMsg] = useState('');

    const load = useCallback(async () => { setTeam(await loadTeam()); }, []);
    useEffect(() => { const t = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(t); }, [load]);

    if (!team || team.members.length < 2) return null; // samostatný advokát nebo ještě nespuštěná migrace

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Přehled týmu">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Lidé v kanceláři</h2>
                    <p className="text-sm text-slate-600">{team.manager ? 'Kdo je dnes k dispozici a kolik má práce. Úkol nebo schůzku zadáte jedním tlačítkem, kolega o tom hned ví.' : 'Kontakty na kolegy. Úkol nebo schůzku jim zadáte jedním tlačítkem.'}</p>
                </div>
            </div>
            {msg && <p role="status" className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><Check size={15} /> {msg}</p>}
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {team.members.map((m) => (
                    <li key={m.user_id} className="flex flex-col rounded-xl border border-slate-200 p-4">
                        <div className="flex items-start gap-3">
                            <Avatar src={m.avatar ?? undefined} name={m.name} size={44} />
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-bold text-slate-900">{m.name}{m.user_id === userId && <span className="ml-1 font-normal text-slate-500">(vy)</span>}</p>
                                <p className="text-xs text-slate-500">{m.trainee ? 'Koncipient' : ROLE_LABELS[m.role] ?? 'Člen'}</p>
                                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                                    {m.email && <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1 text-indigo-800 hover:underline"><Mail size={12} /> {m.email}</a>}
                                    {m.phone && <a href={`tel:${m.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1 text-indigo-800 hover:underline"><Phone size={12} /> {m.phone}</a>}
                                </p>
                            </div>
                        </div>
                        {team.manager && (
                            <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold">
                                {m.absent && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-900"><Plane size={12} /> Dnes nepřítomen</span>}
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-700"><ListTodo size={12} /> {m.open_tasks ?? 0} otevřených úkolů</span>
                                {(m.overdue_tasks ?? 0) > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-rose-800"><AlertTriangle size={12} /> {m.overdue_tasks} po termínu</span>}
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-700"><CalendarDays size={12} /> dnes {m.today_events ?? 0} v kalendáři</span>
                            </div>
                        )}
                        {m.user_id !== userId && (
                            <div className="mt-auto flex flex-wrap gap-2 pt-3">
                                <button type="button" onClick={() => { setMsg(''); setForm({ member: m, mode: 'task' }); }} className={ghostBtn}><ListTodo size={15} /> Zadat úkol</button>
                                <button type="button" onClick={() => { setMsg(''); setForm({ member: m, mode: 'event' }); }} className={ghostBtn}><CalendarPlus size={15} /> Do kalendáře</button>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
            {form && <AssignDialog member={form.member} mode={form.mode} me={userId} onClose={() => setForm(null)} onDone={(text) => { setForm(null); setMsg(text); void load(); }} />}
        </section>
    );
}

function AssignDialog({ member, mode, me, onClose, onDone }: { member: TeamMember; mode: 'task' | 'event'; me: string; onClose: () => void; onDone: (msg: string) => void }) {
    const [f, setF] = useState({ title: '', date: today(), from: '09:00', to: '10:00', place: '', note: '', kind: 'schuzka' as CalEvent['kind'], high: false });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (!f.title.trim()) { setErr(mode === 'task' ? 'Napište, co má kolega udělat.' : 'Napište název události.'); return; }
        setBusy(true); setErr('');
        try {
            if (mode === 'task') {
                await createTask({ created_by: me, assignee_id: member.user_id, title: f.title, note: f.note, due_date: f.date, priority: f.high ? 'high' : 'normal' });
            } else {
                if (f.to <= f.from) throw new Error('Konec musí být po začátku.');
                const { error } = await supabase.from('calendar_events').insert({ user_id: me, title: f.title.trim().slice(0, 200), kind: f.kind, starts_at: pragueToIso(f.date, f.from), ends_at: pragueToIso(f.date, f.to), all_day: false, place: f.place.trim().slice(0, 200), note: f.note.trim().slice(0, 2000), attendees: [member.user_id] });
                if (error) throw new Error(/calendar_events|schema cache/i.test(error.message) ? 'Kalendář se zapne po spuštění migrace 20261118_21.' : error.message);
                void deliverTeamNotifications();
            }
            onDone(`${mode === 'task' ? 'Úkol zadán' : 'Událost přidána do kalendáře'}. ${member.name} dostal(a) upozornění.`);
        } catch (x) { setErr(x instanceof Error ? x.message : 'Uložení se nepovedlo.'); } finally { setBusy(false); }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={onClose}>
            <form role="dialog" aria-modal="true" aria-label={mode === 'task' ? `Úkol pro ${member.name}` : `Událost pro ${member.name}`} onClick={(e) => e.stopPropagation()} onSubmit={save} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
                <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{mode === 'task' ? 'Úkol pro' : 'Do kalendáře:'} {member.name}</h2>
                    <button type="button" onClick={onClose} aria-label="Zavřít" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"><X size={18} /></button>
                </div>
                <label className="block text-sm font-semibold text-slate-800">{mode === 'task' ? 'Co udělat' : 'Název'}
                    <input autoFocus value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={200} className={`${inputCls} mt-1 font-normal`} placeholder={mode === 'task' ? 'např. Připravit žalobu Novák' : 'např. Jednání u soudu, porada'} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                    <label className="text-sm font-semibold text-slate-800">{mode === 'task' ? 'Do kdy' : 'Kdy'}<input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} className={`${inputCls} mt-1 font-normal`} /></label>
                    {mode === 'task' ? (
                        <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-slate-800"><input type="checkbox" checked={f.high} onChange={(e) => set('high', e.target.checked)} className="h-4 w-4 accent-indigo-700" /> Spěchá</label>
                    ) : (
                        <label className="text-sm font-semibold text-slate-800">Druh
                            <select value={f.kind} onChange={(e) => set('kind', e.target.value)} className={`${inputCls} mt-1 font-normal`}>{(Object.keys(EVENT_KIND) as CalEvent['kind'][]).filter((k) => k !== 'osobni').map((k) => <option key={k} value={k}>{EVENT_KIND[k]}</option>)}</select>
                        </label>
                    )}
                </div>
                {mode === 'event' && (
                    <div className="grid grid-cols-3 gap-2">
                        <label className="text-sm font-semibold text-slate-800">Od<input type="time" value={f.from} onChange={(e) => set('from', e.target.value)} className={`${inputCls} mt-1 font-normal`} /></label>
                        <label className="text-sm font-semibold text-slate-800">Do<input type="time" value={f.to} onChange={(e) => set('to', e.target.value)} className={`${inputCls} mt-1 font-normal`} /></label>
                        <label className="text-sm font-semibold text-slate-800">Kde<input value={f.place} onChange={(e) => set('place', e.target.value)} maxLength={200} className={`${inputCls} mt-1 font-normal`} /></label>
                    </div>
                )}
                <label className="block text-sm font-semibold text-slate-800">Poznámka (nepovinné)<textarea rows={2} value={f.note} onChange={(e) => set('note', e.target.value)} maxLength={2000} className={`${inputCls} mt-1 font-normal`} /></label>
                {err && <p role="alert" className="text-sm text-rose-700">{err}</p>}
                <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={busy} className={primaryBtn}>{mode === 'task' ? <ListTodo size={15} /> : <CalendarPlus size={15} />} {mode === 'task' ? 'Zadat úkol' : 'Přidat do kalendáře'}</button>
                    <button type="button" onClick={onClose} className={ghostBtn}>Zrušit</button>
                </div>
                <p className="text-xs text-slate-500">{member.name} uvidí {mode === 'task' ? 'úkol v Úkolech' : 'událost ve svém kalendáři'} a hned dostane upozornění do telefonu, nebo e-mailem.</p>
            </form>
        </div>
    );
}
