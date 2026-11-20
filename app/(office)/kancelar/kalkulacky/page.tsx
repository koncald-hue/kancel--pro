import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import MoneyTabs from '@/app/components/lawyer/MoneyTabs';
import LawyerCalculators from '@/app/components/lawyer/LawyerCalculators';

export const metadata: Metadata = { title: 'Kalkulačky | Kancelář Pro', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="kalkulacky"><MoneyTabs current="kalkulacky" /><LawyerCalculators /></LawyerShell>;
}
