'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TERMS_VERSION } from '@/lib/company';
import { isBlockedRelayEmail, BLOCKED_EMAIL_MESSAGE } from '@/lib/emailGuard';

// Přihlášení a registrace e-mailem a heslem. Používá se v okně i přímo na stránce.
export default function AuthForm({ initialMode = 'login', onDone, idPrefix = 'auth' }: { initialMode?: 'login' | 'register'; onDone?: () => void; idPrefix?: string }) {
    const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [agree, setAgree] = useState(false);
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const isRegister = mode === 'register';

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setNotice('');
        setBusy(true);
        try {
            if (mode === 'forgot') {
                const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/obnova-hesla` });
                // Odpověď je stejná, ať účet existuje, nebo ne
                setNotice(error && /rate|limit/i.test(error.message) ? 'Zkuste to prosím za chvíli, žádostí bylo příliš mnoho.' : 'Pokud k tomuto e-mailu existuje účet, poslali jsme na něj odkaz pro nastavení nového hesla.');
                return;
            }
            if (isRegister) {
                if (password.length < 10) { setNotice('Heslo musí mít alespoň 10 znaků.'); return; }
                if (isBlockedRelayEmail(email)) { setNotice(BLOCKED_EMAIL_MESSAGE); return; }
                if (!agree) { setNotice('Pro vytvoření účtu je nutné souhlasit s obchodními podmínkami.'); return; }
                const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.pathname.startsWith('/pozvanka/') ? window.location.href : `${window.location.origin}/kancelar`, data: { terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString(), professional_use: true } } });
                if (error) { setNotice('Registrace se nepodařila: ' + error.message); return; }
                setPassword('');
                if (data.session) { onDone?.(); } else { setMode('login'); setNotice('Účet je vytvořený. Poslali jsme vám e-mail s potvrzovacím odkazem, po potvrzení se přihlaste.'); }
                return;
            }
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) { setNotice('Přihlášení se nepodařilo. Zkontrolujte e-mail a heslo.'); return; }
            setPassword('');
            onDone?.();
        } finally { setBusy(false); }
    }

    return (
        <div>
            {notice && <p className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm leading-relaxed text-indigo-950" role="status">{notice}</p>}
            <form onSubmit={submit} className="space-y-4">
                <div>
                    <label htmlFor={`${idPrefix}-email`} className="mb-1 block text-sm font-semibold text-slate-800">E-mail</label>
                    <input id={`${idPrefix}-email`} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                </div>
                {mode !== 'forgot' && <div>
                    <label htmlFor={`${idPrefix}-password`} className="mb-1 block text-sm font-semibold text-slate-800">Heslo{isRegister ? ' (alespoň 10 znaků)' : ''}</label>
                    <input id={`${idPrefix}-password`} type="password" required minLength={isRegister ? 10 : undefined} autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                </div>}
                {isRegister && (
                    <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-slate-700">
                        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-700" />
                        <span>Jednám v rámci své podnikatelské činnosti nebo výkonu povolání a souhlasím s <a href="/obchodni-podminky" target="_blank" rel="noreferrer" className="font-semibold text-indigo-700 underline">obchodními podmínkami</a> a <a href="/zpracovani-osobnich-udaju" target="_blank" rel="noreferrer" className="font-semibold text-indigo-700 underline">smlouvou o zpracování osobních údajů</a>. Zásady ochrany soukromí najdete <a href="/ochrana-osobnich-udaju" target="_blank" rel="noreferrer" className="font-semibold text-indigo-700 underline">zde</a>.</span>
                    </label>
                )}
                <button type="submit" disabled={busy} className="w-full rounded-xl bg-indigo-700 py-3 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-60">{busy ? 'Chvíli strpení…' : isRegister ? 'Vytvořit účet' : mode === 'forgot' ? 'Poslat odkaz pro nové heslo' : 'Přihlásit se'}</button>
            </form>
            {mode === 'login' && <p className="mt-3 text-center text-sm"><button type="button" onClick={() => { setMode('forgot'); setNotice(''); }} className="font-semibold text-slate-600 underline hover:text-slate-900">Zapomenuté heslo?</button></p>}
            {mode === 'forgot' && <p className="mt-3 text-center text-sm text-slate-600">Zadejte e-mail k účtu a pošleme vám odkaz.</p>}
            <p className="mt-5 text-center text-sm text-slate-600">
                {mode === 'forgot' ? <button type="button" onClick={() => { setMode('login'); setNotice(''); }} className="font-semibold text-indigo-700 hover:underline">← Zpět na přihlášení</button> : <>{isRegister ? 'Už účet máte?' : 'Ještě nemáte účet?'}{' '}
                <button type="button" onClick={() => { setMode(isRegister ? 'login' : 'register'); setNotice(''); }} className="font-semibold text-indigo-700 hover:underline">{isRegister ? 'Přihlásit se' : 'Zaregistrovat se, 14 dní zdarma'}</button></>}
            </p>
        </div>
    );
}
