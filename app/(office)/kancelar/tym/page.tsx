import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerTeam from '@/app/components/lawyer/LawyerTeam';
import TeamOverview from '@/app/components/lawyer/TeamOverview';
import FirmBoard from '@/app/components/lawyer/FirmBoard';

export const metadata: Metadata = { title: 'Tým | Kancelář Pro', robots: { index: false } };

export default function Page() {
    // Nahoře lidé a nástěnka (denní práce), pod tím správa kanceláře (balíček, pozvánky, role)
    return <LawyerShell active="tym"><div className="space-y-5"><TeamOverview /><FirmBoard manage /><LawyerTeam /></div></LawyerShell>;
}
