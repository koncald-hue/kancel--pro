import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerMailLog from '@/app/components/lawyer/LawyerMailLog';

export const metadata: Metadata = {
    title: 'Podací deník | Kancelář Pro',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="denik"><LawyerMailLog /></LawyerShell>;
}
