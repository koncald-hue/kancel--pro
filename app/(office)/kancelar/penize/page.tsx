import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import MoneyTabs from '@/app/components/lawyer/MoneyTabs';
import MoneyOverview from '@/app/components/lawyer/MoneyOverview';

export const metadata: Metadata = { title: 'Peníze | Kancelář', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="penize"><MoneyTabs current="penize" /><MoneyOverview /></LawyerShell>;
}
