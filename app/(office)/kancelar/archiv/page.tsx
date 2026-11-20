import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerArchive from '@/app/components/lawyer/LawyerArchive';

export const metadata: Metadata = {
    title: 'Archiv spisů | Kancelář Pro',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="archiv"><LawyerArchive /></LawyerShell>;
}
