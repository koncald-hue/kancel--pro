'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Send, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadCases, type LegalCase } from '@/lib/cases';
import { loadReceivables } from '@/lib/billing';
import { insertRow } from '@/lib/caseFile';
import { BULK_PRESETS, MAX_BULK, cleanRecipients, render, unknownPlaceholders, type Recipient } from '@/lib/bulkMail';
import { MAILER_HINT, useMailer } from '@/lib/useMailer';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';
import E2eeBox from '../situation/E2eeBox';

type Client = { id: string; name: string; email: string };
type Audience = 'all' | 'open' | 'overdue';
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

// Hromadný e-mail klientům z vaší schránky: každý dostane svůj e-mail s osobním oslovením, před odesláním vidíte přesný text
export default function LawyerBulkMail() {
    const { userId, access } = useLawyer();
    const mailer = useMailer();
    const [clients, setClients] = useState<Client[] | null>(null);
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [overdue, setOverdue] = useState<Set<string>>(new Set());
    const [audience, setAudience] = useState<Audience>('all');
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [subject, setSubject] = useState(BULK_PRESETS[0].subject); const [body, setBody] = useState(BULK_PRESETS[0].body);
    const [writeCase, setWriteCase] = useState(true); const [confirm, setConfirm] = useState(false);
    const [state, setState] = useState<{ sending: boolean; done: { name: string; ok: boolean; err?: string }[]; total: number } | null>(null);
    const signature = access.firm_name || access.display_name || '';

    useEffect(() => {
        let alive = true;
        (async () => {
            const [c, all, rec] = await Promise.all([supabase.from('lawyer_clients').select('id, name, email').order('name'), loadCases().catch(() => [] as LegalCase[]), loadReceivables(!!access.vat_payer).catch(() => [])]);
            if (!alive) return;
            setClients((c.data ?? []) as Client[]); setCases(all);
            setOverdue(new Set(rec.filter((r) => r.state === 'overdue' && r.client_id).map((r) => r.client_id as string)));
        })();
        return () => { alive = false; };
    }, [access.vat_payer]);

    const openCaseOf = (clientId: string) => cases.find((c) => c.status === 'open' && c.client_id === clientId);
    const list = useMemo(() => (clients ?? []).filter((c) => c.email.trim() && (audience === 'all' || (audience === 'open' && openCaseOf(c.id)) || (audience === 'overdue' && overdue.has(c.id)))), [clients, audience, cases, overdue]); // eslint-disable-line react-hooks/exhaustive-deps
    const recipients: Recipient[] = list.filter((c) => picked.has(c.id)).map((c) => ({ id: c.id, name: c.name, email: c.email.trim(), vec: openCaseOf(c.id)?.title ?? '' }));
    const { ok: sendable, invalid, duplicates } = cleanRecipients(recipients);
    const unknown = unknownPlaceholders(subject + body);
    const tooMany = sendable.length > MAX_BULK;
    const canSend = mailer.status === 'ready' && sendable.length > 0 && !tooMany && subject.trim() && body.trim().length > 20 && confirm && unknown.length === 0 && !state?.sending;
    const sample = sendable[0];

    function applyPreset(id: string) { const p = BULK_PRESETS.find((x) => x.id === id); if (p) { setSubject(p.subject); setBody(p.body); } }
    function toggleAll(on: boolean) { setPicked(on ? new Set(list.map((c) => c.id)) : new Set()); }

    async function send() {
        const total = sendable.length; const done: { name: string; ok: boolean; err?: string }[] = [];
        setState({ sending: true, done, total });
        for (const r of sendable) {
            try {
                await mailer.send({ to: r.email, subject: render(subject, r, signature), text: render(body, r, signature) });
                const c = writeCase ? openCaseOf(r.id) : undefined;
                if (c) { try { await insertRow('case_entries', { case_id: c.id, user_id: userId, kind: 'event', title: `Odeslán e-mail klientovi: ${render(subject, r, signature)}`.slice(0, 200), body: render(body, r, signature).slice(0, 4000) }); } catch { /* zápis je doplněk */ } }
                done.push({ name: r.name, ok: true });
            } catch (e) { done.push({ name: r.name, ok: false, err: e instanceof Error ? e.message : 'Neodesláno' }); }
            setState({ sending: true, done: [...done], total });
            await sleep(1200);
        }
        setState({ sending: false, done, total }); setConfirm(false);
    }

    if (mailer.status === 'loading' || clients === null) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    const card = 'rounded-2xl border border-slate-200 bg-white p-5';
    return (
        <div className="space-y-5">
            <section className={card}>
                <h2 className="text-lg font-bold text-slate-900">Hromadný e-mail klientům</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Vyberte klienty, upravte text a zkontrolujte ho. Každý klient dostane vlastní e-mail z vaší schránky (nikdo nevidí adresy ostatních). Hodí se na provozní sdělení: změnu sazby, výzvu k doplnění podkladů, změnu adresy. Ne na obchodní nabídky (ty podléhají souhlasu podle zákona č. 480/2004 Sb.).</p>
                {mailer.status === 'locked' ? <div className="mt-3"><E2eeBox access={access} onChanged={() => undefined} /></div> : mailer.status !== 'ready' && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{MAILER_HINT[mailer.status]}</p>}
                {mailer.status === 'ready' && <p className="mt-2 text-xs text-slate-500">Odesílá se z adresy {mailer.email}.</p>}
            </section>

            <section className={card} aria-label="Příjemci">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-900">Komu ({picked.size} vybráno z {list.length})</h3>
                    <div className="flex flex-wrap items-center gap-2">
                        <select value={audience} onChange={(e) => { setAudience(e.target.value as Audience); setPicked(new Set()); }} aria-label="Skupina klientů" className={`${inputCls} w-auto`}>
                            <option value="all">Všichni klienti s e-mailem</option><option value="open">Klienti s otevřeným spisem</option><option value="overdue">Klienti s fakturou po splatnosti</option>
                        </select>
                        <button type="button" onClick={() => toggleAll(picked.size !== list.length)} className={ghostBtn}>{picked.size === list.length && list.length > 0 ? 'Zrušit výběr' : 'Vybrat všechny'}</button>
                    </div>
                </div>
                {list.length === 0 ? <p className="mt-3 text-sm text-slate-500">V této skupině není žádný klient s e-mailem.</p> : (
                    <ul className="mt-3 grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
                        {list.map((c) => <li key={c.id}><label className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-slate-50"><input type="checkbox" checked={picked.has(c.id)} onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })} /> <span className="truncate font-semibold text-slate-800">{c.name}</span> <span className="truncate text-xs text-slate-500">{c.email}</span></label></li>)}
                    </ul>
                )}
                {(invalid > 0 || duplicates > 0) && <p className="mt-2 text-xs text-amber-900">Vynecháno: {invalid ? `${invalid} s neplatnou adresou` : ''}{invalid && duplicates ? ', ' : ''}{duplicates ? `${duplicates} duplicitních adres` : ''}.</p>}
            </section>

            <section className={card} aria-label="Text">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900">Text</h3>
                    <select value="" onChange={(e) => applyPreset(e.target.value)} aria-label="Vzor" className={`${inputCls} w-auto`}><option value="">Vložit vzor…</option>{BULK_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Předmět" aria-label="Předmět" className={`${inputCls} mt-3`} maxLength={200} />
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={11} aria-label="Text e-mailu" className={`${inputCls} mt-2 font-mono text-[13px]`} />
                <p className="mt-1 text-xs text-slate-500">Pole v textu: <code>{'{jmeno}'}</code> (jméno klienta), <code>{'{vec}'}</code> (jeho otevřený spis), <code>{'{kancelar}'}</code> (podpis).</p>
                {unknown.length > 0 && <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-rose-800"><AlertTriangle size={14} aria-hidden="true" /> Neznámé pole: {unknown.map((u) => `{${u}}`).join(', ')}. Doplňte text místo pole (např. ______ jsou místa k vyplnění).</p>}
                {/_{3,}/.test(subject + body) && <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-amber-900"><AlertTriangle size={14} aria-hidden="true" /> V textu zůstala nedoplněná místa (______).</p>}
            </section>

            {sample && (
                <section className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-5" aria-label="Náhled">
                    <h3 className="font-bold text-slate-900">Náhled pro {sample.name}</h3>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{render(subject, sample, signature)}</p>
                    <pre className="mt-1 whitespace-pre-wrap font-sans text-sm text-slate-800">{render(body, sample, signature)}</pre>
                </section>
            )}

            <section className={card}>
                {tooMany && <p role="alert" className="mb-2 text-sm font-semibold text-rose-800">Najednou lze odeslat nejvýš {MAX_BULK} e-mailů. Vyberte méně příjemců.</p>}
                <label className="flex items-center gap-2 text-sm text-slate-800"><input type="checkbox" checked={writeCase} onChange={(e) => setWriteCase(e.target.checked)} /> Zapsat odeslání do chronologie otevřené spisy klienta</label>
                <label className="mt-2 flex items-start gap-2 text-sm font-semibold text-slate-900"><input type="checkbox" className="mt-0.5" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> Text jsem zkontroloval(a) a odešlu {sendable.length} {sendable.length === 1 ? 'e-mail' : 'e-mailů'}. Odeslání nejde vzít zpět.</label>
                <button type="button" onClick={() => void send()} disabled={!canSend} className={`${primaryBtn} mt-3`}>{state?.sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Odeslat {sendable.length || ''}</button>
                {state && (
                    <div className="mt-4" role="status">
                        <p className="text-sm font-semibold text-slate-800">{state.sending ? `Odesílám ${state.done.length} z ${state.total}…` : `Hotovo: odesláno ${state.done.filter((d) => d.ok).length} z ${state.total}.`}</p>
                        <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto text-xs">{state.done.map((d, i) => <li key={i} className={`flex items-center gap-1.5 ${d.ok ? 'text-slate-600' : 'font-semibold text-rose-800'}`}>{d.ok ? <CheckCircle2 size={12} className="text-emerald-600" aria-hidden="true" /> : <XCircle size={12} aria-hidden="true" />} {d.name}{d.err ? `: ${d.err}` : ''}</li>)}</ul>
                    </div>
                )}
            </section>
        </div>
    );
}
