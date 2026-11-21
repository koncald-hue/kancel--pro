'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, BadgeCheck, Calculator, CalendarClock, Check, CheckCircle2, CircleDashed, Clock3, FileSignature, Hourglass, Inbox, MessageSquare, Paperclip, Pencil, Plus, Receipt, RefreshCw, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadAllDeadlines, type CaseDeadline } from '@/lib/caseFile';
import { loadCases, type LegalCase } from '@/lib/cases';
import { czk, formatMinutes, type TimeEntry } from '@/lib/lawyer';
import { scheduleGoogleSync } from '@/lib/googleSync';
import { buildAgenda, buildInbox, buildUnbilled, buildWaiting, describeSources, type AgendaItem, type InboxItem, type InquiryRow, type MessageRow, type RequestRow, type SignatureRow, type Source, type UploadRow } from '@/lib/today';
import { deadlineText, deadlineTone } from '../situation/CaseDeadlinesTab';
import DeadlineDialog, { MIGRATION_HINT, type DeadlineTarget } from '../situation/DeadlineDialog';
import { useLawyer } from './LawyerGate';
import ReviewPrompt from './ReviewPrompt';
import NoticesCard from './NoticesCard';

type Data = {
    cases: LegalCase[]; customs: CaseDeadline[]; entries: TimeEntry[];
    inquiries: InquiryRow[]; messages: MessageRow[]; requests: RequestRow[]; uploads: UploadRow[]; signatures: SignatureRow[];
    sources: Source[]; migrated: boolean;
};

// Každý zdroj se načte samostatně: chybějící tabulka (nespuštěné SQL) neshodí celý přehled
async function rows<T>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[] | null> {
    try { const { data, error } = await q; return error ? null : ((data ?? []) as T[]); } catch { return null; }
}
async function count(table: string): Promise<number | null> {
    try { const { count: n, error } = await supabase.from(table).select('id', { count: 'exact', head: true }); return error ? null : n ?? 0; } catch { return null; }
}

async function loadToday(): Promise<Data> {
    const [cases, customs] = await Promise.all([loadCases(), loadAllDeadlines().catch(() => [] as CaseDeadline[])]);
    const [entries, inquiries, messages, requests, uploads, signatures, isds, mail] = await Promise.all([
        rows<TimeEntry>(supabase.from('time_entries').select('*').eq('billed', false)),
        rows<InquiryRow>(supabase.from('lawyer_inquiries').select('*').in('status', ['new', 'accepted']).order('created_at', { ascending: false }).limit(200)),
        // Jen metadata zpráv (kdo, kdy, přečteno); obsah se pro přehled nenačítá
        rows<MessageRow>(supabase.from('client_messages').select('case_id, from_client, read, created_at').order('created_at', { ascending: false }).limit(1000)),
        rows<RequestRow>(supabase.from('client_requests').select('id, case_id, title, done, created_at').eq('done', false)),
        rows<UploadRow>(supabase.from('case_files').select('case_id, request_id, created_at, source').eq('source', 'client').not('request_id', 'is', null)),
        rows<SignatureRow>(supabase.from('signature_requests').select('id, case_id, title, status, created_at, signed_at').in('status', ['pending', 'awaiting_check'])),
        count('isds_accounts'), count('mail_accounts'),
    ]);
    // Sloupce z migrace 20261117_01 (druh, potvrzení, odpovědná osoba): zjistíme, jestli existují
    const probe = await supabase.from('case_deadlines').select('kind').limit(1);
    return {
        cases, customs, entries: entries ?? [], inquiries: inquiries ?? [], messages: messages ?? [], requests: requests ?? [], uploads: uploads ?? [], signatures: signatures ?? [],
        sources: describeSources({ inquiries: inquiries !== null, portal: messages !== null && requests !== null, isds, mail }),
        migrated: !probe.error,
    };
}

