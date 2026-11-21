import type { Metadata } from 'next';
import AdminShell from '@/app/components/shop/AdminShell';
import AdminFeedback from '@/app/components/shop/AdminFeedback';

export const metadata: Metadata = { title: 'Zpětná vazba | Správa', robots: { index: false } };

export default function Page() {
    return <AdminShell title="Zpětná vazba" intro="Zprávy od uživatelů z tlačítka „Nahlásit problém nebo nápad“ v aplikaci. Odpovězte jim e-mailem a označte jako vyřízené."><AdminFeedback /></AdminShell>;
}
