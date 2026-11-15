import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerTeam from '@/app/components/lawyer/LawyerTeam';

export const metadata: Metadata = { title: 'Tým | Kancelář', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="tym"><LawyerTeam /></LawyerShell>;
}