const URGENCY_LABEL = { overdue: 'Po termínu', today: 'Dnes', soon: 'Do 3 dnů', later: 'Do 14 dnů' } as const;
const SOURCE_TONE = { ok: 'border-emerald-200 bg-emerald-50 text-emerald-900', off: 'border-slate-200 bg-white text-slate-600', missing: 'border-amber-200 bg-amber-50 text-amber-900' } as const;
const SOURCE_ICON = { ok: CheckCircle2, off: CircleDashed, missing: AlertTriangle } as const;
const INBOX_ICON = { poptavka: Inbox, zprava: MessageSquare, podklady: Paperclip, podpis: FileSignature } as const;
const WAIT_LABEL = { podklady: 'Podklady', podpis: 'Podpis', odpoved: 'Odpověď' } as const;
const ago = (iso: string) => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000); return d <= 0 ? 'dnes' : d === 1 ? 'včera' : `před ${d} ${d < 5 ? 'dny' : 'dní'}`; };
const waitDays = (n: number) => (n === 0 ? 'od dneška' : n === 1 ? '1 den' : n < 5 ? `${n} dny` : `${n} dní`);

function Block({ id, icon: Icon, title, count: n, action, children }: { id: string; icon: typeof Inbox; title: string; count?: number; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section aria-labelledby={id} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
                <h2 id={id} className="flex items-center gap-2 text-base font-bold text-slate-900"><Icon size={17} className="text-indigo-700" aria-hidden="true" /> {title}{n ? <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-900">{n}</span> : null}</h2>
                {action}
            </div>
            <div className="flex-1 px-2 py-2 sm:px-3">{children}</div>
        </section>
    );
}

function Empty({ children }: { children: React.ReactNode }) {
    return <div className="px-3 py-6 text-center text-sm text-slate-500">{children}</div>;
}

export default function TodayBoard() {
    const { userId } = useLawyer();
    const [data, setData] = useState<Data | null>(null);
    const [error, setError] = useState('');
    const [onlyMine, setOnlyMine] = useState(true);
    const [dialog, setDialog] = useState<DeadlineTarget | null>(null);
    const [doneNote, setDoneNote] = useState<AgendaItem | null>(null);
    const [names, setNames] = useState<Record<string, string>>({});
    const [actionError, setActionError] = useState('');

    const reload = useCallback(() => {
        setError('');
        loadToday().then(setData).catch(() => setError('Přehled se nepodařilo načíst. Zkontrolujte připojení a zkuste to znovu.'));
    }, []);
    useEffect(() => { const t = window.setTimeout(reload, 0); return () => window.clearTimeout(t); }, [reload]);

    const agenda = useMemo(() => (data ? buildAgenda(data.cases, data.customs, { me: userId, onlyMine }) : []), [data, userId, onlyMine]);
    const allCount = useMemo(() => (data ? buildAgenda(data.cases, data.customs).length : 0), [data]);
    const inbox = useMemo<InboxItem[]>(() => (data ? buildInbox(data) : []), [data]);
    const waiting = useMemo(() => (data ? buildWaiting(data) : []), [data]);
    const unbilled = useMemo(() => (data ? buildUnbilled(data.entries, data.cases) : []), [data]);

    // Jména odpovědných kolegů (jen u sdílených věcí, kde je úkol přiřazený někomu jinému)
    useEffect(() => {
        const ids = [...new Set(agenda.filter((a) => a.assigneeId && a.assigneeId !== userId && !names[a.assigneeId]).map((a) => a.caseId))].slice(0, 10);
        if (!ids.length) return;
        let alive = true;
        Promise.all(ids.map((id) => supabase.rpc('case_people', { p_case: id }))).then((res) => {
            if (!alive) return;
            const next: Record<string, string> = {};
            for (const r of res) for (const p of ((r.data ?? []) as { user_id: string; name: string }[])) next[p.user_id] = p.name;
            setNames((n) => ({ ...n, ...next }));
        });
        return () => { alive = false; };
    }, [agenda, userId, names]);

    async function markDone(a: AgendaItem) {
        if (!a.customId) return;
        setActionError('');
        const { error: e } = await supabase.from('case_deadlines').update({ done: true }).eq('id', a.customId);
        if (e) { setActionError(`Nepodařilo se označit jako hotové: ${e.message}`); return; }
        setData((d) => (d ? { ...d, customs: d.customs.map((c) => (c.id === a.customId ? { ...c, done: true } : c)) } : d));
        setDoneNote(a);
        scheduleGoogleSync();
    }

    function onSaved(row: CaseDeadline) {
        setData((d) => (d ? { ...d, customs: [...d.customs.filter((c) => c.id !== row.id), row] } : d));
        setDialog(null);
        scheduleGoogleSync();
    }

    if (error) return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}<button type="button" onClick={reload} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 font-semibold cursor-pointer"><RefreshCw size={14} /> Zkusit znovu</button></div>;
    if (!data) {
        return (
            <div className="grid gap-4 lg:grid-cols-2" role="status" aria-label="Načítám přehled">
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />)}
            </div>
        );
    }

    const assigneeLabel = (a: AgendaItem) => {
        const who = a.assigneeId ?? a.ownerId ?? userId;
        return who === userId ? 'Vy' : names[who] ?? 'Kolega';
    };
    const caseLink = (id: string, tab?: string) => `/kancelar/veci/${id}?${tab ? `tab=${tab}&` : ''}from=dnes`;

    return (
        <div className="space-y-4">
            <NoticesCard />
            <ReviewPrompt />
            {/* Zdroje: co skutečně funguje a co čeká na nastavení */}
            <ul className="flex flex-wrap gap-2" aria-label="Zdroje nových spisů">
                {data.sources.map((s) => {
                    const Icon = SOURCE_ICON[s.state];
                    return <li key={s.id}><Link href={s.href} title={s.note} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold hover:brightness-95 ${SOURCE_TONE[s.state]}`}><Icon size={13} aria-hidden="true" /> {s.label}<span className="font-normal opacity-80">· {s.state === 'ok' ? 'funguje' : s.state === 'off' ? 'nenastaveno' : 'chybí SQL'}</span></Link></li>;
                })}
            </ul>
            {!data.migrated && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Úkoly s odpovědnou osobou a potvrzení lhůt zatím nejsou zapnuté. {MIGRATION_HINT}</p>}
            {actionError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{actionError}</p>}

            <div className="grid items-start gap-4 lg:grid-cols-2">
                {/* 1. Nové spisy k vyřízení */}
                <Block id="dnes-nove" icon={Inbox} title="Nové k vyřízení" count={inbox.length}>
                    {inbox.length === 0 ? (
                        <Empty>Nic nového. Nové poptávky, zprávy a podklady od klientů se objeví tady.<span className="mt-2 block"><Link href="/kancelar/nastaveni" className="font-semibold text-indigo-800 hover:underline">Odkaz pro zájemce najdete v Nastavení →</Link></span></Empty>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {inbox.slice(0, 8).map((i) => {
                                const Icon = INBOX_ICON[i.kind];
                                return (
                                    <li key={i.key}>
                                        <Link href={i.href} className="group flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50">
                                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700"><Icon size={15} aria-hidden="true" /></span>
                                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{i.title}</span><span className="block truncate text-xs text-slate-500">{i.detail} · {ago(i.at)}</span></span>
                                            <span className="shrink-0 self-center text-xs font-semibold text-indigo-800 group-hover:underline">{i.action} →</span>
                                        </Link>
                                    </li>
                                );
                            })}
                            {inbox.length > 8 && <li className="px-2 py-2 text-xs text-slate-500">a dalších {inbox.length - 8}</li>}
                        </ul>
                    )}
                </Block>

                {/* 2. Úkoly a lhůty */}
                <Block id="dnes-ukoly" icon={CalendarClock} title="Úkoly a lhůty" count={agenda.length}
                    action={<div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs" role="group" aria-label="Zobrazit">{([[true, 'Moje'], [false, 'Všechny']] as const).map(([v, l]) => <button key={l} type="button" aria-pressed={onlyMine === v} onClick={() => setOnlyMine(v)} className={`rounded-md px-2.5 py-1 font-semibold cursor-pointer ${onlyMine === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{l}</button>)}</div>}>
                    {doneNote && (
                        <p className="m-1 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 p-2.5 text-sm text-emerald-900" role="status">
                            <Check size={15} aria-hidden="true" /> Hotovo: {doneNote.title}.
                            <Link href={`/kancelar/vykazy?case=${doneNote.caseId}&popis=${encodeURIComponent(doneNote.title.slice(0, 120))}`} className="font-semibold underline">Zapsat čas ke spisu</Link>
                            <button type="button" onClick={() => setDoneNote(null)} className="ml-auto text-xs text-emerald-800 hover:underline cursor-pointer">Zavřít</button>
                        </p>
                    )}
                    {agenda.length === 0 ? (
                        <Empty>{onlyMine && allCount > 0 ? <>Na vás teď nic nečeká. <button type="button" onClick={() => setOnlyMine(false)} className="font-semibold text-indigo-800 hover:underline cursor-pointer">Zobrazit všechny ({allCount})</button></> : 'Na 14 dní dopředu nic. Úkoly a lhůty přidáte ve spisu, v záložce Lhůty.'}</Empty>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {agenda.slice(0, 12).map((a, idx) => (
                                <li key={a.key} className="px-1 py-2.5">
                                    {(idx === 0 || agenda[idx - 1].urgency !== a.urgency) && <p className={`mb-1.5 px-1 text-xs font-bold uppercase tracking-wider ${a.urgency === 'overdue' ? 'text-rose-700' : a.urgency === 'today' ? 'text-amber-700' : 'text-slate-400'}`}>{URGENCY_LABEL[a.urgency]}</p>}
                                    <div className="flex items-start gap-2.5">
                                        {a.customId ? (
                                            <button type="button" onClick={() => void markDone(a)} aria-label={`Označit jako hotové: ${a.title}`} className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white hover:border-emerald-600 hover:bg-emerald-50 cursor-pointer"><Check size={12} className="text-transparent hover:text-emerald-700" /></button>
                                        ) : <Calculator size={18} className="mt-0.5 shrink-0 text-amber-600" aria-label="Vypočteno orientačně" />}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                                                <Link href={caseLink(a.caseId, 'lhuty')} className="font-semibold text-indigo-800 hover:underline">{a.caseTitle}</Link>
                                                {a.clientName && <span>{a.clientName}</span>}
                                                <span className="inline-flex items-center gap-1"><UserRound size={11} aria-hidden="true" />{assigneeLabel(a)}</span>
                                                {a.kind === 'ukol' ? <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">Úkol</span>
                                                    : a.source === 'law' ? <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">Lhůta · vypočteno orientačně</span>
                                                        : a.confirmed ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800"><BadgeCheck size={11} aria-hidden="true" />Lhůta · datum potvrzeno</span>
                                                            : <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">Lhůta · nepotvrzeno</span>}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-1">
                                            <span className={`text-xs font-bold ${deadlineTone(a.left, false)}`}>{new Date(`${a.iso}T12:00:00`).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })} · {deadlineText(a.left)}</span>
                                            {data.migrated && (a.source === 'law' || (a.kind === 'lhuta' && !a.confirmed)
                                                ? <button type="button" onClick={() => setDialog({ caseId: a.caseId, caseTitle: a.caseTitle, source: a.source, customId: a.customId, lawKey: a.lawKey, title: a.title, iso: a.iso, kind: a.kind, confirmed: a.confirmed, assigneeId: a.assigneeId })} className="rounded-md bg-amber-500 px-2 py-0.5 text-xs font-bold text-white hover:bg-amber-600 cursor-pointer">Ověřit datum</button>
                                                : a.customId && <button type="button" onClick={() => setDialog({ caseId: a.caseId, caseTitle: a.caseTitle, source: 'custom', customId: a.customId, title: a.title, iso: a.iso, kind: a.kind, confirmed: a.confirmed, assigneeId: a.assigneeId })} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer" aria-label={`Upravit: ${a.title}`}><Pencil size={11} aria-hidden="true" /> Upravit</button>)}
                                        </div>
                                    </div>
                                </li>
                            ))}
                            {agenda.length > 12 && <li className="px-2 py-2 text-xs text-slate-500">a dalších {agenda.length - 12} ve spisech</li>}
                        </ul>
                    )}
                    <p className="px-2 pb-1 pt-2 text-xs leading-relaxed text-slate-400">Upozornění na termíny je pomůcka. „Vypočteno orientačně“ znamená, že datum spočítala aplikace a nikdo ho neověřil.</p>
                </Block>

                {/* 3. Čekání na klienta */}
                <Block id="dnes-ceka" icon={Hourglass} title="Čeká se na klienta" count={waiting.length}>
                    {waiting.length === 0 ? (
                        <Empty>Na nikoho nečekáte. Když klienta požádáte o podklady nebo podpis ve spisu (záložka Klient), uvidíte tady, jak dlouho se čeká.</Empty>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {waiting.slice(0, 8).map((w) => (
                                <li key={w.caseId}>
                                    <Link href={caseLink(w.caseId, 'klient')} className="group flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50">
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-slate-900">{w.caseTitle}{w.clientName && <span className="font-normal text-slate-500"> · {w.clientName}</span>}</span>
                                            <span className="mt-1 flex flex-wrap gap-1">{w.reasons.slice(0, 3).map((r, i) => <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"><strong>{WAIT_LABEL[r.kind]}:</strong> {r.title}</span>)}{w.reasons.length > 3 && <span className="text-xs text-slate-500">+{w.reasons.length - 3}</span>}</span>
                                        </span>
                                        <span className={`shrink-0 text-xs font-bold ${w.days >= 7 ? 'text-rose-700' : w.days >= 3 ? 'text-amber-700' : 'text-slate-500'}`}>{waitDays(w.days)}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Block>

                {/* 4. Nevyúčtovaný čas */}
                <Block id="dnes-cas" icon={Clock3} title="Nevyúčtovaný čas" action={<Link href="/kancelar/vykazy" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-800 hover:underline"><Plus size={13} aria-hidden="true" /> Zapsat čas</Link>}>
                    {unbilled.length === 0 ? (
                        <Empty>Všechna zapsaná práce je vyúčtovaná. Čas zapíšete ve Výkazech nebo po splnění úkolu.</Empty>
                    ) : (
                        <>
                            <p className="px-2 pb-1 pt-1 text-sm text-slate-700">Celkem <strong>{formatMinutes(unbilled.reduce((s, u) => s + u.minutes, 0))}</strong> hodin za <strong>{czk(unbilled.reduce((s, u) => s + u.amount, 0))}</strong></p>
                            <ul className="divide-y divide-slate-100">
                                {unbilled.slice(0, 6).map((u) => (
                                    <li key={u.caseId ?? 'none'} className="flex items-center gap-3 px-2 py-2.5">
                                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{u.caseTitle}</span><span className="block text-xs text-slate-500">{u.count} {u.count === 1 ? 'záznam' : u.count < 5 ? 'záznamy' : 'záznamů'} · {formatMinutes(u.minutes)} h · {czk(u.amount)}</span></span>
                                        {u.caseId ? <Link href={`/kancelar/faktury?nove=1&case=${u.caseId}`} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"><Receipt size={13} aria-hidden="true" /> Vyúčtovat</Link>
                                            : <Link href="/kancelar/vykazy" className="shrink-0 text-xs font-semibold text-indigo-800 hover:underline">Přiřadit ke spisu →</Link>}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </Block>
            </div>

            <p className="flex justify-end"><button type="button" onClick={reload} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"><RefreshCw size={12} aria-hidden="true" /> Obnovit přehled</button> <Link href="/kancelar/veci" className="ml-4 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">Všechny spisy <ArrowRight size={12} aria-hidden="true" /></Link></p>

            {dialog && <DeadlineDialog target={dialog} userId={userId} onSaved={onSaved} onClose={() => setDialog(null)} />}
        </div>
    );
}
