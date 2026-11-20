import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerTemplates from '@/app/components/lawyer/LawyerTemplates';

export const metadata: Metadata = {
    title: 'Šablony úkolů | Kancelář Pro',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="sablony"><LawyerTemplates /></LawyerShell>;
}
