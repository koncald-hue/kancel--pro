import type { Metadata } from 'next';
import AdminShell from '@/app/components/shop/AdminShell';
import AdminReviews from '@/app/components/shop/AdminReviews';

export const metadata: Metadata = { title: 'Recenze | Správa', robots: { index: false } };

export default function Page() {
    return <AdminShell title="Recenze uživatelů" intro="Hodnocení od uživatelů. Na úvodní stránku se dostanou jen ty, které zveřejníte. Změna se na stránce projeví do několika minut."><AdminReviews /></AdminShell>;
}
