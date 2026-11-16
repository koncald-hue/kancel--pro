'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Stránka, na kterou vede odkaz z e-mailu „zapomenuté heslo“: nastavení nového hesla
export default function PasswordReset() {
    const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
    const [password, setPassword] = useState('');
    const [again, setAgain] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        // Odkaz z e-mailu přihlásí prohlížeč do dočasné relace; bez ní se heslo změnit nedá
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => { if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) setState((s) => (s === 'done' ? s : 'ready')); });
        supabase.auth.getSession().then(({ data: { session } }) => { if (session) setState((s) => (s === 'checking' ? 'ready' : s)); });
        const t = window.setTimeout(() => setState((s) => (s === 'checking' ? 'invalid' : s)), 4000);
        return () => { subscription.unsubscribe(); window.clearTimeout(t); };
    }, []);

    async function save(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (password.length < 10) { setError('Heslo musí mít alespoň 10 znaků.'); return; }
        if (password !== again) { setError('Hesla se neshodují.'); return; }
        setBusy(true);
        const { error: err } = await supabase.auth.updateUser({ password });
        setBusy(false);
        if (err) { setError(/same|different/i.test(err.message) ? 'Nové heslo musí být jiné než dosavadní.' : 'Heslo se nepodařilo změnit: ' + err.message); return; }
        setState('done');
    }

    return (
        <div className="mx-auto max-w-md px-4 py-20">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
                <span className="inline-flex rounded-xl bg-indigo-600 p-3 text-white"><KeyRound size={22} aria-hidden="true" /></span>
                <h1 className="mt-4 text-2xl font-bold text-slate-900">Nové heslo</h1>
                {state === 'checking' && <p className="mt-3 text-sm text-slate-500" role="status">Ověřuji odkaz…</p>}
                {state === 'invalid' && (
                    <>
                        <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">Odkaz je neplatný nebo už vypršel. Požádejte o nový na přihlašovací stránce (Zapomenuté heslo).</p>
                        <Link href="/kancelar" className="mt-5 inline-flex rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-800">Na přihlášení</Link>
                    </>
                )}
                {state === 'ready' && (
                    <form onSubmit={save} className="mt-4 space-y-4">
                        <p className="text-sm text-slate-600">Zvolte si nové heslo (alespoň 10 znaků).</p>
                        <div><label htmlFor="new-password" className="mb-1 block text-sm font-semibold text-slate-800">Nové heslo</label><input id="new-password" type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200" /></div>
                        <div><label htmlFor="new-password2" className="mb-1 block text-sm font-semibold text-slate-800">Heslo znovu</label><input id="new-password2" type="password" required autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200" /></div>
                        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
                        <button type="submit" disabled={busy} className="w-full rounded-xl bg-indigo-700 py-3 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-60">{busy ? 'Ukládám…' : 'Nastavit nové heslo'}</button>
                        <p className="text-xs leading-relaxed text-slate-500">Toto je heslo k účtu. Šifrovací heslo k zprávám a souborům je jiné a touto cestou se neobnovuje (k tomu slouží záchranný kód).</p>
                    </form>
                )}
                {state === 'done' && (
                    <>
                        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 size={18} /> Heslo je změněné.</p>
                        <Link href="/kancelar" className="mt-5 inline-flex rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-800">Pokračovat do Kanceláře</Link>
                    </>
                )}
            </div>
        </div>
    );
}
