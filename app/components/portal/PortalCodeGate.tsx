'use client';

import { useState } from 'react';
import { KeyRound, Mail } from 'lucide-react';

const MESSAGES: Record<string, string> = {
    rate: 'Příliš mnoho pokusů. Zkuste to prosím za chvíli.',
    'mail-off': 'Odesílání kódů teď nefunguje. Kontaktujte prosím advokáta jinou cestou.',
    'mail-failed': 'E-mail s kódem se nepodařilo odeslat. Zkuste to znovu.',
    expired: 'Kód vypršel nebo ještě nebyl odeslán. Požádejte o nový.',
    limit: 'Kód jste zadali příliš mnohokrát chybně. Požádejte o nový.',
    invalid: 'Kód má šest číslic.',
};

// Druhý faktor klientské stránky: kód z e-mailu, který u věci zadal advokát
export default function PortalCodeGate({ token, email, title, onDone }: { token: string; email: string; title: string; onDone: () => void }) {
    const [sent, setSent] = useState(false);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function call(action: 'send' | 'verify') {
        setBusy(true); setError('');
        try {
            const res = await fetch(`/api/portal/${token}/code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'verify' ? { action, code } : { action }) });
            const out = await res.json().catch(() => ({})) as { error?: string; left?: number };
            if (!res.ok) { setError(out.error === 'mismatch' ? `Kód nesouhlasí. Zbývá pokusů: ${out.left ?? 0}.` : MESSAGES[out.error ?? ''] ?? 'Něco se nepovedlo. Zkuste to znovu.'); return; }
            if (action === 'send') setSent(true); else onDone();
        } catch { setError('Spojení selhalo. Zkuste to znovu.'); }
        finally { setBusy(false); }
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="code-title">
            <KeyRound size={26} className="text-indigo-800" aria-hidden="true" />
            <h1 id="code-title" className="mt-3 text-xl font-bold text-slate-900">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Advokát u této stránky zapnul ověření kódem. Pošleme vám jednorázový kód na e-mail <strong className="text-slate-900">{email}</strong>. Na tomto zařízení pak stránka zůstane otevřená 12 hodin.</p>
            {!sent ? (
                <button type="button" onClick={() => void call('send')} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-900 disabled:opacity-60 cursor-pointer"><Mail size={16} aria-hidden="true" /> {busy ? 'Posílám…' : 'Poslat kód'}</button>
            ) : (
                <form onSubmit={(e) => { e.preventDefault(); void call('verify'); }} className="mt-4 space-y-3">
                    <label className="block text-sm font-semibold text-slate-800">Kód z e-mailu
                        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="mt-1 block w-40 rounded-lg border border-slate-300 px-3 py-2 text-lg tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-indigo-700/40" />
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <button type="submit" disabled={busy || code.length !== 6} className="rounded-lg bg-indigo-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-900 disabled:opacity-60 cursor-pointer">{busy ? 'Ověřuji…' : 'Ověřit a otevřít'}</button>
                        <button type="button" onClick={() => void call('send')} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">Poslat nový kód</button>
                    </div>
                </form>
            )}
            {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-900">{error}</p>}
            <p className="mt-4 text-xs text-slate-500">E-mail nesedí? Kontaktujte advokáta. Adresu pro kódy může změnit jen on.</p>
        </section>
    );
}
