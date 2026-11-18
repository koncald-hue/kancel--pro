import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerAddins from '@/app/components/lawyer/LawyerAddins';

export const metadata: Metadata = {
    title: 'Doplňky Word a Outlook | Kancelář',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="doplnky"><LawyerAddins /></LawyerShell>;
}
