'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { loadClientInsolvency, type ClientIns } from '@/lib/clientInsolvency';
import { safeUrl } from '@/lib/safeUrl';

// Upozornění ve věci: klient této věci je podle hlídání insolvenčního rejstříku v insolvenci
export default function ClientInsolvencyBanner({ clientId }: { clientId: string }) {
    const [ins, setIns] = useState<ClientIns | null>(null);
    useEffect(() => {
        let alive = true;
        loadClientInsolvency().then((list) => { if (alive) setIns((list ?? []).find((c) => c.client_id === clientId && c.active_count > 0) ?? null); });
        return () => { alive = false; };
    }, [clientId]);
    if (!ins) return null;
    return (
        <p role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-semibold text-rose-950">
            <ShieldAlert size={16} aria-hidden="true" /> Klient této věci je v insolvenci{ins.state ? ` (${ins.state}${ins.spis ? `, ${ins.spis}` : ''})` : ''}. Zvažte lhůtu pro přihlášku pohledávky.
            {safeUrl(ins.url) && <a href={safeUrl(ins.url)} target="_blank" rel="noreferrer noopener" className="font-bold underline">Otevřít v rejstříku</a>}
            <Link href="/kancelar/insolvence" className="underline">Hlídání insolvence</Link>
        </p>
    );
}
