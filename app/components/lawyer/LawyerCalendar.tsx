'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, Flag, ListTodo, Loader2, MapPin, Plus, Trash2, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadCases, type LegalCase } from '@/lib/cases';
import { collectDeadlines, loadAllDeadlines, type CaseDeadline } from '@/lib/caseFile';
import { todayIso } from '@/lib/billing';
import { confirmAction } from '@/lib/confirm';
import { scheduleGoogleSync } from '@/lib/googleSync';
import { EVENT_KIND, KIND_LABEL, addDays, byDate, eventItems, monthGrid, pragueParts, pragueToIso, shiftMonth, sortItems, taskItems, type AgendaItem, type CalEvent, type TeamTask } from '@/lib/agenda';
import { loadColleagues, loadEvents, loadNames, loadTasks, type Colleague } from '@/lib/teamTasks';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';
import { TaskForm } from './LawyerTeamTasks';

const COLOR: Record<AgendaItem['kind'], string> = { lhuta: 'bg-rose-100 text-rose-900', ukol: 'bg-amber-100 text-amber-950', tym: 'bg-violet-100 text-violet-900', udalost: 'bg-indigo-100 text-indigo-900' };
const DOW = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
type EvForm = { id?: string; title: string; kind: CalEvent['kind']; date: string; dateTo: string; allDay: boolean; from: string; to: string; place: string; note: string; case_id: string; attendees: string[] };
const emptyEv = (date: string): EvForm => ({ title: '', kind: 'jednani', date, dateTo: date, allDay: false, from: '09:00', to: '10:00', place: '', note: '', case_id: '', attendees: [] });

