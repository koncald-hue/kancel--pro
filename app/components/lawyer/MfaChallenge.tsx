'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { verifyCode } from '@/lib/mfa';
import { inputCls, primaryBtn } from '../situation/caseUi';

// Po zadání hesla: potvrzení kódem z ověřovací aplikace. Bez něj se pracovní prostor neotevře a databáze data nevydá.
export default function MfaChallenge({ factorId, email, onDone, onLogout }: { factorId: string; email: string; onDone: () => void; onLogout: () => void }) {
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    async function submit() {
        setBusy(true); setError('');
        try { await verifyCode(factorId, code); onDone(); }
        catch (e) { setError(e instanceof Error ? e.message : 'Ověření se nepodařilo.'); }
        finally { setBusy(false); }
    }
    return (
        <div className="mx-auto max-w-md px-4 py-16">
            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60">
                <ShieldCheck size={28} className="text-indigo-700" aria-hidden="true" />
                <h1 className="mt-3 text-2xl font-bold text-slate-900">Ověření přihlášení</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Zadejte šestimístný kód z ověřovací aplikace (Google Authenticator, Microsoft Authenticator, Authy a podobně) pro účet {email}.</p>
                <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="mt-5 space-y-3">
                    <label className="block text-sm font-semibold text-slate-800">Kód z aplikace
                        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="123456" className={`${inputCls} mt-1 w-44 text-lg tracking-[0.3em]`} />
                    </label>
                    {error && <p role="alert" className="rounded-lg bg-rose-50 p-2.5 text-sm text-rose-900">{error}</p>}
                    <div className="flex flex-wrap items-center gap-3">
                        <button type="submit" disabled={busy || code.length !== 6} className={primaryBtn}>{busy ? 'Ověřuji…' : 'Potvrdit'}</button>
                        <button type="button" onClick={onLogout} className="text-sm font-semibold text-slate-600 underline cursor-pointer">Odhlásit se</button>
                    </div>
                </form>
                <p className="mt-5 text-xs leading-relaxed text-slate-500">Nemáte telefon po ruce? Použijte druhé zařízení, které jste si u účtu zaregistrovali. Když přístup ke kódům ztratíte úplně, obraťte se na provozovatele, který vám druhý faktor po ověření totožnosti vypne.</p>
            </div>
        </div>
    );
}
