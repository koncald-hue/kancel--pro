import type { Metadata } from 'next';
import { Suspense } from 'react';
import IntakeForm from '@/app/components/portal/IntakeForm';

export const metadata: Metadata = {
    title: 'Poptávka | Kancelář',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
};

export default function Page() {
    // Suspense: komponenta čte adresu stránky, kterou server předem nezná
    return <Suspense fallback={<p className="p-10 text-center text-sm text-slate-500" role="status">Načítám…</p>}><IntakeForm /></Suspense>;
}
