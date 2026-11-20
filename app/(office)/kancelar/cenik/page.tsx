import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import MoneyTabs from '@/app/components/lawyer/MoneyTabs';
import LawyerPriceList from '@/app/components/lawyer/LawyerPriceList';

export const metadata: Metadata = { title: 'Ceník | Kancelář Pro', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="cenik"><MoneyTabs current="cenik" /><LawyerPriceList /></LawyerShell>;
}
