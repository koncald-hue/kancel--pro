import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerInvoices from '@/app/components/lawyer/LawyerInvoices';

export const metadata: Metadata = { title: 'Fakturace | Kancelář', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="faktury"><LawyerInvoices /></LawyerShell>;
}
