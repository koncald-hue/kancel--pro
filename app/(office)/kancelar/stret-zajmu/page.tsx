import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerConflicts from '@/app/components/lawyer/LawyerConflicts';

export const metadata: Metadata = {
    title: 'Střet zájmů | Kancelář Pro',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="stret"><LawyerConflicts /></LawyerShell>;
}
