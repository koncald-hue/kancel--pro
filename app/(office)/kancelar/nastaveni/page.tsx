import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerSettings from '@/app/components/lawyer/LawyerSettings';
import MyInvoices from '@/app/components/lawyer/MyInvoices';

export const metadata: Metadata = {
    title: 'Kancelář | Kancelář Pro',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="nastaveni" allowExpired><LawyerSettings /><MyInvoices /></LawyerShell>;
}
