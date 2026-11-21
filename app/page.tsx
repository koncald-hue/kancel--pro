import type { Metadata } from 'next';
import LawyerLanding from '@/app/components/lawyer/LawyerLanding';
import ReviewsSection from '@/app/components/lawyer/ReviewsSection';
import { getApprovedReviews, getPublicPrices } from '@/lib/publicDataServer';

export const metadata: Metadata = {
    title: 'Kancelář Pro | pracovní prostor pro advokáty',
    description: 'Spisy, lhůty, klienti a faktury advokáta na jednom místě. Datové zprávy, e-maily i výkazy práce bez přepínání mezi programy. 14 dní zdarma.',
};

export default async function Page() {
    const [prices, reviews] = await Promise.all([getPublicPrices(), getApprovedReviews()]);
    return <LawyerLanding initialPrices={prices} reviews={<ReviewsSection reviews={reviews} />} />;
}
