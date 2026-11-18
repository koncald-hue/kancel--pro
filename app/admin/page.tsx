import type { Metadata } from 'next';
import AdminShell from '@/app/components/shop/AdminShell';
import AdminHome from '@/app/components/shop/AdminHome';

export const metadata: Metadata = { title: 'Správa | Kancelář', robots: { index: false } };

export default function Page() {
    return <AdminShell title="Správa" intro="Jen pro tým provozovatele: uživatelé a předplatné, účetnictví, statistiky, záznam úkonů a judikatura."><AdminHome /></AdminShell>;
}
