import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import GoogleCallback from '@/app/components/lawyer/GoogleCallback';

export const metadata: Metadata = { title: 'Připojení Google Kalendáře | Kancelář', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="nastaveni"><GoogleCallback /></LawyerShell>;
}
