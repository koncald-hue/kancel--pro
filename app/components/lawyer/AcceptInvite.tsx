'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckCircle2, Loader2, Scale } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '../site/AuthContext';
import { primaryBtn } from '../situation/caseUi';

// Přijetí pozvánky do kanceláře. Kód je v adrese; přijmout ji lze jen pod účtem se stejným e-mailem.
export default function AcceptInvite() {
    const token = (usePathname().split('/').filter(Boolean).pop() ?? '').replace(/[^a-z0-9]/gi, '');
    const { account, authReady, openLogin } = useAuth();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [firm, setFirm] = useState('');

    async function accept() {
        setBusy(true); setError('');
        const { data, error: err } = await supabase.rpc('accept_firm_invite', { p_token: token });
        setBusy(false);
        if (err) { setError(err.message); return; }
        setFirm(String(data));
    }

    return (
        <div className="mx-auto max-w-md px-4 py-20 text-center">
            <span className="mx-auto inline-flex rounded-xl bg-indigo-600 p-3 text-white"><Scale size={22} aria-hidden="true" /></span>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">Pozvánka do kanceláře</h1>
            {firm ? (
                <>
                    <p className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 size={18} /> Jste členem kanceláře {firm}.</p>
                    <p className="mt-2 text-sm text-slate-600">Vaše věci, klienty a zprávy vidíte jen vy. Před použitím aplikace ještě vyplňte svůj profil.</p>
                    <Link href="/kancelar" className={`${primaryBtn} mt-6 inline-flex`}>Otevřít kancelář</Link>
                </>
            ) : !authReady ? (
                <p className="mt-4 text-sm text-slate-500" role="status">Načítám…</p>
            ) : !account ? (
                <>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">Přihlaste se, nebo si vytvořte účet <strong>e-mailem, na který pozvánka přišla</strong>. Pak se sem vraťte přes stejný odkaz a pozvánku přijměte.</p>
                    <div className="mt-6 flex justify-center gap-3">
                        <button type="button" onClick={() => openLogin('register')} className={primaryBtn}>Vytvořit účet</button>
                        <button type="button" onClick={() => openLogin('login')} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">Přihlásit se</button>
                    </div>
                </>
            ) : (
                <>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">Přihlášen jako <strong>{account.email}</strong>. Po přijetí budete členem kanceláře a získáte přístup z jejího balíčku. Vedoucí kanceláře neuvidí vaše věci ani klienty.</p>
                    {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
                    <button type="button" onClick={() => void accept()} disabled={busy} className={`${primaryBtn} mt-6`}>{busy ? <Loader2 size={16} className="animate-spin" /> : null} Přijmout pozvánku</button>
                </>
            )}
        </div>
    );
}
