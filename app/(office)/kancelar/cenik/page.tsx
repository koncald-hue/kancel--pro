import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerPriceList from '@/app/components/lawyer/LawyerPriceList';

export const metadata: Metadata = { title: 'Ceník | Kancelář', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="cenik"><LawyerPriceList /></LawyerShell>;
}
