import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerInsolvency from '@/app/components/lawyer/LawyerInsolvency';

export const metadata: Metadata = { title: 'Insolvence | Kancelář Pro', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="insolvence"><LawyerInsolvency /></LawyerShell>;
}
