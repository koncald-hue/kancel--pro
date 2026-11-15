import type { Metadata } from 'next';
import LawyerLanding from '@/app/components/lawyer/LawyerLanding';

export const metadata: Metadata = {
    title: 'Kancelář | software pro advokáty a právníky',
    description: 'Hlídání lhůt, spisy, klienti, výkazy práce a bezpečná komunikace s klientem v jednom nástroji. 14 dní zdarma.',
};

export default function Page() {
    return <LawyerLanding />;
}
