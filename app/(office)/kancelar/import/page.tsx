import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerImport from '@/app/components/lawyer/LawyerImport';

export const metadata: Metadata = { title: 'Import dat | Kancelář', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="import"><LawyerImport /></LawyerShell>;
}
