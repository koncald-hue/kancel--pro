import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import Hlidac from '@/app/components/lawyer/Hlidac';

export const metadata: Metadata = { title: 'Hlídač | Kancelář Pro', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="hlidac"><Hlidac /></LawyerShell>;
}
