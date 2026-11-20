import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerBulkMail from '@/app/components/lawyer/LawyerBulkMail';

export const metadata: Metadata = {
    title: 'Hromadný e-mail | Kancelář Pro',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="klienti"><LawyerBulkMail /></LawyerShell>;
}
