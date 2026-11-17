import type { Metadata } from 'next';
import { Instrument_Serif } from 'next/font/google';
import LawyerLanding from '@/app/components/lawyer/LawyerLanding';

// Výrazné patkové písmo jen pro nadpisy úvodní stránky
const display = Instrument_Serif({ weight: '400', style: ['normal', 'italic'], subsets: ['latin', 'latin-ext'], variable: '--font-display' });

export const metadata: Metadata = {
    title: 'Kancelář | software pro advokáty a právníky',
    description: 'Datové schránky, lhůty, spisy, e-maily, klienti a fakturace na jednom místě. Kancelář čte, počítá a připravuje, vy rozhodujete. 14 dní zdarma.',
};

export default function Page() {
    return <div className={display.variable}><LawyerLanding /></div>;
}
