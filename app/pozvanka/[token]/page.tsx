import type { Metadata } from 'next';
import { Suspense } from 'react';
import AcceptInvite from '@/app/components/lawyer/AcceptInvite';

export const metadata: Metadata = { title: 'Pozvánka do kanceláře | Kancelář Pro', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default function Page() {
    return <Suspense fallback={<p className="p-10 text-center text-sm text-slate-500" role="status">Načítám…</p>}><AcceptInvite /></Suspense>;
}
