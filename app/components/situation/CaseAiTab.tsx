'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Copy, FilePlus2, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AI_MAX_CHARS, redact } from '@/lib/redact';
import { buildContext, DRAFT_TYPES, type AiTask, type Doc, type DraftType } from '@/lib/caseContext';
import { todayIso } from '@/lib/billing';
import { insertRow } from '@/lib/caseFile';
import { ghostBtn, inputCls, primaryBtn, type TabProps } from './caseUi';

const TASKS: { id: AiTask; label: string; hint: string; needsText?: boolean }[] = [
    { id: 'brief', label: 'Přehled věci před jednáním', hint: 'O co jde, průběh s daty, lhůty a co chybí. Z dat věci.' },
    { id: 'client', label: 'Shrnutí pro klienta', hint: 'Srozumitelně, bez žargonu: co se stalo a co bude dál.' },
    { id: 'draft', label: 'Koncept podání nebo dopisu', hint: 'Struktura a text z údajů věci, chybějící místa označí [DOPLNIT].' },
    { id: 'ask', label: 'Zeptat se spisu', hint: 'Otázka nad chronologií a vybranými dokumenty, s odkazem na zdroj.' },
    { id: 'summary', label: 'Shrnout vložený text', hint: 'Datová zpráva, e-mail, rozhodnutí.', needsText: true },
    { id: 'reply', label: 'Navrhnout odpověď na text', hint: 'Koncept odpovědi na vloženou zprávu.', needsText: true },
];
const TITLE: Record<AiTask, string> = { brief: 'Přehled před jednáním', client: 'Shrnutí pro klienta', draft: 'Koncept', ask: 'Odpověď', summary: 'Shrnutí', reply: 'Návrh odpovědi' };

