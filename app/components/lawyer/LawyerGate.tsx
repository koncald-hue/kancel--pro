'use client';

import { createContext, useContext, useState } from 'react';
import Link from 'next/link';
import { Briefcase, CalendarClock, Clock, Loader2, MessagesSquare, ShieldCheck } from 'lucide-react';
import { useAuth } from '../site/AuthContext';
import { hasLawyerAccess, requestAccess, startTrial, TRIAL_DAYS, useLawyerAccess, type LawyerAccess } from '@/lib/lawyer';
import { primaryBtn, ghostBtn } from '../situation/caseUi';
import Onboarding from './Onboarding';
import { onboardingComplete } from '@/lib/onboarding';
import AuthForm from '../site/AuthForm';
import MfaChallenge from './MfaChallenge';
import { useMfaState } from '@/lib/mfa';
import { LogoSvg } from '@/lib/logo';

const LawyerContext = createContext<{ access: LawyerAccess; userId: string; locked?: boolean } | null>(null);
export const useLawyer = () => { const ctx = useContext(LawyerContext); if (!ctx) throw new Error('useLawyer mimo LawyerGate'); return ctx; };

const Box = ({ children }: { children: React.ReactNode }) => <div className="mx-auto max-w-xl px-4 py-16 text-center">{children}</div>;

// Ochrana pracovního prostoru: přihlášení, zahájení zkušebního přístupu nebo žádost o placený přístup
export default function LawyerGate({ children, allowExpired = false }: { children: React.ReactNode; allowExpired?: boolean }) {
    const { account, authReady, isStaff, logout } = useAuth();
    const [version, setVersion] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const state = useLawyerAccess(account?.id, version);
    const [mfaVersion, setMfaVersion] = useState(0);
    const mfa = useMfaState(account?.id, mfaVersion);

    if (!authReady || state.loading || (account && mfa.loading)) return <p className="mx-auto max-w-4xl px-4 py-12 text-sm text-slate-500" role="status">Načítám…</p>;
    if (!account) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
                <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
                    <Link href="/" className="flex items-center gap-2.5 font-bold text-slate-900"><LogoSvg size={32} radius={8} /> Kancelář Pro</Link>
                    <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-900">← Zpět na úvodní stránku</Link>
                </header>
                <main className="mx-auto grid max-w-5xl items-center gap-10 px-4 pb-16 pt-6 sm:px-6 md:grid-cols-2 md:pt-14">
                    <div>
                        <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">Vítejte v Kanceláři</h1>
                        <p className="mt-3 text-base leading-relaxed text-slate-600">Přihlaste se do svého pracovního prostoru, nebo si založte účet a vyzkoušejte ho 14 dní zdarma.</p>
                        <ul className="mt-7 space-y-4 text-sm text-slate-700">
                            {([[CalendarClock, 'Lhůty a spisy', 'Hlídání lhůt, spisů, klientů, výkazy a vyúčtování na jednom místě.'], [MessagesSquare, 'Šifrovaný chat kanceláře', 'Zprávy, soubory i celé spisy mezi kolegy, čitelné jen pro vás.'], [ShieldCheck, 'Vaše data jsou jen vaše', 'Každý advokát vidí jen svá data, ani provozovatel je nepřečte.']] as const).map(([Icon, title, text]) => (
                                <li key={title} className="flex gap-3"><span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><Icon size={18} aria-hidden="true" /></span><span><strong className="block text-slate-900">{title}</strong>{text}</span></li>
                            ))}
                        </ul>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
                        <h2 className="text-xl font-bold text-slate-900">Přihlášení</h2>
                        <p className="mb-5 mt-1 text-sm text-slate-500">Zadejte e-mail a heslo ke svému účtu.</p>
                        <AuthForm idPrefix="gate" />
                    </div>
                </main>
            </div>
        );
    }
    // Druhý faktor zapnutý, ale v této relaci ještě nepotvrzený: nic dalšího se neotevře
    if (mfa.needed) return <MfaChallenge factorId={mfa.factorId} email={account.email ?? ''} onDone={() => { setMfaVersion((v) => v + 1); setVersion((v) => v + 1); }} onLogout={logout} />;
    if (state.error === 'setup') return <Box><p className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">Kancelář ještě není v databázi zapnutá (chybí spuštění SQL lawyer.sql).</p></Box>;

    const access = state.access;
    if (isStaff && !hasLawyerAccess(access)) {
        // Člen týmu smí kancelář vyzkoušet bez zkušebního přístupu
        return <LawyerContext.Provider value={{ access: access ?? { user_id: account.id, email: account.email ?? '', status: 'active', until: null, firm_name: '', default_rate: 0 }, userId: account.id }}>{children}</LawyerContext.Provider>;
    }
    // První krok: dokud advokát nevyplní profil, údaje kanceláře a nenastaví šifrování, nic jiného se neotevře (platí i po koupi balíčku)
    if (access && !isStaff && hasLawyerAccess(access) && !onboardingComplete(access)) return <Onboarding access={access} onChanged={() => setVersion((v) => v + 1)} />;
    // Skončené nebo zrušené předplatné: data zůstávají ke čtení, funkce jsou zamčené (zápisy odmítá databáze)
    if (access && !isStaff && access.status !== 'requested' && !hasLawyerAccess(access)) return <LawyerContext.Provider value={{ access, userId: account.id, locked: true }}>{children}</LawyerContext.Provider>;
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
            <h1 className="mt-3 text-3xl font-bold text-slate-900">Kancelář Pro</h1>
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
