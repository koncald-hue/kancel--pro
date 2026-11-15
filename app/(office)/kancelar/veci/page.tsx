import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerCases from '@/app/components/lawyer/LawyerCases';

export const metadata: Metadata = {
    title: 'Kancelář | Kancelář',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="veci"><LawyerCases /></LawyerShell>;
}