// Asistent (AI) nad daty věci. Advokát vidí přesně, co odejde, a odeslání vždy potvrzuje. Nic se neposílá samo.
export default function CaseAiTab({ item, bundle, userId }: TabProps) {
    const [consent, setConsent] = useState<boolean | null>(null);
    const [task, setTask] = useState<AiTask>('brief');
    const [text, setText] = useState('');
    const [draftType, setDraftType] = useState<DraftType>('vyzva');
    const [instructions, setInstructions] = useState('');
    const [question, setQuestion] = useState('');
    const [docs, setDocs] = useState<(Doc & { id: string })[]>([]);
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [answer, setAnswer] = useState<{ text: string; redacted: number; task: AiTask } | null>(null);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [saved, setSaved] = useState('');

    useEffect(() => {
        let a = true;
        supabase.from('lawyer_access').select('ai_consent_at').eq('user_id', userId).maybeSingle().then(({ data, error: e }) => { if (a) setConsent(e ? null : !!(data as { ai_consent_at?: string | null } | null)?.ai_consent_at); });
        return () => { a = false; };
    }, [userId]);
    // Text dokumentů věci, který už Kancelář zná (z nahraných souborů a OCR)
    useEffect(() => {
        let a = true;
        supabase.from('case_file_text').select('file_id, body').eq('case_id', item.id).then(({ data }) => {
            if (!a || !data) return;
            const names = new Map(bundle.files.map((f) => [f.id, f.name]));
            setDocs((data as { file_id: string; body: string }[]).filter((d) => names.has(d.file_id) && d.body.trim()).map((d) => ({ id: d.file_id, name: names.get(d.file_id) ?? 'dokument', body: d.body })));
        });
        return () => { a = false; };
    }, [item.id, bundle.files]);

    const current = TASKS.find((t) => t.id === task)!;
    const outgoing = useMemo(() => {
        if (current.needsText) return text.trim();
        return buildContext({ task, item, deadlines: bundle.deadlines, entries: bundle.entries, docs: docs.filter((d) => picked.has(d.id)), today: todayIso(), max: AI_MAX_CHARS - 200, draftType, instructions, question });
    }, [current.needsText, text, task, item, bundle.deadlines, bundle.entries, docs, picked, draftType, instructions, question]);
    const prepared = useMemo(() => redact(outgoing), [outgoing]);
    const tooLong = prepared.text.length > AI_MAX_CHARS;
    const missing = current.needsText ? !text.trim() : task === 'ask' ? question.trim().length < 5 : false;

    async function setConsentTo(on: boolean) {
        const { error: e } = await supabase.rpc('set_ai_consent', { p_on: on });
        if (e) setError(/set_ai_consent|schema cache/i.test(e.message) ? 'Vyžaduje SQL migraci 20261118_08.' : e.message); else { setConsent(on); setError(''); }
    }
    async function run() {
        setBusy(true); setError(''); setAnswer(null); setSaved('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/case-ai', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ mode: task, text: outgoing, confirmed: true }) });
            const out = await res.json().catch(() => ({})) as { answer?: string; redacted?: number; error?: string; message?: string };
            if (!res.ok) { setError(out.error === 'disabled' ? 'AI není na serveru zapnutá (chybí OPENAI_API_KEY).' : out.error === 'consent' ? 'Nejdřív udělte souhlas níže.' : out.error === 'rate' ? 'Příliš mnoho dotazů, zkuste to za chvíli.' : out.message || 'AI teď neodpověděla. Zkuste to znovu.'); return; }
            setAnswer({ text: out.answer ?? '', redacted: out.redacted ?? 0, task }); setConfirmed(false);
        } catch { setError('Spojení selhalo.'); } finally { setBusy(false); }
    }
    async function saveNote() {
        if (!answer) return;
        try {
            await insertRow('case_entries', { case_id: item.id, user_id: userId, kind: 'note', title: `${TITLE[answer.task]} (AI, ke kontrole)`, body: answer.text.slice(0, 8000), happened_on: todayIso() });
            setSaved('Uloženo do chronologie jako poznámka.');
        } catch (e) { setSaved(e instanceof Error ? e.message : 'Nepodařilo se uložit.'); }
    }

    if (consent === null) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (!consent) {
        return (
            <section className="max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-5" aria-labelledby="ai-consent">
                <h2 id="ai-consent" className="flex items-center gap-2 text-lg font-bold text-amber-950"><ShieldAlert size={18} aria-hidden="true" /> Asistent (AI) je vypnutý</h2>
                <p className="mt-2 text-sm leading-relaxed text-amber-950">Asistent pošle text, který vyberete, externímu poskytovateli umělé inteligence (OpenAI), tedy mimo Kancelář a pravděpodobně mimo EU. Před odesláním se zakryjí rodná čísla, čísla účtů, e-maily a telefony, ale <strong>jména, adresy a popisy osob se nezakryjí</strong>. Odpovědi mohou obsahovat chyby, berte je jako podklad ke kontrole. U zpráv klientů a údajů, které podléhají vaší mlčenlivosti, zvažte, zda je odeslání vhodné a zda máte souhlas klienta.</p>
                <p className="mt-2 text-xs text-amber-900">Souhlas můžete kdykoli odvolat. Bez něj server požadavek odmítne.</p>
                <button type="button" onClick={() => void setConsentTo(true)} className={`${primaryBtn} mt-3`}>Rozumím a zapínám asistenta</button>
                {error && <p role="alert" className="mt-3 text-sm text-rose-900">{error}</p>}
            </section>
        );
    }
    return (
        <div className="max-w-3xl space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Sparkles size={18} className="text-violet-700" aria-hidden="true" /> Asistent (AI)</h2>
                <p className="mt-1 text-sm text-slate-600">Vyberte, co potřebujete. Podklad se složí z údajů věci, níže uvidíte přesně, co odejde, a nic se neodešle bez vašeho potvrzení.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Co má asistent udělat">
                    {TASKS.map((t) => <button key={t.id} type="button" role="radio" aria-checked={task === t.id} onClick={() => { setTask(t.id); setAnswer(null); setConfirmed(false); }} className={`rounded-xl border p-3 text-left cursor-pointer ${task === t.id ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-violet-300'}`}><span className="block text-sm font-semibold text-slate-900">{t.label}</span><span className="block text-xs text-slate-600">{t.hint}</span></button>)}
                </div>

                {current.needsText && <label className="mt-4 block text-sm font-semibold text-slate-800">Text<textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className={`${inputCls} mt-1 font-normal`} placeholder="Vložte text zprávy nebo dokumentu…" /></label>}
                {task === 'draft' && (
                    <div className="mt-4 grid gap-2">
                        <label className="block text-sm font-semibold text-slate-800">Druh dokumentu<select value={draftType} onChange={(e) => setDraftType(e.target.value as DraftType)} className={`${inputCls} mt-1 font-normal`}>{DRAFT_TYPES.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></label>
                        <label className="block text-sm font-semibold text-slate-800">Co v něm má být<textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} maxLength={2000} className={`${inputCls} mt-1 font-normal`} placeholder="např. dlužná částka 25 000 Kč za dílo dle smlouvy ze 3. 3. 2026, splatnost 10 dní, jinak žaloba" /></label>
                    </div>
                )}
                {task === 'ask' && <label className="mt-4 block text-sm font-semibold text-slate-800">Otázka<input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} className={`${inputCls} mt-1 font-normal`} placeholder="např. Kdy byla klientovi doručena žaloba a kdo ji podal?" /></label>}
                {!current.needsText && (
                    <div className="mt-4">
                        <p className="text-sm font-semibold text-slate-800">Dokumenty k přiložení <span className="font-normal text-slate-500">({docs.length ? 'text z nahraných souborů' : 'žádný soubor zatím nemá načtený text, v Souborech použijte „Přečíst text (OCR)“'})</span></p>
                        {docs.length > 0 && <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">{docs.map((d) => <li key={d.id}><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={picked.has(d.id)} onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(d.id); else n.delete(d.id); return n; })} /> <span className="truncate">{d.name}</span></label></li>)}</ul>}
                    </div>
                )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5" aria-labelledby="ai-preview">
                <details>
                    <summary className="cursor-pointer text-sm font-bold text-slate-900" id="ai-preview">Přesně tohle odejde poskytovateli AI ({prepared.text.length} znaků, zakryto identifikátorů: {prepared.count})</summary>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-800">{prepared.text || '(zatím nic)'}</pre>
                </details>
                <p className="mt-2 text-xs text-slate-600">Rodná čísla, účty, e-maily a telefony se zakryjí. Jména a adresy ne{tooLong ? <span className="font-semibold text-rose-800">. Podklad je delší než {AI_MAX_CHARS} znaků, odeberte některý dokument</span> : ''}.</p>
                <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-slate-800"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-800" /> Souhlasím s odesláním tohoto podkladu externímu poskytovateli AI.</label>
                <button type="button" disabled={!confirmed || !prepared.text.trim() || tooLong || missing || busy} onClick={() => void run()} className={`${primaryBtn} mt-3`}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {current.label}</button>
                {missing && <p className="mt-2 text-xs text-slate-500">{current.needsText ? 'Vložte text.' : 'Napište otázku.'}</p>}
                {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-900">{error}</p>}
            </section>

            {answer && (
                <section className="rounded-2xl border border-violet-200 bg-white p-5" aria-labelledby="ai-answer">
                    <h3 id="ai-answer" className="text-sm font-bold text-slate-900">{TITLE[answer.task]}</h3>
                    <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-950"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> Vygenerováno umělou inteligencí. Není to právní posouzení ani záruka správnosti. Před použitím vše zkontrolujte{answer.task === 'draft' ? ', doplňte místa [DOPLNIT] a ověřte ustanovení [OVĚŘIT]' : ''}.</p>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{answer.text}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => { void navigator.clipboard?.writeText(answer.text); setCopied(true); window.setTimeout(() => setCopied(false), 1400); }} className={ghostBtn}><Copy size={14} aria-hidden="true" /> {copied ? 'Zkopírováno' : 'Zkopírovat'}</button>
                        <button type="button" onClick={() => void saveNote()} className={ghostBtn}><FilePlus2 size={14} aria-hidden="true" /> Uložit do chronologie</button>
                    </div>
                    {saved && <p role="status" className="mt-2 text-xs text-slate-600">{saved}</p>}
                </section>
            )}

            <p className="text-xs text-slate-500">Souhlas s asistentem můžete odvolat: <button type="button" onClick={() => void setConsentTo(false)} className="font-semibold underline cursor-pointer">vypnout asistenta</button>. Poskytovatel by podle svých podmínek neměl data z rozhraní API používat k trénování, ověřte aktuální podmínky před nasazením.</p>
        </div>
    );
}
