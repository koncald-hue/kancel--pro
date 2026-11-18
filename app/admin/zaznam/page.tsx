import type { Metadata } from 'next';
import AdminShell from '@/app/components/shop/AdminShell';
import AdminLog from '@/app/components/shop/AdminLog';

export const metadata: Metadata = { title: 'Záznam správce | Správa', robots: { index: false } };

export default function Page() {
    return <AdminShell title="Záznam úkonů správce" intro="Kdo z týmu co a kdy ve správě udělal: ruční faktury, dobropisy, výdaje, změny přístupů a nastavení."><AdminLog /></AdminShell>;
}
