import type { Metadata } from 'next';
import { Suspense } from 'react';
import ClientPortal from '@/app/components/portal/ClientPortal';

export const metadata: Metadata = {
    title: 'Vaše věc | Kancelář Pro',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
};

// Soukromá stránka klienta; token si komponenta přečte z adresy
export default function Page() {
    // Suspense: komponenta čte adresu stránky, kterou server předem nezná
    return <Suspense fallback={<p className="p-10 text-center text-sm text-slate-500" role="status">Načítám…</p>}><ClientPortal /></Suspense>;
}
