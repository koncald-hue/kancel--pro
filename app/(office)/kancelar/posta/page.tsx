import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerMail from '@/app/components/lawyer/LawyerMail';

export const metadata: Metadata = { title: 'Pošta | Kancelář', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="posta"><LawyerMail /></LawyerShell>;
}
