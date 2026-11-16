import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LegalCallback from '@/app/components/lawyer/LegalCallback';

export const metadata: Metadata = { title: 'Připojení právní databáze | Kancelář', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="veci"><LegalCallback /></LawyerShell>;
}
