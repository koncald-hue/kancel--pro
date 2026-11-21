import type { Metadata } from 'next';
import AdminShell from '@/app/components/shop/AdminShell';
import AdminNotices from '@/app/components/shop/AdminNotices';

export const metadata: Metadata = { title: 'Upozornění | Správa', robots: { index: false } };

export default function Page() {
    return <AdminShell title="Upozornění uživatelům" intro="Pošlete zprávu vybraným uživatelům přímo do Kanceláře. Ukáže se jim na stránce Dnes, dokud ji nepotvrdí."><AdminNotices /></AdminShell>;
}
