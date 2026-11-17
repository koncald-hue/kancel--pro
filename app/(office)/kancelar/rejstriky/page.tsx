import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerRegisters from '@/app/components/lawyer/LawyerRegisters';

export const metadata: Metadata = { title: 'Rejstříky | Kancelář', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="rejstriky"><LawyerRegisters /></LawyerShell>;
}
