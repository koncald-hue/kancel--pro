'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CheckCircle2, Loader2, Lock, Send } from 'lucide-react';

const field = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-700/40';

// Veřejná poptávka kanceláře: člověk popíše věc a kancelář ji uvidí ve své složce Poptávky
export default function IntakeForm() {
    const code = usePathname().split('/').filter(Boolean).pop() ?? '';
    const [firm, setFirm] = useState<string | null>(null);
    const [state, setState] = useState<'loading' | 'ok' | 'invalid' | 'sent'>('loading');
    const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', website: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/intake?code=${encodeURIComponent(code)}`)
            .then(async (res) => { if (cancelled) return; if (!res.ok) { setState('invalid'); return; } setFirm((await res.json()).firm ?? ''); setState('ok'); })
            .catch(() => { if (!cancelled) setState('invalid'); });
        return () => { cancelled = true; };
    }, [code]);

    const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

    async function submit() {
        if (form.message.trim().length < 10) { setError('Popište věc aspoň několika větami.'); return; }
        if (!form.email.trim() && !form.phone.trim()) { setError('Uveďte e-mail nebo telefon, ať se vám můžeme ozvat.'); return; }
        setBusy(true); setError('');
        try {
            const res = await fetch('/api/intake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, ...form }) });
            if (res.status === 429) throw new Error('Příliš mnoho odeslání. Zkuste to prosím později.');
            if (!res.ok) throw new Error('Poptávku se nepodařilo odeslat. Zkuste to prosím znovu.');
            setState('sent');
        } catch (err) { setError(err instanceof Error ? err.message : 'Něco se nepovedlo.'); } finally { setBusy(false); }
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
                {state === 'loading' && <p className="text-center text-sm text-slate-500" role="status">Načítám…</p>}
                {state === 'invalid' && <div className="text-center"><Lock size={30} className="mx-auto text-indigo-800" aria-hidden="true" /><h1 className="mt-3 text-2xl font-bold text-slate-900">Odkaz není platný</h1><p className="mt-2 text-sm text-slate-600">Požádejte kancelář o aktuální odkaz.</p></div>}
                {state === 'sent' && <div className="text-center"><CheckCircle2 size={34} className="mx-auto text-emerald-600" aria-hidden="true" /><h1 className="mt-3 text-2xl font-bold text-slate-900">Děkujeme, poptávka je odeslaná</h1><p className="mt-2 text-sm leading-relaxed text-slate-600">{firm || 'Kancelář'} se vám ozve na uvedený kontakt. Jakmile vaši věc převezme, pošle vám zabezpečený odkaz, přes který mu budete moct psát a posílat dokumenty. Do té doby nic dalšího nepodnikejte a případné dokumenty si schovejte.</p></div>}
                {state === 'ok' && (
                    <>
                        {firm && <p className="text-xs font-semibold uppercase tracking-wider text-indigo-800">{firm}</p>}
                        <h1 className="mt-1 text-3xl font-bold text-slate-900">Popište svou věc</h1>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">Stačí pár vět. Kancelář se vám ozve a řekne, jak postupovat dál. Odeslání vás k ničemu nezavazuje.</p>
                        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                            <input value={form.name} onChange={set('name')} required maxLength={120} placeholder="Jméno a příjmení" aria-label="Jméno a příjmení" className={field} autoComplete="name" />
                            <div className="grid gap-3 sm:grid-cols-2">
                                <input type="email" value={form.email} onChange={set('email')} maxLength={160} placeholder="E-mail" aria-label="E-mail" className={field} autoComplete="email" />
                                <input type="tel" value={form.phone} onChange={set('phone')} maxLength={40} placeholder="Telefon" aria-label="Telefon" className={field} autoComplete="tel" />
                            </div>
                            <textarea value={form.message} onChange={set('message')} required rows={6} maxLength={3000} placeholder="Co se stalo? Kdy? Jaké dokumenty máte? Hrozí nějaký termín?" aria-label="Popis věci" className={field} />
                            <input value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
                            {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
                            <button type="submit" disabled={busy || !form.name.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-800 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-900 disabled:opacity-60 cursor-pointer">{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Odeslat poptávku</button>
                        </form>
                        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500"><Lock size={14} className="mt-0.5 shrink-0 text-indigo-800" aria-hidden="true" />Údaje se odesílají šifrovaně a uvidí je jen kancelář. Nepište sem rodná čísla ani hesla.</p>
                    </>
                )}
            </div>
        </div>
    );
}
