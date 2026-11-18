import type { Metadata } from 'next';
import AdminShell from '@/app/components/shop/AdminShell';
import OpsAccounting from '@/app/components/shop/OpsAccounting';

export const metadata: Metadata = { title: 'Účetnictví | Správa', robots: { index: false } };

export default function Page() {
    return <AdminShell title="Účetnictví provozovatele" intro="Faktury zákazníkům vznikají samy při zaplacení objednávky. Výdaje zapisujete ručně. Odsud stáhnete knihu faktur, výdaje a peněžní deník pro účetní."><OpsAccounting /></AdminShell>;
}
