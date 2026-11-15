import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerSettings from '@/app/components/lawyer/LawyerSettings';

export const metadata: Metadata = {
    title: 'Kancelář | Kancelář',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="nastaveni" allowExpired><LawyerSettings /></LawyerShell>;
}
