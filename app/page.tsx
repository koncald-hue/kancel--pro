import type { Metadata } from 'next';
import LawyerLanding from '@/app/components/lawyer/LawyerLanding';

export const metadata: Metadata = {
    title: 'Kancelář | pracovní prostor pro advokáty',
    description: 'Spisy, lhůty, klienti a faktury advokáta na jednom místě. Datové zprávy, e-maily i výkazy práce bez přepínání mezi programy. 14 dní zdarma.',
};

export default function Page() {
    return <LawyerLanding />;
}
