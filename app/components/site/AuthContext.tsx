'use client';

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { User as AuthUser } from '@supabase/supabase-js';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Přihlášení do aplikace pro právníky: jeden účet, přihlašování e-mailem a heslem
export type AuthInfo = {
    account: AuthUser | null;
    // Člen týmu provozovatele: smí ověřovat advokáty a spravovat platby
    isStaff: boolean;
    // false, dokud se po načtení stránky nezjistí, jestli je někdo přihlášený
    authReady: boolean;
    openLogin: (mode?: 'login' | 'register') => void;
    logout: () => void;
};

const AuthContext = createContext<AuthInfo>({ account: null, isStaff: false, authReady: false, openLogin: () => {}, logout: () => {} });

const subscribeNever = () => () => {};
const LOGGED_OUT = { account: null, isStaff: false, authReady: false };

export function useAuth(): AuthInfo {
    const auth = useContext(AuthContext);
    // Při prvním vykreslení v prohlížeči se musí vrátit totéž co na serveru, jinak by se stránka lišila od HTML ze serveru
    const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
    return hydrated ? auth : { ...auth, ...LOGGED_OUT };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [account, setAccount] = useState<AuthUser | null>(null);
    const [isStaff, setIsStaff] = useState(false);
    const [authReady, setAuthReady] = useState(false);
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [notice, setNotice] = useState('');

    useEffect(() => {
        const apply = (user: AuthUser | null) => {
            setAccount(user);
            if (!user) { setIsStaff(false); setAuthReady(true); return; }
            // Dotaz na databázi se nesmí volat přímo uvnitř oznámení o změně přihlášení
            setTimeout(() => {
                supabase.rpc('is_staff').then(({ data, error }) => { setIsStaff(error ? false : data === true); setAuthReady(true); });
            }, 0);
        };
        supabase.auth.getSession().then(({ data: { session } }) => apply(session?.user ?? null));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user ?? null));
        return () => subscription.unsubscribe();
    }, []);

    const openLogin = useCallback((m: 'login' | 'register' = 'login') => { setMode(m); setNotice(''); setOpen(true); }, []);
    const logout = useCallback(() => { void supabase.auth.signOut(); }, []);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setNotice('');
        if (mode === 'register') {
            if (password.length < 10) { setNotice('Heslo musí mít alespoň 10 znaků.'); return; }
            const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/kancelar` } });
            if (error) { setNotice('Registrace se nepodařila: ' + error.message); return; }
            setPassword('');
            if (data.session) { setOpen(false); setEmail(''); } else { setMode('login'); setNotice('Účet je vytvořený. Poslali jsme vám e-mail s potvrzovacím odkazem, po potvrzení se přihlaste.'); }
            return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setNotice('Přihlášení se nepodařilo. Zkontrolujte e-mail a heslo.'); return; }
        setOpen(false); setEmail(''); setPassword('');
    }

    const isRegister = mode === 'register';
    return (
        <AuthContext.Provider value={{ account, isStaff, authReady, openLogin, logout }}>
            {children}
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between border-b pb-3">
                            <h2 className="text-lg font-bold text-slate-900">{isRegister ? 'Vytvoření účtu' : 'Přihlášení'}</h2>
                            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700" aria-label="Zavřít okno"><X size={18} /></button>
                        </div>
                        {notice && <p className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs leading-relaxed text-indigo-950" role="status">{notice}</p>}
                        <form onSubmit={submit} className="space-y-4">
                            <div>
                                <label htmlFor="login-email" className="mb-1 block text-xs font-semibold text-slate-800">E-mail</label>
                                <input id="login-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label htmlFor="login-password" className="mb-1 block text-xs font-semibold text-slate-800">Heslo{isRegister ? ' (alespoň 10 znaků)' : ''}</label>
                                <input id="login-password" type="password" required minLength={isRegister ? 10 : undefined} autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                            </div>
                            <button type="submit" className="w-full rounded-xl bg-indigo-700 py-2.5 text-xs font-medium text-white hover:bg-indigo-800">{isRegister ? 'Vytvořit účet' : 'Přihlásit se'}</button>
                        </form>
                        <p className="mt-4 text-center text-xs text-slate-600">
                            {isRegister ? 'Už účet máte?' : 'Ještě nemáte účet?'}{' '}
                            <button type="button" onClick={() => setMode(isRegister ? 'login' : 'register')} className="font-semibold text-indigo-700 hover:underline">{isRegister ? 'Přihlásit se' : 'Zaregistrovat se'}</button>
                        </p>
                    </div>
                </div>
            )}
        </AuthContext.Provider>
    );
}
