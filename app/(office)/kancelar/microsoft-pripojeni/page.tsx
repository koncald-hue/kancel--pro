import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import MicrosoftCallback from '@/app/components/lawyer/MicrosoftCallback';

export const metadata: Metadata = { title: 'Připojení kalendáře Microsoft 365 | Kancelář Pro', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="nastaveni"><MicrosoftCallback /></LawyerShell>;
}
