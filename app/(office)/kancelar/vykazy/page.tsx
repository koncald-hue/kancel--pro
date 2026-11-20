import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import MoneyTabs from '@/app/components/lawyer/MoneyTabs';
import LawyerTimesheet from '@/app/components/lawyer/LawyerTimesheet';

export const metadata: Metadata = {
    title: 'Kancelář | Kancelář Pro',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="vykazy"><MoneyTabs current="vykazy" /><LawyerTimesheet /></LawyerShell>;
}
