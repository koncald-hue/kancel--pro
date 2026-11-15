import type { Metadata } from 'next';
import AdminStats from '@/app/components/shop/AdminStats';

export const metadata: Metadata = { title: 'Statistiky | Kancelář', robots: { index: false } };

export default function Page() {
    return <AdminStats />;
}
