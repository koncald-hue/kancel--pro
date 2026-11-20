import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import MoneyTabs from '@/app/components/lawyer/MoneyTabs';
import LawyerPayments from '@/app/components/lawyer/LawyerPayments';

export const metadata: Metadata = { title: 'Platby | Kancelář Pro', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="platby"><MoneyTabs current="platby" /><LawyerPayments /></LawyerShell>;
}
