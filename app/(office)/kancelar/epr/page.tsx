import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerEpr from '@/app/components/lawyer/LawyerEpr';

export const metadata: Metadata = {
    title: 'Platební rozkazy (EPR) | Kancelář',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="epr"><LawyerEpr /></LawyerShell>;
}
