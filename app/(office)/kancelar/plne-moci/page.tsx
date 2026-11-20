import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import PowersRegister from '@/app/components/lawyer/PowersRegister';

export const metadata: Metadata = { title: 'Registr plných mocí | Kancelář Pro', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="plne-moci"><PowersRegister /></LawyerShell>;
}
