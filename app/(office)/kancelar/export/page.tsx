import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import MoneyTabs from '@/app/components/lawyer/MoneyTabs';
import AccountantExport from '@/app/components/lawyer/AccountantExport';

export const metadata: Metadata = { title: 'Export pro účetní | Kancelář', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="export"><MoneyTabs current="export" /><AccountantExport /></LawyerShell>;
}
