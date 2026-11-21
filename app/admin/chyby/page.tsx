import type { Metadata } from 'next';
import AdminShell from '@/app/components/shop/AdminShell';
import AdminErrors from '@/app/components/shop/AdminErrors';

export const metadata: Metadata = { title: 'Chyby aplikace | Správa', robots: { index: false } };

export default function Page() {
    return <AdminShell title="Chyby aplikace" intro="Chyby, které se pokazily v prohlížeči uživatelů. Stejné chyby jsou sloučené. Ukládá se jen zkrácený text bez e-mailů a parametrů adres."><AdminErrors /></AdminShell>;
}
