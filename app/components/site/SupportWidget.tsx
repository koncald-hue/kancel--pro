'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { CheckCircle2, MessageCircle, X } from 'lucide-react';
import { useAuth } from './AuthContext';

// Plovoucí „Napište nám“: zpráva jde e-mailem provozovateli, odpověď přijde na zadaný e-mail.
// Nezobrazuje se v aplikaci (tam je „Nahlásit problém“) ani na stránkách pro klienty advokátů.
const HIDDEN = ['/kancelar', '/klient', '/poptavka', '/pozvanka', '/admin', '/doplnek', '/offline'];
export default function SupportWidget() {
    const { account } = useAuth();
    const path = usePathname();
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [website, setWebsite] = useState('');
    const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
    const [error, setError] = useState('');
    const mail = email || account?.email || '';

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setState('busy'); setError('');
        const res = await fetch('/api/support', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: mail, name, message, page: path, website }) }).catch(() => null);
        const body = await res?.json().catch(() => null) as { error?: string } | null;
        if (!res?.ok) { setState('idle'); setError(body?.error ?? 'Zprávu se nepodařilo odeslat. Zkuste to prosím znovu.'); return; }
        setState('sent'); setMessage('');
    };
    const close = () => { setOpen(false); setState('idle'); setError(''); };
    const input = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal';

    if (HIDDEN.some((h) => path === h || path?.startsWith(`${h}/`))) return null;
    return (
        <>
            <button type="button" onClick={() => setOpen(true)} aria-label="Napište nám" className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-full bg-indigo-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition-transform hover:scale-105 cursor-pointer print:hidden">
                <MessageCircle size={18} /> <span className="hidden sm:inline">Napište nám</span>
            </button>
            {open && (
                <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="support-title" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
                    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 id="support-title" className="text-xl font-bold text-slate-900">Napište nám</h2>
                                <p className="mt-1 text-sm text-slate-600">Dotaz k aplikaci, předplatnému nebo převodu dat. Odpovídám osobně, obvykle do jednoho pracovního dne.</p>
                            </div>
                            <button type="button" onClick={close} aria-label="Zavřít" className="cursor-pointer rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
                        </div>
                        {state === 'sent' ? (
                            <p className="mt-5 flex items-start gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900" role="status"><CheckCircle2 size={18} className="mt-0.5 shrink-0" /> Děkujeme, zprávu máme. Odpověď pošleme na {mail}.</p>
                        ) : (
                            <form onSubmit={submit} className="mt-4 space-y-3">
                                <label className="block text-xs font-semibold text-slate-600">Jméno (nepovinné)<input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={input} autoComplete="name" /></label>
                                <label className="block text-xs font-semibold text-slate-600">E-mail pro odpověď<input type="email" required value={mail} onChange={(e) => setEmail(e.target.value)} className={input} autoComplete="email" /></label>
                                <label className="block text-xs font-semibold text-slate-600">Zpráva<textarea required minLength={5} maxLength={3000} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className={input} /></label>
                                <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" />
                                {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
                                <button type="submit" disabled={state === 'busy'} className="w-full cursor-pointer rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-60">{state === 'busy' ? 'Odesílám…' : 'Odeslat'}</button>
                                <p className="text-xs text-slate-500">E-mail použijeme jen k odpovědi. <a href="/ochrana-osobnich-udaju" className="underline">Ochrana osobních údajů</a></p>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
