'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Copy, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AI_MAX_CHARS, redact } from '@/lib/redact';
import { ghostBtn, inputCls, primaryBtn, type TabProps } from './caseUi';

// Asistent (AI): shrnutí nebo koncept odpovědi z textu, který advokát vybere. Nic se neposílá samo.
export default function CaseAiTab({ item, bundle, userId }: TabProps) {
    const [consent, setConsent] = useState<boolean | null>(null);
    const [text, setText] = useState('');
    const [useChron, setUseChron] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState<'' | 'summary' | 'reply'>('');
    const [answer, setAnswer] = useState<{ text: string; redacted: number; mode: string } | null>(null);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let a = true;
        supabase.from('lawyer_access').select('ai_consent_at').eq('user_id', userId).maybeSingle().then(({ data, error: e }) => { if (a) setConsent(e ? null : !!(data as { ai_consent_at?: string | null } | null)?.ai_consent_at); });
        return () => { a = false; };
    }, [userId]);

    const chronology = useMemo(() => bundle.entries.slice(0, 40).map((e) => `${e.happened_on ?? e.created_at.slice(0, 10)}: ${e.title}${e.body ? ` – ${e.body}` : ''}`).join('\n'), [bundle.entries]);
    const outgoing = [useChron && chronology ? `Chronologie věci „${item.title}“:\n${chronology}` : '', text.trim()].filter(Boolean).join('\n\n');
    const prepared = useMemo(() => redact(outgoing), [outgoing]);
    const tooLong = prepared.text.length > AI_MAX_CHARS;

    async function setConsentTo(on: boolean) {
        const { error: e } = await supabase.rpc('set_ai_consent', { p_on: on });
        if (e) setError(/set_ai_consent|schema cache/i.test(e.message) ? 'Vyžaduje SQL migraci 20261118_08.' : e.message); else { setConsent(on); setError(''); }
    }
    async function run(mode: 'summary' | 'reply') {
        setBusy(mode); setError(''); setAnswer(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/case-ai', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ mode, text: outgoing, confirmed: true }) });
            const out = await res.json().catch(() => ({})) as { answer?: string; redacted?: number; error?: string; message?: string };
            if (!res.ok) { setError(out.error === 'disabled' ? 'AI není na serveru zapnutá (chybí OPENAI_API_KEY).' : out.error === 'consent' ? 'Nejdřív udělte souhlas níže.' : out.error === 'rate' ? 'Příliš mnoho dotazů, zkuste to za chvíli.' : out.message || 'AI teď neodpověděla. Zkuste to znovu.'); return; }
            setAnswer({ text: out.answer ?? '', redacted: out.redacted ?? 0, mode }); setConfirmed(false);
        } catch { setError('Spojení selhalo.'); } finally { setBusy(''); }
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
                <p className="mt-1 text-sm text-slate-600">Vložte text (např. obsah datové zprávy nebo e-mailu), případně přidejte chronologii věci. Asistent ho shrne nebo navrhne koncept odpovědi. Nic se neodešle, dokud nepotvrdíte níže.</p>
                <label className="mt-3 block text-sm font-semibold text-slate-800">Text k zpracování
                    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className={`${inputCls} mt-1`} placeholder="Vložte text zprávy nebo dokumentu…" />
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={useChron} onChange={(e) => setUseChron(e.target.checked)} className="h-4 w-4 accent-indigo-800" /> Přidat chronologii této věci ({bundle.entries.length} záznamů)</label>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5" aria-labelledby="ai-preview">
                <h3 id="ai-preview" className="text-sm font-bold text-slate-900">Přesně tohle odejde poskytovateli AI</h3>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-800">{prepared.text || '(zatím nic)'}</pre>
                <p className="mt-2 text-xs text-slate-600">{prepared.text.length} znaků · zakryto identifikátorů: {prepared.count}{tooLong ? <span className="font-semibold text-rose-800"> · text je delší než {AI_MAX_CHARS} znaků, zkraťte ho</span> : ''}. Jména a adresy se nezakrývají, upravte text sami, pokud je odeslat nechcete.</p>
                <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-slate-800"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-800" /> Souhlasím s odesláním tohoto textu externímu poskytovateli AI.</label>
                <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={!confirmed || !prepared.text.trim() || tooLong || !!busy} onClick={() => void run('summary')} className={primaryBtn}>{busy === 'summary' ? <Loader2 size={15} className="animate-spin" /> : null} Shrnout</button>
                    <button type="button" disabled={!confirmed || !prepared.text.trim() || tooLong || !!busy} onClick={() => void run('reply')} className={ghostBtn}>{busy === 'reply' ? <Loader2 size={15} className="animate-spin" /> : null} Navrhnout odpověď</button>
                </div>
                {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-900">{error}</p>}
            </section>

            {answer && (
                <section className="rounded-2xl border border-violet-200 bg-white p-5" aria-labelledby="ai-answer">
                    <h3 id="ai-answer" className="text-sm font-bold text-slate-900">{answer.mode === 'reply' ? 'Návrh odpovědi' : 'Shrnutí'}</h3>
                    <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-950"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> Vygenerováno umělou inteligencí. Není to právní posouzení ani záruka správnosti. Před použitím vše zkontrolujte.</p>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{answer.text}</div>
                    <button type="button" onClick={() => { void navigator.clipboard?.writeText(answer.text); setCopied(true); window.setTimeout(() => setCopied(false), 1400); }} className={`${ghostBtn} mt-3`}><Copy size={14} aria-hidden="true" /> {copied ? 'Zkopírováno' : 'Zkopírovat'}</button>
                </section>
            )}

            <p className="text-xs text-slate-500">Souhlas s asistentem můžete odvolat: <button type="button" onClick={() => void setConsentTo(false)} className="font-semibold underline cursor-pointer">vypnout asistenta</button>. Poskytovatel by podle svých podmínek neměl data z rozhraní API používat k trénování, ověřte aktuální podmínky před nasazením.</p>
        </div>
    );
}
