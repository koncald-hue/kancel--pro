'use client';

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { User as AuthUser } from '@supabase/supabase-js';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { endAllSessions } from '@/lib/isdsSession';
import AuthForm from './AuthForm';

// Přihlášení do aplikace pro právníky: jeden účet, přihlašování e-mailem a heslem
export type AuthInfo = {
    account: AuthUser | null;
    // Člen týmu provozovatele: vidí přehled uživatelů a spravuje platby
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
    const [formKey, setFormKey] = useState(0);

    useEffect(() => {
        const apply = (user: AuthUser | null) => {
            setAccount(user);
            if (!user) { setIsStaff(false); setAuthReady(true); return; }
            // Dotaz na databázi se nesmí volat přímo uvnitř oznámení o změně přihlášení
            setTimeout(() => {
                supabase.rpc('is_staff').then(({ data, error }) => { setIsStaff(error ? false : data === true); setAuthReady(true); });
            }, 0);
        };
        supabase.auth.getSession().then(({ data: { session } }) => {
            apply(session?.user ?? null);
            // Uložené přihlášení může patřit účtu, který už neexistuje (např. smazaný v Supabase): pak se odhlásí
            if (session) supabase.auth.getUser().then(({ error }) => { if (error) void supabase.auth.signOut(); });
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user ?? null));
        return () => subscription.unsubscribe();
    }, []);

    const openLogin = useCallback((m: 'login' | 'register' = 'login') => { setMode(m); setFormKey((k) => k + 1); setOpen(true); }, []);
    // Při odhlášení z Kanceláře se ukončí i relace v datových schránkách
    const logout = useCallback(() => {
        void (async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                await endAllSessions((env, value) => fetch('/api/isds', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ action: 'mk_end', env, session: value }) }));
            } catch { /* odhlášení se nesmí zdržet */ }
            await supabase.auth.signOut();
        })();
    }, []);

    return (
        <AuthContext.Provider value={{ account, isStaff, authReady, openLogin, logout }}>
            {children}
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between border-b pb-3">
                            <h2 className="text-lg font-bold text-slate-900">Kancelář: přihlášení</h2>
                            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700" aria-label="Zavřít okno"><X size={18} /></button>
                        </div>
                        <AuthForm key={formKey} initialMode={mode} onDone={() => setOpen(false)} idPrefix="modal" />
                    </div>
                </div>
            )}
        </AuthContext.Provider>
    );
}
