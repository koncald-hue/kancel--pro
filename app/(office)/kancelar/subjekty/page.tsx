import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import SubjectsRegister from '@/app/components/lawyer/SubjectsRegister';

export const metadata: Metadata = { title: 'Subjekty | Kancelář', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="subjekty"><SubjectsRegister /></LawyerShell>;
}
