import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerInfosoud from '@/app/components/lawyer/LawyerInfosoud';

export const metadata: Metadata = { title: 'Soudní řízení | Kancelář Pro', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="infosoud"><LawyerInfosoud /></LawyerShell>;
}
