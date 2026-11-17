import type { Metadata } from 'next';
import { Source_Serif_4 } from 'next/font/google';
import LawyerLanding from '@/app/components/lawyer/LawyerLanding';

// Klasické patkové písmo jen pro nadpisy úvodní stránky
const display = Source_Serif_4({ weight: ['500', '600'], style: ['normal', 'italic'], subsets: ['latin', 'latin-ext'], variable: '--font-display' });

export const metadata: Metadata = {
    title: 'Kancelář | software pro advokáty a právníky',
    description: 'Spisy, lhůty, datové schránky, e-maily, klienti a fakturace v jednom okně. Lhůty z rozhodnutí, výkaz práce a párování plateb se připraví samy. 14 dní zdarma.',
};

export default function Page() {
    return <div className={display.variable}><LawyerLanding /></div>;
}
