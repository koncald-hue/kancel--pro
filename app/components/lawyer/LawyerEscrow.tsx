'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronDown, ChevronRight, Download, Lock, Plus, ShieldAlert, Vault } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadCases, type LegalCase } from '@/lib/cases';
import { money, todayIso } from '@/lib/billing';
import { KIND_LABEL, balanceOf, checkMove, daysOpen, isIn, isStale, movesCsv, parseAmount, reconcile, round2, type Escrow, type Move, type MoveKind } from '@/lib/escrow';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

type Client = { id: string; name: string };
const dateCz = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ');
const MISSING = /escrows|escrow_moves|schema cache|does not exist/i;

// Evidence úschov a klientských peněz: kniha pohybů po úschovách. Peníze Kancelář nedrží, jen je eviduje.
export default function LawyerEscrow() {
    const { userId } = useLawyer();
    const [escrows, setEscrows] = useState<Escrow[] | null>(null);
    const [moves, setMoves] = useState<Record<string, Move[]>>({});
    const [clients, setClients] = useState<Client[]>([]); const [cases, setCases] = useState<LegalCase[]>([]);
    const [open, setOpen] = useState<string | null>(null);
    const [error, setError] = useState(''); const [missing, setMissing] = useState(false);
    const [form, setForm] = useState({ title: '', client_id: '', case_id: '', currency: 'CZK', bank_account: '', purpose: '' });
    const today = todayIso();

    const load = useCallback(async () => {
        const [e, m, c, cs] = await Promise.all([
            supabase.from('escrows').select('*').order('created_at', { ascending: false }),
            supabase.from('escrow_moves').select('id, escrow_id, kind, amount, moved_on, party, reference, note').order('moved_on').order('created_at'),
            supabase.from('lawyer_clients').select('id, name').order('name'), loadCases().catch(() => [] as LegalCase[]),
        ]);
        if (e.error || m.error) { if (MISSING.test((e.error ?? m.error)!.message)) setMissing(true); else setError((e.error ?? m.error)!.message); setEscrows([]); return; }
        const by: Record<string, Move[]> = {};
        for (const r of (m.data ?? []) as (Move & { escrow_id: string; amount: number | string })[]) (by[r.escrow_id] ??= []).push({ ...r, amount: Number(r.amount) });
        setMoves(by); setEscrows((e.data ?? []) as Escrow[]); setClients((c.data ?? []) as Client[]); setCases(cs);
    }, []);
    useEffect(() => { let a = true; Promise.resolve().then(() => { if (a) void load(); }); return () => { a = false; }; }, [load]);

    async function create() {
        setError('');
        if (!form.title.trim()) return;
        const { error: err } = await supabase.from('escrows').insert({ user_id: userId, title: form.title.trim(), client_id: form.client_id || null, case_id: form.case_id || null, currency: form.currency, bank_account: form.bank_account.trim(), purpose: form.purpose.trim() });
        if (err) { setError(err.message); return; }
        setForm({ title: '', client_id: '', case_id: '', currency: 'CZK', bank_account: '', purpose: '' }); await load();
    }

    const total = useMemo(() => { const t: Record<string, number> = {}; for (const e of escrows ?? []) if (e.status === 'open') t[e.currency] = round2((t[e.currency] ?? 0) + balanceOf(moves[e.id] ?? [])); return t; }, [escrows, moves]);

    if (escrows === null) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (missing) return <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Evidence úschov se zapne po spuštění migrace 20261118_14_evidence-uschov.sql v Supabase.</p>;
    const card = 'rounded-2xl border border-slate-200 bg-white p-5';
    return (
        <div className="space-y-5">
            <section className={card}>
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Vault size={18} className="text-indigo-700" aria-hidden="true" /> Úschovy a klientské peníze</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Kniha pohybů po každé úschově: příjem, výdej, zůstatek a kontrola proti bankovnímu výpisu. Pohyby se jen přidávají, chybu opravíte opravným pohybem, ne přepsáním. Výdej nepřesáhne zůstatek a úschovu nejde uzavřít s nenulovým zůstatkem.</p>
                <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-950"><ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> Kancelář je evidence, ne účet: peníze nedrží, nepřijímá ani neposílá. Úschovy vedete na účtu, který máte k tomu určený. Před ostrým použitím nechte postup posoudit podle předpisů České advokátní komory. Evidenci vidíte jen vy, ne kolega ani vedoucí kanceláře.</p>
                {Object.keys(total).length > 0 && <p className="mt-3 text-sm font-semibold text-slate-800">V otevřených úschovách celkem: {Object.entries(total).map(([cur, v]) => money(v, cur === 'EUR' ? 'EUR' : 'CZK')).join(' · ')}</p>}
            </section>

            <section className={card} aria-label="Nová úschova">
                <h3 className="font-bold text-slate-900">Nová úschova</h3>
                <form onSubmit={(e) => { e.preventDefault(); void create(); }} className="mt-3 grid gap-2 sm:grid-cols-6">
                    <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Název (např. Kupní cena, Novák – byt)" aria-label="Název úschovy" required maxLength={160} className={`${inputCls} sm:col-span-3`} />
                    <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} aria-label="Klient" className={`${inputCls} sm:col-span-2`}><option value="">Klient (nepovinné)</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} aria-label="Měna" className={inputCls}><option>CZK</option><option>EUR</option></select>
                    <select value={form.case_id} onChange={(e) => setForm({ ...form, case_id: e.target.value })} aria-label="Věc" className={`${inputCls} sm:col-span-3`}><option value="">Věc (nepovinné)</option>{cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
                    <input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} placeholder="Účet úschovy" aria-label="Účet úschovy" maxLength={60} className={`${inputCls} sm:col-span-3`} />
                    <input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Účel a podmínky vydání (např. po zápisu vkladu do katastru)" aria-label="Účel" maxLength={1000} className={`${inputCls} sm:col-span-5`} />
                    <button type="submit" className={`${primaryBtn} justify-center`}><Plus size={14} /> Založit</button>
                </form>
                {error && <p role="alert" className="mt-2 text-sm font-semibold text-rose-800">{error}</p>}
            </section>

            {escrows.length === 0 ? <p className="text-sm text-slate-500">Zatím žádná úschova.</p> : (
                <ul className="space-y-3">
                    {escrows.map((e) => <EscrowRow key={e.id} e={e} moves={moves[e.id] ?? []} clientName={clients.find((c) => c.id === e.client_id)?.name} caseTitle={cases.find((c) => c.id === e.case_id)?.title} caseId={e.case_id} userId={userId} today={today} expanded={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} onChanged={load} />)}
                </ul>
            )}
        </div>
    );
}

