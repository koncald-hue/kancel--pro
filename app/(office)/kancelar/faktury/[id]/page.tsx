import type { Metadata } from 'next';
import { Suspense } from 'react';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerInvoiceEditor from '@/app/components/lawyer/LawyerInvoiceEditor';

export const metadata: Metadata = { title: 'Vyúčtování | Kancelář Pro', robots: { index: false } };

export default function Page() {
    // Suspense: komponenta čte adresu stránky, kterou server předem nezná
    return <LawyerShell active="faktury"><Suspense fallback={<p className="text-sm text-slate-500" role="status">Načítám…</p>}><LawyerInvoiceEditor /></Suspense></LawyerShell>;
}