// Kalendář kanceláře: lhůty a úkoly z věcí, úkoly od a pro kolegy a události (jednání, schůzky) s pozvanými kolegy
export default function LawyerCalendar() {
    const { userId } = useLawyer();
    const today = todayIso();
    const [ym, setYm] = useState(today.slice(0, 7));
    const [view, setView] = useState<'mesic' | 'seznam'>('mesic');
    const [day, setDay] = useState(today);
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [customs, setCustoms] = useState<CaseDeadline[]>([]);
    const [tasks, setTasks] = useState<TeamTask[] | null>([]);
    const [events, setEvents] = useState<CalEvent[] | null>([]);
    const [names, setNames] = useState<Record<string, string>>({});
    const [colleagues, setColleagues] = useState<Colleague[]>([]);
    const [show, setShow] = useState({ lhuta: true, ukol: true, tym: true, udalost: true });
    const [evForm, setEvForm] = useState<EvForm | null>(null);
    const [taskForm, setTaskForm] = useState<string | null>(null);
    const [openEv, setOpenEv] = useState<string | null>(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('udalost') : null));
    const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [loading, setLoading] = useState(true);

    const range = useMemo(() => { const g = monthGrid(ym); return { from: g[0][0], to: addDays(g.at(-1)!.at(-1)!, view === 'seznam' ? 62 : 1) }; }, [ym, view]);
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [cs, cu, t, ev, col] = await Promise.all([loadCases().catch(() => [] as LegalCase[]), loadAllDeadlines().catch(() => [] as CaseDeadline[]), loadTasks().catch(() => null), loadEvents(pragueToIso(range.from), pragueToIso(range.to)).catch(() => null), loadColleagues()]);
            setCases(cs); setCustoms(cu); setTasks(t); setEvents(ev); setColleagues(col);
            setNames(await loadNames([...(t ?? []).flatMap((x) => [x.created_by, x.assignee_id]), ...(ev ?? []).flatMap((e) => [e.user_id, ...e.attendees])]));
        } catch { setErr('Kalendář se nepodařilo načíst. Zkontrolujte připojení a obnovte stránku.'); } finally { setLoading(false); }
    }, [range.from, range.to]);
    useEffect(() => { let a = true; Promise.resolve().then(() => { if (a) void load(); }); return () => { a = false; }; }, [load]);

    const items = useMemo(() => {
        const out: AgendaItem[] = [];
        for (const c of cases) {
            if (c.status === 'done') continue;
            for (const d of collectDeadlines(c, customs.filter((x) => x.case_id === c.id))) {
                if (d.iso < range.from || d.iso > range.to) continue;
                out.push({ id: `dl-${c.id}-${d.key}`, kind: d.kind === 'ukol' ? 'ukol' : 'lhuta', date: d.iso, title: d.title, sub: c.title, href: `/kancelar/veci/${c.id}`, done: d.done });
            }
        }
        out.push(...taskItems(tasks ?? [], userId, names), ...eventItems(events ?? [], userId, names));
        return out.filter((i) => show[i.kind]);
    }, [cases, customs, tasks, events, userId, names, show, range.from, range.to]);
    const map = useMemo(() => byDate(items), [items]);
    const weeks = monthGrid(ym);
    const ev = openEv ? (events ?? []).find((e) => e.id === openEv) ?? null : null;

    async function saveEvent() {
        if (!evForm) return;
        if (!evForm.title.trim()) { setErr('Napište název události.'); return; }
        const starts = evForm.allDay ? pragueToIso(evForm.date) : pragueToIso(evForm.date, evForm.from);
        const ends = evForm.allDay ? pragueToIso(addDays(evForm.dateTo < evForm.date ? evForm.date : evForm.dateTo, 1)) : pragueToIso(evForm.dateTo < evForm.date ? evForm.date : evForm.dateTo, evForm.to);
        if (ends < starts) { setErr('Konec musí být po začátku.'); return; }
        setBusy(true); setErr('');
        const row = { user_id: userId, title: evForm.title.trim().slice(0, 200), kind: evForm.kind, starts_at: starts, ends_at: evForm.allDay ? pragueToIso(addDays(evForm.dateTo < evForm.date ? evForm.date : evForm.dateTo, 0), '23:59') : ends, all_day: evForm.allDay, place: evForm.place.trim().slice(0, 200), note: evForm.note.trim().slice(0, 2000), case_id: evForm.case_id || null, attendees: evForm.attendees };
        const { error } = evForm.id ? await supabase.from('calendar_events').update(row).eq('id', evForm.id) : await supabase.from('calendar_events').insert(row);
        setBusy(false);
        if (error) { setErr(/calendar_events|schema cache/i.test(error.message) ? 'Kalendář se zapne po spuštění migrace 20261118_21.' : error.message); return; }
        setEvForm(null); setDay(evForm.date); scheduleGoogleSync(); await load();
    }
    async function removeEvent(e: CalEvent) {
        if (!(await confirmAction(`Smazat událost „${e.title}“?${e.attendees.length ? ' Zmizí i pozvaným kolegům.' : ''}`))) return;
        const { error } = await supabase.from('calendar_events').delete().eq('id', e.id);
        if (error) setErr(error.message); else { setOpenEv(null); scheduleGoogleSync(); await load(); }
    }
    function editEvent(e: CalEvent) {
        const s = pragueParts(e.starts_at), f = pragueParts(e.ends_at);
        setEvForm({ id: e.id, title: e.title, kind: e.kind, date: s.date, dateTo: f.date, allDay: e.all_day, from: s.time, to: f.time, place: e.place, note: e.note, case_id: e.case_id ?? '', attendees: e.attendees }); setOpenEv(null);
    }

    const chip = (i: AgendaItem, compact = false) => {
        const evId = i.kind === 'udalost' ? i.id.replace(/^ev-/, '').slice(0, 36) : null;
        const body = <><span className="font-semibold">{i.start ? `${i.start} ` : ''}{i.high && <Flag size={10} className="mr-0.5 inline" aria-hidden="true" />}{i.title}</span>{!compact && i.sub && <span className="block text-xs opacity-80">{i.sub}</span>}</>;
        const cls = `block w-full truncate rounded-md px-1.5 py-0.5 text-left text-xs ${COLOR[i.kind]} ${i.done ? 'line-through opacity-60' : ''}`;
        return evId ? <button key={i.id} type="button" onClick={(e) => { e.stopPropagation(); setOpenEv(evId); }} className={`${cls} cursor-pointer`} title={`${i.title}${i.sub ? ` · ${i.sub}` : ''}`}>{body}</button>
            : <Link key={i.id} href={i.href} onClick={(e) => e.stopPropagation()} className={cls} title={`${KIND_LABEL[i.kind]}: ${i.title}${i.sub ? ` · ${i.sub}` : ''}`}>{body}</Link>;
    };
    const missing = tasks === null || events === null;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setYm(shiftMonth(ym, -1))} aria-label="Předchozí měsíc" className={ghostBtn}><ChevronLeft size={16} /></button>
                <h2 className="min-w-44 text-center text-lg font-bold capitalize text-slate-900">{new Date(`${ym}-15T12:00:00`).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}</h2>
                <button type="button" onClick={() => setYm(shiftMonth(ym, 1))} aria-label="Další měsíc" className={ghostBtn}><ChevronRight size={16} /></button>
                <button type="button" onClick={() => { setYm(today.slice(0, 7)); setDay(today); }} className={ghostBtn}>Dnes</button>
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist">{([['mesic', 'Měsíc'], ['seznam', 'Seznam']] as const).map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`rounded-lg px-3 py-1 text-sm font-semibold cursor-pointer ${view === id ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'}`}>{l}</button>)}</div>
                {loading && <Loader2 size={16} className="animate-spin text-slate-400" aria-label="Načítám" />}
                <span className="ml-auto flex flex-wrap gap-2">
                    <button type="button" onClick={() => setTaskForm(day)} className={ghostBtn}><ListTodo size={15} /> Úkol</button>
                    <button type="button" onClick={() => setEvForm(emptyEv(day))} className={primaryBtn}><Plus size={15} /> Událost</button>
                </span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">{(Object.keys(show) as AgendaItem['kind'][]).map((k) => <label key={k} className="flex items-center gap-1.5"><input type="checkbox" checked={show[k]} onChange={(e) => setShow({ ...show, [k]: e.target.checked })} /><span className={`rounded px-1.5 py-0.5 ${COLOR[k]}`}>{KIND_LABEL[k]}</span></label>)}</div>
            {missing && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Události a úkoly pro kolegy se zapnou po spuštění migrace 20261118_21. Lhůty z věcí kalendář ukazuje už teď.</p>}
            {err && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{err}</p>}

            {taskForm && <TaskForm colleagues={colleagues} cases={cases} me={userId} initial={{ date: taskForm }} onDone={() => { setTaskForm(null); void load(); }} />}
            {evForm && (
                <form onSubmit={(e) => { e.preventDefault(); void saveEvent(); }} className="grid gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 sm:grid-cols-6" aria-label="Událost">
                    <label className="text-xs font-semibold text-slate-600 sm:col-span-4">Název<input value={evForm.title} onChange={(e) => setEvForm({ ...evForm, title: e.target.value })} maxLength={200} placeholder="např. Jednání u OS Plzeň-město" className={`${inputCls} mt-0.5 font-normal`} /></label>
                    <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Druh<select value={evForm.kind} onChange={(e) => setEvForm({ ...evForm, kind: e.target.value as CalEvent['kind'] })} className={`${inputCls} mt-0.5 font-normal`}>{Object.entries(EVENT_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                    <label className="text-xs font-semibold text-slate-600">Den<input type="date" value={evForm.date} onChange={(e) => setEvForm({ ...evForm, date: e.target.value, dateTo: evForm.dateTo < e.target.value ? e.target.value : evForm.dateTo })} className={`${inputCls} mt-0.5 font-normal`} /></label>
                    {!evForm.allDay && <><label className="text-xs font-semibold text-slate-600">Od<input type="time" value={evForm.from} onChange={(e) => setEvForm({ ...evForm, from: e.target.value })} className={`${inputCls} mt-0.5 font-normal`} /></label><label className="text-xs font-semibold text-slate-600">Do<input type="time" value={evForm.to} onChange={(e) => setEvForm({ ...evForm, to: e.target.value })} className={`${inputCls} mt-0.5 font-normal`} /></label></>}
                    {evForm.allDay && <label className="text-xs font-semibold text-slate-600">Do dne<input type="date" value={evForm.dateTo} min={evForm.date} onChange={(e) => setEvForm({ ...evForm, dateTo: e.target.value })} className={`${inputCls} mt-0.5 font-normal`} /></label>}
                    <label className="flex items-end gap-2 pb-2 text-sm text-slate-800"><input type="checkbox" checked={evForm.allDay} onChange={(e) => setEvForm({ ...evForm, allDay: e.target.checked })} /> Celý den</label>
                    <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Místo<input value={evForm.place} onChange={(e) => setEvForm({ ...evForm, place: e.target.value })} maxLength={200} placeholder="např. jednací síň 12" className={`${inputCls} mt-0.5 font-normal`} /></label>
                    <label className="text-xs font-semibold text-slate-600 sm:col-span-3">Věc (nepovinné)<select value={evForm.case_id} onChange={(e) => setEvForm({ ...evForm, case_id: e.target.value })} className={`${inputCls} mt-0.5 font-normal`}><option value="">Bez věci</option>{cases.filter((c) => c.status === 'open').map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
                    {colleagues.filter((c) => c.user_id !== userId).length > 0 && <fieldset className="sm:col-span-3"><legend className="text-xs font-semibold text-slate-600">Pozvat kolegy (uvidí ji ve svém kalendáři)</legend><div className="mt-1 flex flex-wrap gap-3">{colleagues.filter((c) => c.user_id !== userId).map((c) => <label key={c.user_id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={evForm.attendees.includes(c.user_id)} onChange={(e) => setEvForm({ ...evForm, attendees: e.target.checked ? [...evForm.attendees, c.user_id] : evForm.attendees.filter((x) => x !== c.user_id) })} />{c.name}</label>)}</div></fieldset>}
                    <label className="text-xs font-semibold text-slate-600 sm:col-span-6">Poznámka<textarea value={evForm.note} onChange={(e) => setEvForm({ ...evForm, note: e.target.value })} rows={2} maxLength={2000} className={`${inputCls} mt-0.5 font-normal`} /></label>
                    <div className="flex gap-2 sm:col-span-6"><button type="submit" disabled={busy} className={primaryBtn}>{busy && <Loader2 size={14} className="animate-spin" />} {evForm.id ? 'Uložit změny' : 'Přidat do kalendáře'}</button><button type="button" onClick={() => setEvForm(null)} className={ghostBtn}>Zrušit</button></div>
                </form>
            )}
            {ev && (
                <section className="rounded-2xl border border-indigo-200 bg-white p-4" aria-label="Detail události">
                    <div className="flex flex-wrap items-start gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">{EVENT_KIND[ev.kind]}</p>
                            <h3 className="text-lg font-bold text-slate-900">{ev.title}</h3>
                            <p className="text-sm text-slate-700">{(() => { const s = pragueParts(ev.starts_at), f = pragueParts(ev.ends_at); return ev.all_day ? `${longDate(s.date)}${f.date > s.date ? ` až ${longDate(f.date)}` : ''}, celý den` : `${longDate(s.date)}, ${s.time}–${f.date !== s.date ? `${longDate(f.date)} ` : ''}${f.time}`; })()}</p>
                            {ev.place && <p className="text-sm text-slate-700"><MapPin size={13} className="mr-1 inline" aria-hidden="true" />{ev.place}</p>}
                            {ev.case_id && <Link href={`/kancelar/veci/${ev.case_id}`} className="text-sm text-indigo-800 underline">{ev.case_title || 'Věc'}</Link>}
                            {(ev.attendees.length > 0 || ev.user_id !== userId) && <p className="text-sm text-slate-700"><Users size={13} className="mr-1 inline" aria-hidden="true" />{[names[ev.user_id] && ev.user_id !== userId ? `pořádá ${names[ev.user_id]}` : '', ev.attendees.length ? `pozvaní: ${ev.attendees.map((a) => names[a] ?? 'kolega').join(', ')}` : ''].filter(Boolean).join(' · ')}</p>}
                            {ev.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{ev.note}</p>}
                        </div>
                        {ev.user_id === userId && <><button type="button" onClick={() => editEvent(ev)} className={ghostBtn}>Upravit</button><button type="button" onClick={() => void removeEvent(ev)} className={`${ghostBtn} text-rose-700`}><Trash2 size={14} /> Smazat</button></>}
                        <button type="button" onClick={() => setOpenEv(null)} className={ghostBtn}>Zavřít</button>
                    </div>
                </section>
            )}

            {view === 'mesic' ? (
                <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-bold uppercase text-slate-500">{DOW.map((d) => <div key={d} className="py-1.5">{d}</div>)}</div>
                        {weeks.map((w) => (
                            <div key={w[0]} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0">
                                {w.map((d) => {
                                    const list = map[d] ?? []; const other = d.slice(0, 7) !== ym; const weekend = (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7 >= 5;
                                    return (
                                        <div key={d} role="button" tabIndex={0} onClick={() => setDay(d)} onKeyDown={(e) => { if (e.key === 'Enter') setDay(d); }} aria-label={`${longDate(d)}, ${list.length} položek`} className={`min-h-24 cursor-pointer border-r border-slate-100 p-1 last:border-r-0 ${other ? 'bg-slate-50/60 text-slate-400' : weekend ? 'bg-slate-50/30' : ''} ${day === d ? 'ring-2 ring-inset ring-indigo-400' : ''}`}>
                                            <p className={`mb-0.5 text-right text-xs font-semibold ${d === today ? 'text-white' : ''}`}><span className={d === today ? 'rounded-full bg-indigo-700 px-1.5 py-0.5' : ''}>{Number(d.slice(8))}</span></p>
                                            <div className="space-y-0.5">{list.slice(0, 3).map((i) => chip(i, true))}{list.length > 3 && <p className="px-1 text-xs font-semibold text-slate-500">+{list.length - 3} další</p>}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                    <aside className="rounded-2xl border border-slate-200 bg-white p-4" aria-label="Vybraný den">
                        <p className="flex items-center gap-1.5 text-sm font-bold capitalize text-slate-900"><CalendarDays size={15} className="text-indigo-700" aria-hidden="true" />{longDate(day)}</p>
                        <div className="mt-2 space-y-1.5">{(map[day] ?? []).length ? (map[day] ?? []).map((i) => chip(i)) : <p className="text-sm text-slate-500">Nic naplánováno.</p>}</div>
                        <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setEvForm(emptyEv(day))} className={ghostBtn}><Plus size={14} /> Událost</button><button type="button" onClick={() => setTaskForm(day)} className={ghostBtn}><ListTodo size={14} /> Úkol</button></div>
                    </aside>
                </div>
            ) : (
                <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-label="Seznam">
                    {(() => { const days = Object.keys(map).filter((d) => d >= (ym === today.slice(0, 7) ? today : `${ym}-01`)).sort().slice(0, 60); return days.length === 0 ? <p className="text-sm text-slate-500">Nic naplánováno.</p> : <ul className="space-y-3">{days.map((d) => <li key={d}><p className={`text-sm font-bold capitalize ${d === today ? 'text-indigo-800' : 'text-slate-900'}`}>{longDate(d)}</p><div className="mt-1 space-y-1">{sortItems(map[d]).map((i) => chip(i))}</div></li>)}</ul>; })()}
                </section>
            )}
            <p className="text-xs text-slate-500">Do kalendáře v telefonu nebo Googlu se lhůty, úkoly pro vás a události propisují přes odběr kalendáře a připojení Google Kalendáře v Nastavení.</p>
        </div>
    );
}
