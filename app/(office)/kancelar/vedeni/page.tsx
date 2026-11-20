import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import MoneyTabs from '@/app/components/lawyer/MoneyTabs';
import LawyerManagement from '@/app/components/lawyer/LawyerManagement';

export const metadata: Metadata = {
    title: 'Přehled pro vedení | Kancelář Pro',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="penize"><MoneyTabs current="vedeni" /><LawyerManagement /></LawyerShell>;
}
