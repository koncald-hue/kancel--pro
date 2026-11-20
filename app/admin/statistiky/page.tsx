import type { Metadata } from 'next';
import AdminShell from '@/app/components/shop/AdminShell';
import AdminStats from '@/app/components/shop/AdminStats';

export const metadata: Metadata = { title: 'Statistiky | Kancelář Pro', robots: { index: false } };

export default function Page() {
    return <AdminShell title=""><AdminStats /></AdminShell>;
}
