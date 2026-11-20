import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerLibrary from '@/app/components/lawyer/LawyerLibrary';

export const metadata: Metadata = {
    title: 'Kancelář | Kancelář Pro',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="knihovna"><LawyerLibrary /></LawyerShell>;
}
