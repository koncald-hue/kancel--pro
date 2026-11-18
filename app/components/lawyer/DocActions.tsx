'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, Check, Clock3, Loader2, Reply, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { insertConfirmedDeadline, insertRow } from '@/lib/caseFile';
import { computeEnd, czDate, pragueDate, unitText } from '@/lib/lhuty';
import { analyzeText, type Candidate } from '@/lib/lhutyExtract';
import { countWords, readMinutes, replyDrafts, replyDue } from '@/lib/docActions';
import { scheduleGoogleSync } from '@/lib/googleSync';
import { inputCls, primaryBtn } from '../situation/caseUi';

type Props = {
    caseId: string; caseTitle: string; reference: string; userId: string; signature: string;
    subject: string; text: string; sender: string; dateIso: string | null; kind: 'e-mail' | 'datová zpráva';
    onReply?: (body: string) => void;
};

// Jeden krok po přijetí dokumentu: zapsat čas, založit úkol s termínem odpovědi, najít lhůty v textu a připravit odpověď.
// Lhůty se ukládají jen po výslovném potvrzení a vždy jako potvrzené po kontrole advokátem.
export default function DocActions({ caseId, caseTitle, reference, userId, signature, subject, text, sender, dateIso, kind, onReply }: Props) {
    const today = pragueDate(new Date().toISOString());
    const words = useMemo(() => countWords(text), [text]);
    const [doTime, setDoTime] = useState(true);
    const [minutes, setMinutes] = useState(String(readMinutes(words)));
    const [doTask, setDoTask] = useState(true);
    const [due, setDue] = useState(replyDue(today));
    const [pickedDl, setPickedDl] = useState<Record<string, boolean>>({});
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(''); const [error, setError] = useState('');
    const found = useMemo(() => analyzeText(text, subject).candidates.filter((c) => c.kind === 'relativni' && c.n && c.unit), [text, subject]);
    const eventIso = dateIso ? pragueDate(dateIso) : today;
    const endOf = (c: Candidate) => computeEnd(eventIso, c.n as number, c.unit!);
    const drafts = useMemo(() => replyDrafts({ name: '', subject, caseTitle, reference, signature }), [subject, caseTitle, reference, signature]);
    const chosenDl = found.filter((c) => pickedDl[c.id]);
    const mins = Number(minutes);
    const valid = (!doTime || (Number.isInteger(mins) && mins > 0 && mins <= 1440)) && (!doTask || /^\d{4}-\d{2}-\d{2}$/.test(due)) && (chosenDl.length === 0 || confirm);

    async function run() {
        setBusy(true); setError(''); setResult('');
        const done: string[] = [];
        try {
            if (doTime) {
                const last = await supabase.from('time_entries').select('rate').eq('case_id', caseId).order('created_at', { ascending: false }).limit(1);
                const any = last.data?.[0] ? last : await supabase.from('time_entries').select('rate').order('created_at', { ascending: false }).limit(1);
                const rate = Number(any.data?.[0]?.rate ?? 0);
                const { error: e } = await supabase.from('time_entries').insert({ user_id: userId, case_id: caseId, entry_date: today, minutes: mins, description: `Studium ${kind === 'e-mail' ? 'e-mailu' : 'datové zprávy'}: ${subject}`.slice(0, 200), rate });
                if (e) throw new Error(e.message); done.push(`čas ${mins} min${rate ? '' : ' (sazba 0 Kč, doplňte ve výkazech)'}`);
            }
            if (doTask && due) {
                await insertRow('case_deadlines', { case_id: caseId, user_id: userId, title: `Odpovědět: ${subject}`.slice(0, 120), due_date: due, kind: 'ukol' }); done.push(`úkol do ${czDate(due)}`);
            }
            for (const c of chosenDl) {
                const e = endOf(c);
                await insertConfirmedDeadline({ ...(c.lawKey ? { law_key: c.lawKey } : {}), case_id: caseId, user_id: userId, title: `${c.label} (${unitText(c.n as number, c.unit!)}) – ${kind}`.slice(0, 120), due_date: e.end, basis: `Počítáno od ${czDate(eventIso)} (datum ${kind === 'e-mail' ? 'e-mailu' : 'zprávy'}). ${kind === 'e-mail' ? 'E-mail není doručením podle procesních předpisů, rozhodné datum doručení ověřte.' : ''}`.slice(0, 1500), quote: c.quote.slice(0, 1500) });
                done.push(`lhůta do ${czDate(e.end)}`);
            }
            if (chosenDl.length) scheduleGoogleSync();
            if (done.length) { try { await insertRow('case_entries', { case_id: caseId, user_id: userId, kind: 'event', title: `Zpracováno: ${subject}`.slice(0, 200), body: `Kroky: ${done.join(', ')}.` }); } catch { /* chronologie je doplněk */ } }
            setResult(done.length ? `Hotovo: ${done.join(', ')}.` : 'Nic nebylo vybráno.');
        } catch (e) { setError(e instanceof Error ? e.message : 'Kroky se nepodařilo provést.'); }
        setBusy(false);
    }

    return (
        <section className="space-y-3 rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-4" aria-label="Další kroky">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><Sparkles size={16} className="text-indigo-700" aria-hidden="true" /> Další kroky k věci „{caseTitle}“</h3>
            <div className="space-y-2 text-sm">
                <label className="flex flex-wrap items-center gap-2"><input type="checkbox" checked={doTime} onChange={(e) => setDoTime(e.target.checked)} /><Clock3 size={14} className="text-slate-500" aria-hidden="true" /> Zapsat čas za prostudování
                    <input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" aria-label="Minuty" className={`${inputCls} w-20`} /> min <span className="text-xs text-slate-500">(odhad podle délky textu: {words} slov)</span></label>
                <label className="flex flex-wrap items-center gap-2"><input type="checkbox" checked={doTask} onChange={(e) => setDoTask(e.target.checked)} /><CalendarClock size={14} className="text-slate-500" aria-hidden="true" /> Úkol „Odpovědět“ do
                    <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Termín odpovědi" className={`${inputCls} w-44`} /></label>
            </div>
            {found.length > 0 && (
                <div className="rounded-xl bg-white p-3 text-sm">
                    <p className="font-semibold text-slate-900">V textu jsem našel možné lhůty:</p>
                    <ul className="mt-2 space-y-2">
                        {found.map((c) => (
                            <li key={c.id}><label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={!!pickedDl[c.id]} onChange={(e) => setPickedDl((p) => ({ ...p, [c.id]: e.target.checked }))} />
                                <span><strong>{c.label}</strong> ({unitText(c.n as number, c.unit!)}) → <strong>{czDate(endOf(c).end)}</strong> <span className="text-xs text-slate-500">od {czDate(eventIso)}</span>
                                    {c.quote && <span className="mt-0.5 block border-l-2 border-indigo-300 pl-2 text-xs italic text-slate-600">{c.quote}</span>}</span></label></li>
                        ))}
                    </ul>
                    {chosenDl.length > 0 && <label className="mt-2 flex items-start gap-2 text-xs font-semibold text-slate-800"><input type="checkbox" className="mt-0.5" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> Datum jsem zkontroloval(a) podle dokumentu a doručení a potvrzuji ho. Je to pomůcka, ne právní posouzení; {kind === 'e-mail' ? 'e-mail nemusí být doručením podle procesních předpisů.' : 'u datových zpráv použijte raději panel Lhůty z této zprávy.'}</label>}
                </div>
            )}
            {onReply && (
                <div className="flex flex-wrap items-center gap-2 text-sm"><Reply size={14} className="text-slate-500" aria-hidden="true" /> Napsat odpověď:
                    {drafts.map((d) => <button key={d.id} type="button" onClick={() => onReply(d.body)} className="cursor-pointer rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-400">{d.label}</button>)}</div>
            )}
            <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => void run()} disabled={busy || !valid || (!doTime && !doTask && chosenDl.length === 0)} className={primaryBtn}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Provést vybrané kroky</button>
                <span className="text-xs text-slate-500">Odesílatel: {sender}. Nic se neodešle, jen se zapíše do věci.</span></div>
            {result && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{result}</p>}
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
        </section>
    );
}
