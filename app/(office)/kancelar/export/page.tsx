import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import MoneyTabs from '@/app/components/lawyer/MoneyTabs';
import DataExport from '@/app/components/lawyer/DataExport';
import AccountantExport from '@/app/components/lawyer/AccountantExport';

export const metadata: Metadata = { title: 'Export pro účetní | Kancelář Pro', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="export"><MoneyTabs current="export" /><AccountantExport /><DataExport /></LawyerShell>;
}
