import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerDashboard from '@/app/components/lawyer/LawyerDashboard';

export const metadata: Metadata = {
    title: 'Kancelář | Kancelář Pro',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="prehled"><LawyerDashboard /></LawyerShell>;
}
