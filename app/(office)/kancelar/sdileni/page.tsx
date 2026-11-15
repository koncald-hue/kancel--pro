import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerSharing from '@/app/components/lawyer/LawyerSharing';

export const metadata: Metadata = { title: 'Sdílení | Kancelář', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="sdileni"><LawyerSharing /></LawyerShell>;
}
