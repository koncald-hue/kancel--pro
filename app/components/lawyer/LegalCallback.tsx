'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2 } from 'lucide-react';
import { useMasterKey } from '@/lib/useE2ee';
import { clearPending, finishConnect, readPending } from '@/lib/legalClient';
import { primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

// Návrat z přihlášení k DirectCase: výměna kódu za token a uložení zašifrovaného tokenu
export default function LegalCallback() {
    const router = useRouter();
    const { userId } = useLawyer();
    const master = useMasterKey();
    const [state, setState] = useState<'working' | 'locked' | 'error' | 'done'>('working');
    const [error, setError] = useState('');
    const started = useRef(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code') ?? '';
        const pending = readPending();
        const denied = params.get('error');
        if (denied || !code || !pending || pending.state !== params.get('state')) {
            const t = window.setTimeout(() => { setError(denied ? 'Přihlášení k DirectCase bylo zrušeno.' : 'Přihlášení se nepodařilo dokončit (neplatný návrat). Zkuste se připojit znovu.'); setState('error'); }, 0);
            return () => window.clearTimeout(t);
        }
        if (!master) { const t = window.setTimeout(() => setState('locked'), 0); return () => window.clearTimeout(t); }
        if (started.current) return;
        started.current = true;
        finishConnect(master, userId, code, pending)
            .then(() => { clearPending(); setState('done'); window.setTimeout(() => router.replace(pending.returnTo || '/kancelar/veci'), 800); })
            .catch((e) => { setError(e instanceof Error ? e.message : 'Nepodařilo se.'); setState('error'); });
    }, [master, userId, router]);

    return (
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
            {state === 'working' && <><Loader2 size={26} className="mx-auto animate-spin text-indigo-700" /><p className="mt-3 text-sm text-slate-600" role="status">Dokončuji připojení k právní databázi…</p></>}
            {state === 'locked' && <><KeyRound size={26} className="mx-auto text-indigo-700" aria-hidden="true" /><h1 className="mt-3 text-lg font-bold text-slate-900">Odemkněte šifrovací heslo</h1><p className="mt-2 text-sm text-slate-600">Přihlášení k DirectCase se ukládá zašifrované vaším šifrovacím heslem. Odemkněte ho v Nastavení a pak se k DirectCase připojte znovu ze záložky Rešerše ve spisu.</p><a href="/kancelar/nastaveni" className={`${primaryBtn} mt-4`}>Otevřít Nastavení</a></>}
            {state === 'done' && <p className="text-sm font-semibold text-emerald-800" role="status">Připojeno. Vracím vás zpět…</p>}
            {state === 'error' && <><p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p><button type="button" onClick={() => router.replace('/kancelar/veci')} className={`${primaryBtn} mt-4`}>Zpět na spisu</button></>}
        </div>
    );
}
