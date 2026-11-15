import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import KatastrSearch from '@/app/components/lawyer/KatastrSearch';

export const metadata: Metadata = { title: 'Katastr | Kancelář', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="katastr"><KatastrSearch /></LawyerShell>;
}
