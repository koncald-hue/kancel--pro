'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2 } from 'lucide-react';
import { useMasterKey } from '@/lib/useE2ee';
import { clearGooglePending, finishGoogleConnect, readGooglePending, syncGoogle } from '@/lib/googleSync';
import { primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

// Návrat z přihlášení ke Googlu: výměna kódu, vytvoření kalendáře, uložení zašifrovaného přihlášení a první synchronizace lhůt
export default function GoogleCallback() {
    const router = useRouter();
    const { userId } = useLawyer();
    const master = useMasterKey();
    const [state, setState] = useState<'working' | 'locked' | 'error' | 'done'>('working');
    const [error, setError] = useState('');
    const [msg, setMsg] = useState('');
    const started = useRef(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code') ?? '';
        const pending = readGooglePending();
        if (params.get('error') || !code || !pending || pending.state !== params.get('state')) {
            const t = window.setTimeout(() => { setError(params.get('error') ? 'Přihlášení ke Googlu bylo zrušeno.' : 'Přihlášení se nepodařilo dokončit (neplatný návrat). Zkuste se připojit znovu.'); setState('error'); }, 0);
            return () => window.clearTimeout(t);
        }
        if (!master) { const t = window.setTimeout(() => setState('locked'), 0); return () => window.clearTimeout(t); }
        if (started.current) return;
        started.current = true;
        (async () => {
            await finishGoogleConnect(master, userId, code, pending);
            clearGooglePending();
            try { const r = await syncGoogle(master, userId); setMsg(r.message); } catch { /* první synchronizaci jde zopakovat v Nastavení */ }
            setState('done');
            window.setTimeout(() => router.replace(pending.returnTo || '/kancelar/nastaveni'), 1600);
        })().catch((e) => { setError(e instanceof Error ? e.message : 'Nepodařilo se.'); setState('error'); });
    }, [master, userId, router]);

    return (
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
            {state === 'working' && <><Loader2 size={26} className="mx-auto animate-spin text-indigo-700" /><p className="mt-3 text-sm text-slate-600" role="status">Dokončuji připojení ke Google Kalendáři a zapisuji lhůty…</p></>}
            {state === 'locked' && <><KeyRound size={26} className="mx-auto text-indigo-700" aria-hidden="true" /><h1 className="mt-3 text-lg font-bold text-slate-900">Odemkněte šifrovací heslo</h1><p className="mt-2 text-sm text-slate-600">Přihlášení ke Googlu se ukládá zašifrované vaším šifrovacím heslem. Odemkněte ho v Nastavení a Google Kalendář pak připojte znovu.</p><a href="/kancelar/nastaveni" className={`${primaryBtn} mt-4`}>Otevřít Nastavení</a></>}
            {state === 'done' && <><p className="text-sm font-semibold text-emerald-800" role="status">Google Kalendář je připojený.</p>{msg && <p className="mt-1 text-xs text-slate-600">{msg}</p>}</>}
            {state === 'error' && <><p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p><button type="button" onClick={() => router.replace('/kancelar/nastaveni')} className={`${primaryBtn} mt-4`}>Zpět do Nastavení</button></>}
        </div>
    );
}
