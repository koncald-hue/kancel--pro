import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerTeamTasks from '@/app/components/lawyer/LawyerTeamTasks';

export const metadata: Metadata = {
    title: 'Úkoly | Kancelář',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="ukoly"><LawyerTeamTasks /></LawyerShell>;
}
