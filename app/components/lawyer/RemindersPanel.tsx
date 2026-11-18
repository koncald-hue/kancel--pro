'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BellRing, Check, Copy, Download, FileText, Loader2, Mail, Printer, Send, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { money, todayIso, type Receivable } from '@/lib/billing';
import { buildDocx } from '@/lib/templates';
import { LEVELS, mailtoLink, nextReminder, reminderText, type Draft, type Level, type Sent } from '@/lib/reminders';
import { qrSvg, spayd } from '@/lib/qrPayment';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';
import { MAILER_HINT, useMailer } from '@/lib/useMailer';

const draftFor = (inv: Receivable, level: Level, history: Sent[], signature: string, account: string): Draft => {
    const last = [...history].sort((a, b) => b.sent_on.localeCompare(a.sent_on))[0];
    return reminderText({ level, number: inv.number ?? '', issue: inv.issue_date, due: inv.due_date ?? inv.issue_date, outstanding: inv.outstanding, currency: inv.currency === 'EUR' ? 'EUR' : 'CZK', account, vs: (inv.number ?? '').replace(/\D/g, ''), signature, today: todayIso(), lastSentOn: last?.sent_on });
};

const dateCz = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('cs-CZ');

// Upomínky: které faktury po splatnosti je čas upomenout, hotový text (e-mail, tisk, Word) a evidence odeslaných upomínek
export default function RemindersPanel({ invoices, userId, onChanged }: { invoices: Receivable[]; userId: string; onChanged: () => void | Promise<void> }) {
    const { access } = useLawyer();
    const [sent, setSent] = useState<Record<string, Sent[]>>({});
    const [open, setOpen] = useState<{ inv: Receivable; level: Level } | null>(null);
    const today = todayIso();
    const mailer = useMailer();
    const [batch, setBatch] = useState<{ confirm: boolean; running: boolean; done: { label: string; ok: boolean; err?: string }[] }>({ confirm: false, running: false, done: [] });

    const load = useCallback(async () => {
        const { data } = await supabase.from('invoice_reminders').select('invoice_id, level, sent_on');
        const map: Record<string, Sent[]> = {};
        for (const r of (data ?? []) as { invoice_id: string; level: Level; sent_on: string }[]) (map[r.invoice_id] ??= []).push({ level: r.level, sent_on: r.sent_on });
        setSent(map);
    }, []);
    useEffect(() => { let alive = true; Promise.resolve().then(() => { if (alive) void load(); }); return () => { alive = false; }; }, [load]);

    const overdue = invoices.filter((i) => i.state === 'overdue').map((inv) => ({ inv, next: nextReminder(inv.due_date, sent[inv.id] ?? [], today), history: sent[inv.id] ?? [] }));
    if (overdue.length === 0) return null;
    const ready = overdue.filter((x) => x.next?.ready);
    const signature = access.display_name || access.firm_name || access.email;
    const account = access.bank_account ?? '';
    const batchList = ready.filter((x) => (x.inv.client_snapshot.email ?? '').includes('@'));

    async function sendBatch() {
        let done: { label: string; ok: boolean; err?: string }[] = [];
        setBatch((b) => ({ ...b, running: true, done: [] }));
        for (const x of batchList) {
            const label = `${x.inv.number} · ${x.inv.client_snapshot.name}`;
            try {
                const d = draftFor(x.inv, x.next!.level, x.history, signature, account);
                await mailer.send({ to: x.inv.client_snapshot.email as string, subject: d.subject, text: d.body });
                await supabase.from('invoice_reminders').insert({ user_id: userId, invoice_id: x.inv.id, level: x.next!.level, sent_on: todayIso(), channel: 'e-mail' });
                done = [...done, { label, ok: true }];
            } catch (e) { done = [...done, { label, ok: false, err: e instanceof Error ? e.message : 'Neodesláno' }]; }
            const snap = done; setBatch((b) => ({ ...b, done: snap }));
            await new Promise((r) => window.setTimeout(r, 1200));
        }
        setBatch({ confirm: false, running: false, done }); await load(); await onChanged();
    }

    return (
        <section aria-label="Upomínky">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><BellRing size={18} className="text-rose-600" /> Po splatnosti ({overdue.length}){ready.length > 0 && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">{ready.length} k upomenutí</span>}</h2>
            {batchList.length > 0 && (
                <div className="mt-3 rounded-2xl border-2 border-rose-200 bg-rose-50/50 p-4">
                    <p className="text-sm font-bold text-slate-900">Připraveno {batchList.length} {batchList.length === 1 ? 'upomínka' : 'upomínek'} k odeslání</p>
                    <p className="mt-0.5 text-xs text-slate-600">Každou odešlete klientovi z vaší schránky se standardním textem příslušného stupně (včetně účtu a případného úroku). Nic se neodešle bez vašeho potvrzení. Text konkrétní upomínky můžete předtím upravit tlačítkem u faktury.</p>
                    {mailer.status !== 'ready' && mailer.status !== 'loading' && <p role="alert" className="mt-2 text-xs text-amber-950">{MAILER_HINT[mailer.status]}</p>}
                    {mailer.status === 'ready' && (
                        <>
                            <ul className="mt-2 space-y-0.5 text-xs text-slate-700">{batchList.map((x) => <li key={x.inv.id}>{x.inv.number} · {x.inv.client_snapshot.name} → {x.inv.client_snapshot.email} · {LEVELS[x.next!.level].name.toLowerCase()}, {money(x.inv.outstanding, x.inv.currency)}</li>)}</ul>
                            <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-slate-900"><input type="checkbox" className="mt-0.5" checked={batch.confirm} onChange={(e) => setBatch((b) => ({ ...b, confirm: e.target.checked }))} /> Souhlasím s odesláním {batchList.length} upomínek z adresy {mailer.email}.</label>
                            <button type="button" disabled={!batch.confirm || batch.running} onClick={() => void sendBatch()} className={`${primaryBtn} mt-2`}>{batch.running ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Schválit a odeslat vše</button>
                        </>
                    )}
                    {batch.done.length > 0 && <ul role="status" className="mt-2 space-y-0.5 text-xs">{batch.done.map((d, i) => <li key={i} className={d.ok ? 'text-emerald-800' : 'font-semibold text-rose-800'}>{d.ok ? '✓' : '✗'} {d.label}{d.err ? `: ${d.err}` : ''}</li>)}</ul>}
                </div>
            )}
            <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                {overdue.map(({ inv, next, history }) => (
                    <li key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                        <span className="min-w-0 flex-1"><Link href={`/kancelar/faktury/${inv.id}`} className="font-semibold text-indigo-800 hover:underline">{inv.number}</Link> <span className="text-slate-600">{inv.client_snapshot.name}</span>
                            <span className="block text-xs text-slate-500">{next ? `${next.overdueDays} dní po splatnosti` : 'po splatnosti'} · zbývá {money(inv.outstanding, inv.currency)}{history.length ? ` · upomínáno: ${[...history].sort((a, b) => a.sent_on.localeCompare(b.sent_on)).map((h) => `${LEVELS[h.level].name.toLowerCase()} ${dateCz(h.sent_on)}`).join(', ')}` : ' · zatím neupomínáno'}</span></span>
                        {next ? (next.ready
                            ? <button type="button" onClick={() => setOpen({ inv, level: next.level })} className={primaryBtn}><Mail size={14} /> {LEVELS[next.level].name}</button>
                            : <span className="text-xs text-slate-500">{LEVELS[next.level].name.toLowerCase()} od {dateCz(next.readyOn)}</span>) : <span className="text-xs font-semibold text-slate-500">předžalobní výzva odeslána</span>}
                        {next && !next.ready && <button type="button" onClick={() => setOpen({ inv, level: next.level })} className={ghostBtn}>Připravit dřív</button>}
                    </li>
                ))}
            </ul>
            <p className="mt-1.5 text-xs text-slate-500">Upomínka se připraví jako hotový text. Odešlete ji e-mailem, vytiskněte nebo stáhněte do Wordu a pak ji označte jako odeslanou. Máte-li připojenou schránku, jde upomínku odeslat i přímo z aplikace.</p>
            {open && <Compose inv={open.inv} level={open.level} history={sent[open.inv.id] ?? []} userId={userId} signature={access.display_name || access.firm_name || access.email} account={access.bank_account ?? ''} onClose={() => setOpen(null)} onSent={async () => { setOpen(null); await load(); await onChanged(); }} />}
        </section>
    );
}

function Compose({ inv, level, history, userId, signature, account, onClose, onSent }: { inv: Receivable; level: Level; history: Sent[]; userId: string; signature: string; account: string; onClose: () => void; onSent: () => Promise<void> }) {
    const last = [...history].sort((a, b) => b.sent_on.localeCompare(a.sent_on))[0];
    const [draft] = useState<Draft>(() => reminderText({ level, number: inv.number ?? '', issue: inv.issue_date, due: inv.due_date ?? inv.issue_date, outstanding: inv.outstanding, currency: inv.currency === 'EUR' ? 'EUR' : 'CZK', account, vs: (inv.number ?? '').replace(/\D/g, ''), signature, today: todayIso(), lastSentOn: last?.sent_on }));
    const [body, setBody] = useState(draft.body);
    const [subject, setSubject] = useState(draft.subject);
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const to = inv.client_snapshot.email ?? '';

    async function mark(channel: string) {
        setBusy(true); setError('');
        const { error: err } = await supabase.from('invoice_reminders').insert({ user_id: userId, invoice_id: inv.id, level, sent_on: todayIso(), channel });
        setBusy(false);
        if (err) { setError(/invoice_reminders|schema cache|does not exist/i.test(err.message) ? 'Upomínky zatím nejsou v databázi zapnuté (chybí spuštění souboru platby-banka.sql).' : err.message); return; }
        await onSent();
    }
    async function print() {
        const payload = account ? spayd({ iban: account, amount: inv.outstanding, currency: inv.currency === 'EUR' ? 'EUR' : 'CZK', vs: inv.number ?? '', message: `Faktura ${inv.number}`, due: undefined }) : null;
        const svg = payload ? await qrSvg(payload, 110).catch(() => '') : '';
        const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const w = window.open('', '_blank'); if (!w) { setError('Prohlížeč zablokoval nové okno.'); return; }
        w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(subject)}</title><body style="font:14px/1.6 Georgia,serif;max-width:44rem;margin:2.5rem auto"><h2 style="font-size:17px">${esc(subject)}</h2><div style="white-space:pre-wrap">${esc(body)}</div>${svg ? `<div style="margin-top:20px;display:flex;gap:12px;align-items:center"><div style="width:110px;height:110px">${svg}</div><small>QR platba: ${esc(String(inv.outstanding))} ${inv.currency}</small></div>` : ''}</body>`);
        w.document.close(); w.print();
    }
    async function word() {
        const blob = await buildDocx(`${subject}\n\n${body}`);
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `upominka-${(inv.number ?? 'faktura').replace(/\W+/g, '_')}.docx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[6vh]" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-label="Upomínka" onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl space-y-3 rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-rose-700">{LEVELS[level].name} · {inv.number}</p><h2 className="text-lg font-bold text-slate-900">{inv.client_snapshot.name}</h2></div><button type="button" onClick={onClose} aria-label="Zavřít" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"><X size={18} /></button></div>
                {draft.interestRate !== null && <p className="rounded-lg bg-indigo-50 p-2.5 text-xs text-indigo-950">Zákonný úrok z prodlení {String(draft.interestRate).replace('.', ',')} % ročně činí ke dnešku {money(draft.interest, inv.currency)}. {level === 1 ? 'V první upomínce se neuvádí.' : 'Uvádí se v textu.'}</p>}
                <label className="block text-xs font-semibold text-slate-600">Předmět<input value={subject} onChange={(e) => setSubject(e.target.value)} className={`${inputCls} mt-1 font-normal`} /></label>
                <label className="block text-xs font-semibold text-slate-600">Text (upravte podle potřeby)<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={13} className={`${inputCls} mt-1 font-normal leading-relaxed`} /></label>
                {!account && <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-950">V Nastavení chybí číslo účtu, v textu proto nebude účet ani QR platba.</p>}
                {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
                <div className="flex flex-wrap gap-2">
                    {to ? <a href={mailtoLink(to, { ...draft, subject, body })} onClick={() => void mark('e-mail')} className={primaryBtn}><Mail size={15} /> Otevřít e-mail a označit jako odeslanou</a> : <span className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Klient nemá e-mail, použijte tisk nebo Word.</span>}
                    <button type="button" onClick={() => { void navigator.clipboard?.writeText(`${subject}\n\n${body}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className={ghostBtn}><Copy size={14} /> {copied ? 'Zkopírováno' : 'Kopírovat'}</button>
                    <button type="button" onClick={() => void print()} className={ghostBtn}><Printer size={14} /> Tisk / PDF</button>
                    <button type="button" onClick={() => void word()} className={ghostBtn}><Download size={14} /> Word</button>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><p className="flex items-center gap-1.5"><FileText size={12} aria-hidden="true" /> Až upomínku skutečně odešlete jinou cestou (tisk, datová schránka, vlastní e-mail), označte ji:</p><button type="button" onClick={() => void mark('jinak')} disabled={busy} className={`${ghostBtn} mt-2`}><Check size={14} /> Označit jako odeslanou</button></div>
            </div>
        </div>
    );
}
