import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import MoneyTabs from '@/app/components/lawyer/MoneyTabs';
import LawyerEscrow from '@/app/components/lawyer/LawyerEscrow';

export const metadata: Metadata = {
    title: 'Úschovy | Kancelář',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="penize"><MoneyTabs current="uschovy" /><LawyerEscrow /></LawyerShell>;
}
