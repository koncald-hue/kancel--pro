import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerDataBox from '@/app/components/lawyer/LawyerDataBox';

export const metadata: Metadata = { title: 'Datová schránka | Kancelář', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="schranka"><LawyerDataBox /></LawyerShell>;
}
