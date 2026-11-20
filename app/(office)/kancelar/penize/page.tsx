import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import MoneyTabs from '@/app/components/lawyer/MoneyTabs';
import BankAutoSync from '@/app/components/lawyer/BankAutoSync';
import MoneyOverview from '@/app/components/lawyer/MoneyOverview';

export const metadata: Metadata = { title: 'Peníze | Kancelář Pro', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="penize"><MoneyTabs current="penize" /><BankAutoSync /><MoneyOverview /></LawyerShell>;
}
