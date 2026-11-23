import type { Metadata } from 'next';
import LawyerLanding from '@/app/components/lawyer/LawyerLanding';
import ReviewsSection from '@/app/components/lawyer/ReviewsSection';
import { getApprovedReviews, getPublicPrices } from '@/lib/publicDataServer';
import { JsonLd, organizationLd, softwareLd } from '@/lib/seo/jsonLd';

export const metadata: Metadata = {
    title: 'Software pro advokáty: spisy, lhůty a faktury | Kancelář Pro',
    description: 'Software pro advokáty: spisy, lhůty, datové schránky, výkazy a faktury na jednom místě. A noví klienti z bezplatné poradny Studuj právo, bez provizí. 14 dní zdarma.',
    alternates: { canonical: '/' },
};

export default async function Page() {
    const [prices, reviews] = await Promise.all([getPublicPrices(), getApprovedReviews()]);
    return <><JsonLd data={[organizationLd(), softwareLd(prices)]} /><LawyerLanding initialPrices={prices} reviews={<ReviewsSection reviews={reviews} />} /></>;
}
