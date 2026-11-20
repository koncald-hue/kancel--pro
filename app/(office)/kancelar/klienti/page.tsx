import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerClients from '@/app/components/lawyer/LawyerClients';

export const metadata: Metadata = {
    title: 'Kancelář | Kancelář Pro',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="klienti"><LawyerClients /></LawyerShell>;
}
