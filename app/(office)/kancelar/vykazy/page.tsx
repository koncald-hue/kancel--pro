import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerTimesheet from '@/app/components/lawyer/LawyerTimesheet';

export const metadata: Metadata = {
    title: 'Kancelář | Kancelář',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="vykazy"><LawyerTimesheet /></LawyerShell>;
}
