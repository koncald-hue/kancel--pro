'use client';

import { createContext, useContext, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Clock, Loader2, LogIn } from 'lucide-react';
import { useAuth } from '../site/AuthContext';
import { hasLawyerAccess, requestAccess, startTrial, TRIAL_DAYS, useLawyerAccess, type LawyerAccess } from '@/lib/lawyer';
import { primaryBtn, ghostBtn } from '../situation/caseUi';

const LawyerContext = createContext<{ access: LawyerAccess; userId: string } | null>(null);
export const useLawyer = () => { const ctx = useContext(LawyerContext); if (!ctx) throw new Error('useLawyer mimo LawyerGate'); return ctx; };

const Box = ({ children }: { children: React.ReactNode }) => <div className="mx-auto max-w-xl px-4 py-16 text-center">{children}</div>;

// Ochrana pracovního prostoru: přihlášení, zahájení zkušebního přístupu nebo žádost o placený přístup
export default function LawyerGate({ children, allowExpired = false }: { children: React.ReactNode; allowExpired?: boolean }) {
    const { account, authReady, openLogin, isStaff, logout } = useAuth();
    const [version, setVersion] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const state = useLawyerAccess(account?.id, version);

    if (!authReady || state.loading) return <p className="mx-auto max-w-4xl px-4 py-12 text-sm text-slate-500" role="status">Načítám…</p>;
    if (!account) {
        return (
            <Box>
                <Briefcase size={30} className="mx-auto text-indigo-800" aria-hidden="true" />
                <h1 className="mt-3 text-3xl font-bold text-slate-900">Kancelář</h1>
                <p className="mt-2 text-sm text-slate-600">Pracovní prostor pro advokáty a právníky. Přihlaste se nebo si vytvořte účet.</p>
                <button type="button" onClick={() => openLogin('login')} className={`${primaryBtn} mt-5`}><LogIn size={16} /> Přihlásit se</button>
                <p className="mt-4 text-xs"><Link href="/" className="font-semibold text-indigo-900 underline">Co kancelář obsahuje</Link></p>
            </Box>
        );
    }
    if (state.error === 'setup') return <Box><p className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">Kancelář ještě není v databázi zapnutá (chybí spuštění SQL lawyer.sql).</p></Box>;

    const access = state.access;
    if (isStaff && !hasLawyerAccess(access)) {
        // Člen týmu smí kancelář vyzkoušet bez zkušebního přístupu
        return <LawyerContext.Provider value={{ access: access ?? { user_id: account.id, email: account.email ?? '', status: 'active', until: null, firm_name: '', default_rate: 0 }, userId: account.id }}>{children}</LawyerContext.Provider>;
    }
    // Nastavení zůstává dostupné i po vypršení, aby šlo předplatné obnovit
    if (access && allowExpired) return <LawyerContext.Provider value={{ access, userId: account.id }}>{children}</LawyerContext.Provider>;
    if (access && hasLawyerAccess(access)) return <LawyerContext.Provider value={{ access, userId: account.id }}>{children}</LawyerContext.Provider>;

    async function act(kind: 'trial' | 'request') {
        setBusy(true); setError('');
        try {
            if (kind === 'trial') await startTrial(account!.id, account!.email ?? ''); else await requestAccess(account!.id, account!.email ?? '');
            setVersion((v) => v + 1);
        } catch (err) { setError(err instanceof Error ? err.message : 'Nepodařilo se.'); } finally { setBusy(false); }
    }

    return (
        <Box>
            <Briefcase size={30} className="mx-auto text-indigo-800" aria-hidden="true" />
            <h1 className="mt-3 text-3xl font-bold text-slate-900">Kancelář</h1>
            {access?.status === 'requested' ? (
                <p className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm leading-relaxed text-slate-700">Vaše žádost o přístup je přijata. Jakmile ji potvrdíme, kancelář se vám otevře. Stav uvidíte po obnovení stránky.</p>
            ) : (
                <>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{access ? 'Platnost vašeho přístupu skončila. Data zůstávají uložená a po obnovení předplatného je opět uvidíte.' : `Vyzkoušejte kancelář ${TRIAL_DAYS} dní zdarma, bez závazku.`}</p>
                    <div className="mt-5 flex flex-wrap justify-center gap-3">
                        {!access && <button type="button" onClick={() => void act('trial')} disabled={busy} className={primaryBtn}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />} Zahájit zkušební přístup</button>}
                        {access ? <Link href="/kancelar/nastaveni" className={primaryBtn}>Obnovit předplatné</Link> : <button type="button" onClick={() => void act('request')} disabled={busy} className={ghostBtn}>Požádat o plný přístup</button>}
                    </div>
                    {error && <p role="alert" className="mt-3 text-sm text-rose-800">{error}</p>}
                </>
            )}
            <p className="mt-5 text-xs"><Link href="/" className="font-semibold text-indigo-900 underline">Co kancelář obsahuje</Link></p>
            <p className="mt-3 text-xs text-slate-500">Přihlášen jako {account.email}. <button type="button" onClick={logout} className="font-semibold underline">Odhlásit se</button></p>
        </Box>
    );
}
