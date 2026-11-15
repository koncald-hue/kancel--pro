import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerChat from '@/app/components/lawyer/LawyerChat';

export const metadata: Metadata = { title: 'Chat | Kancelář', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="chat"><LawyerChat /></LawyerShell>;
}
