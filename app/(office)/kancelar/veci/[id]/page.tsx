import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import CaseDetail from '@/app/components/situation/CaseDetail';

export const metadata: Metadata = {
    title: 'Věc | Kancelář',
    robots: { index: false },
};

// Spis otevřený z pracovního prostoru: návrat vede na záložku Věci, ne na Moje případy
export default function Page() {
    return <LawyerShell active="veci"><CaseDetail variant="office" /></LawyerShell>;
}
