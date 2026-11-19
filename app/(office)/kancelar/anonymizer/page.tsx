import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import Anonymizer from '@/app/components/lawyer/Anonymizer';

export const metadata: Metadata = { title: 'Anonymizér | Kancelář', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="anonymizer"><Anonymizer /></LawyerShell>;
}