function EscrowRow({ e, moves, clientName, caseTitle, caseId, userId, today, expanded, onToggle, onChanged }: { e: Escrow; moves: Move[]; clientName?: string; caseTitle?: string; caseId: string | null; userId: string; today: string; expanded: boolean; onToggle: () => void; onChanged: () => Promise<void> }) {
    const balance = balanceOf(moves);
    const stale = isStale(e, balance, today);
    const [kind, setKind] = useState<MoveKind>('deposit'); const [amount, setAmount] = useState(''); const [date, setDate] = useState(today);
    const [party, setParty] = useState(''); const [ref, setRef] = useState(''); const [note, setNote] = useState('');
    const [bank, setBank] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
    const bankNum = bank.trim() ? parseAmount(bank) : NaN;
    const rec = Number.isFinite(bankNum) ? reconcile(balance, bankNum) : null;
    const rows = moves.map((m, i) => ({ m, run: balanceOf(moves.slice(0, i + 1)) }));

    async function add() {
        const a = parseAmount(amount); const problem = checkMove(balance, kind, a, date, today);
        if (problem) { setErr(problem); return; }
        setBusy(true); setErr('');
        const { error } = await supabase.from('escrow_moves').insert({ escrow_id: e.id, user_id: userId, kind, amount: a, moved_on: date, party: party.trim(), reference: ref.trim(), note: note.trim() });
        setBusy(false);
        if (error) { setErr(error.message); return; }
        setAmount(''); setParty(''); setRef(''); setNote(''); await onChanged();
    }
    async function close() {
        setBusy(true); setErr('');
        const { error } = await supabase.from('escrows').update({ status: 'closed', closed_on: today }).eq('id', e.id);
        setBusy(false); if (error) setErr(error.message); else await onChanged();
    }
    function csv() {
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([movesCsv(e, moves)], { type: 'text/csv;charset=utf-8' })); a.download = `uschova-${e.title.replace(/\W+/g, '_')}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }

    return (
        <li className={`rounded-2xl border bg-white ${stale ? 'border-amber-300' : 'border-slate-200'}`}>
            <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full flex-wrap items-center gap-3 p-4 text-left cursor-pointer">
                {expanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">{e.title}{e.status === 'closed' && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-600"><Lock size={10} aria-hidden="true" /> uzavřeno</span>}</span>
                    <span className="block text-xs text-slate-500">{[clientName, caseTitle, `od ${dateCz(e.opened_on)}`].filter(Boolean).join(' · ')}</span></span>
                {stale && <span className="flex items-center gap-1 text-xs font-semibold text-amber-900"><AlertTriangle size={13} aria-hidden="true" /> leží {daysOpen(e, today)} dní</span>}
                <span className="text-base font-bold text-slate-900">{money(balance, e.currency)}</span>
            </button>
            {expanded && (
                <div className="space-y-4 border-t border-slate-100 p-4">
                    {e.purpose && <p className="text-sm text-slate-700"><strong>Účel:</strong> {e.purpose}</p>}
                    {caseId && <Link href={`/kancelar/veci/${caseId}`} className="text-xs font-semibold text-indigo-800 hover:underline">Otevřít věc</Link>}
                    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-1 pr-3">Datum</th><th className="pr-3">Pohyb</th><th className="pr-3">Strana / odkaz</th><th className="pr-3 text-right">Částka</th><th className="text-right">Zůstatek</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={5} className="py-3 text-slate-500">Zatím žádný pohyb.</td></tr> : rows.map(({ m, run: r }) => <tr key={m.id}><td className="py-1.5 pr-3">{dateCz(m.moved_on)}</td><td className="pr-3">{KIND_LABEL[m.kind]}</td><td className="pr-3 text-slate-600">{[m.party, m.reference, m.note].filter(Boolean).join(' · ')}</td><td className={`pr-3 text-right font-semibold ${isIn(m.kind) ? 'text-emerald-800' : 'text-rose-800'}`}>{isIn(m.kind) ? '+' : '−'}{money(m.amount, e.currency)}</td><td className="text-right">{money(r, e.currency)}</td></tr>)}</tbody>
                    </table></div>
                    {e.status === 'open' && (
                        <form onSubmit={(ev) => { ev.preventDefault(); void add(); }} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-6" aria-label="Nový pohyb">
                            <select value={kind} onChange={(ev) => setKind(ev.target.value as MoveKind)} aria-label="Druh pohybu" className={`${inputCls} sm:col-span-2`}>{(Object.keys(KIND_LABEL) as MoveKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
                            <input value={amount} onChange={(ev) => setAmount(ev.target.value)} inputMode="decimal" placeholder={`Částka (${e.currency})`} aria-label="Částka" className={inputCls} />
                            <input type="date" value={date} max={today} onChange={(ev) => setDate(ev.target.value)} aria-label="Datum pohybu" className={`${inputCls} sm:col-span-2`} />
                            <button type="submit" disabled={busy || !amount.trim()} className={`${primaryBtn} justify-center`}>Zapsat</button>
                            <input value={party} onChange={(ev) => setParty(ev.target.value)} placeholder="Od koho / komu" aria-label="Strana" maxLength={200} className={`${inputCls} sm:col-span-2`} />
                            <input value={ref} onChange={(ev) => setRef(ev.target.value)} placeholder="VS, č. dokladu" aria-label="Odkaz" maxLength={120} className={`${inputCls} sm:col-span-2`} />
                            <input value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Poznámka" aria-label="Poznámka" maxLength={1000} className={`${inputCls} sm:col-span-2`} />
                        </form>
                    )}
                    {err && <p role="alert" className="text-sm font-semibold text-rose-800">{err}</p>}
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        <label className="flex items-center gap-1.5 text-xs text-slate-600">Zůstatek podle výpisu <input value={bank} onChange={(ev) => setBank(ev.target.value)} inputMode="decimal" aria-label="Zůstatek podle výpisu" className={`${inputCls} w-32 py-1`} /></label>
                        {rec && <span role="status" className={`text-xs font-semibold ${rec.ok ? 'text-emerald-800' : 'text-rose-800'}`}>{rec.ok ? 'Evidence a banka se shodují.' : `Rozdíl proti bance: ${money(rec.diff, e.currency)}. Zkontrolujte nezapsané pohyby.`}</span>}
                        <button type="button" onClick={csv} className={`${ghostBtn} ml-auto`}><Download size={14} /> Výpis (CSV)</button>
                        {e.status === 'open' && <button type="button" onClick={() => void close()} disabled={busy || balance !== 0 || moves.length === 0} title={balance !== 0 ? 'Uzavřít jde jen s nulovým zůstatkem' : ''} className={ghostBtn}><Lock size={14} /> Uzavřít</button>}
                    </div>
                </div>
            )}
        </li>
    );
}
