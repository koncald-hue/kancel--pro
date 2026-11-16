'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Loader2, ShieldCheck } from 'lucide-react';

// Žádost advokáta o ověření totožnosti klienta (identifikace podle zákona č. 253/2008 Sb.)
export default function PortalAml({ token }: { token: string }) {
    const [state, setState] = useState<{ request: { id: string; status: string } | null; bankid: boolean; idp?: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        let alive = true;
        fetch(`/api/portal/${token}/aml`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive) setState(j); }).catch(() => undefined);
        return () => { alive = false; };
    }, [token]);
    if (!state?.request) return null;
    const done = state.request.status !== 'requested';
    async function start() {
        setBusy(true); setError('');
        try {
            const res = await fetch(`/api/portal/${token}/aml`, { method: 'POST' });
            const out = await res.json().catch(() => ({})) as { url?: string };
            if (!res.ok || !out.url) throw new Error('Ověření se nepodařilo zahájit. Napište advokátovi.');
            window.location.href = out.url;
        } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se.'); setBusy(false); }
    }
    return (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5" aria-label="Ověření totožnosti">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ShieldCheck size={18} className="text-indigo-800" aria-hidden="true" /> Ověření totožnosti</h2>
            {done ? <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-900"><BadgeCheck size={16} aria-hidden="true" /> Vaše totožnost je ověřená. Děkujeme.</p> : (
                <>
                    <p className="mt-2 text-sm text-slate-700">Advokát je podle zákona povinen před zahájením některých činností ověřit totožnost klienta. Stačí se přihlásit svou bankovní identitou ({state.idp ?? 'Bank iD'}), nic dalšího nenahráváte. Advokát uvidí jen své údaje: jméno, datum narození a adresu.</p>
                    {state.bankid ? <button type="button" onClick={start} disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-900 disabled:opacity-60 cursor-pointer">{busy && <Loader2 size={15} className="animate-spin" />} Ověřit totožnost online</button> : <p className="mt-3 text-sm text-amber-900">Online ověření zatím není zapnuté. Advokát vás ověří osobně.</p>}
                </>
            )}
            {error && <p role="alert" className="mt-2 text-sm text-rose-900">{error}</p>}
        </section>
    );
}
