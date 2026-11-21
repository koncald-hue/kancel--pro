'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AI_MAX_CHARS } from '@/lib/redact';
import { anonymizeText } from '@/lib/anonymizer';
import { buildRoutePrompt, parseRoute, type RouteCase } from '@/lib/aiRoute';
import { ghostBtn } from '../situation/caseUi';

const ERR: Record<string, string> = { consent: 'Asistent (AI) není zapnutý. Zapnete ho v libovolném spisu na kartě Asistent (AI).', disabled: 'AI není na serveru zapnutá.', rate: 'Příliš mnoho dotazů, zkuste to za chvíli.', mfa: 'Přihlaste se znovu druhým faktorem.' };

// Návrh věci pomocí AI. Až po výslovném potvrzení a jen s uděleným souhlasem; posílá se výňatek e-mailu bez identifikátorů a názvy věcí.
export default function AiRouteSuggest({ mail, cases, onPick }: { mail: { subject: string; text: string }; cases: RouteCase[]; onPick: (caseId: string) => void }) {
    const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false);
    const [res, setRes] = useState<{ id: string | null; reason: string } | null>(null); const [err, setErr] = useState('');
    if (cases.length === 0) return null;
    async function run() {
        setBusy(true); setErr(''); setRes(null);
        try {
            const { text, list } = buildRoutePrompt({ subject: anonymizeText(mail.subject).text, text: anonymizeText(mail.text).text }, cases);
            if (text.length > AI_MAX_CHARS) throw new Error('E-mail je příliš dlouhý.');
            const { data: { session } } = await supabase.auth.getSession();
            const r = await fetch('/api/case-ai', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ mode: 'route', text, confirmed: true }) });
            const out = await r.json().catch(() => ({})) as { answer?: string; error?: string; message?: string };
            if (!r.ok) throw new Error(ERR[out.error ?? ''] ?? out.message ?? 'AI se nepodařilo zavolat.');
            const p = parseRoute(out.answer ?? '', list.length);
            setRes({ id: p.index === null ? null : list[p.index].id, reason: p.reason }); setConfirm(false);
        } catch (e) { setErr(e instanceof Error ? e.message : 'Nepodařilo se.'); } finally { setBusy(false); }
    }
    return (
        <div className="rounded-lg bg-indigo-50/60 p-2.5 text-xs">
            <label className="flex items-start gap-2 text-slate-800"><input type="checkbox" className="mt-0.5" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> Pro návrh spisu odešlu výňatek e-mailu a názvy otevřených spisů (bez e-mailů, telefonů a čísel účtů) externí službě AI.</label>
            <button type="button" disabled={!confirm || busy} onClick={() => void run()} className={`${ghostBtn} mt-1.5`}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Navrhnout spis (AI)</button>
            {res && (res.id
                ? <p role="status" className="mt-1.5 text-slate-800">AI navrhuje: <strong>{cases.find((c) => c.id === res.id)?.title}</strong>{res.reason ? ` (${res.reason})` : ''}. <button type="button" onClick={() => onPick(res.id!)} className="cursor-pointer font-semibold text-indigo-900 underline">Použít</button> Návrh je jen pomůcka, ověřte ho.</p>
                : <p role="status" className="mt-1.5 text-slate-600">AI si není jistá, žádný spis zjevně nesedí.</p>)}
            {err && <p role="alert" className="mt-1.5 font-semibold text-rose-800">{err}</p>}
        </div>
    );
}
