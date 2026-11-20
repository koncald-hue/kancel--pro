import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import MoneyTabs from '@/app/components/lawyer/MoneyTabs';
import BankAutoSync from '@/app/components/lawyer/BankAutoSync';
import LawyerInvoices from '@/app/components/lawyer/LawyerInvoices';

export const metadata: Metadata = { title: 'Fakturace | Kancelář Pro', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="faktury"><MoneyTabs current="faktury" /><BankAutoSync /><LawyerInvoices /></LawyerShell>;
}
