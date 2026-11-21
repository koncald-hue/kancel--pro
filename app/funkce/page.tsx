import type { Metadata } from 'next';
import FeaturesPage from '@/app/components/lawyer/FeaturesPage';

export const metadata: Metadata = { title: 'Co umí | Kancelář Pro', description: 'Datové schránky, lhůty z rozhodnutí, e-mail ve spisu, automatický výkaz práce, podpis dokumentů, faktury a radar protistrany.' };
export default function Page() { return <FeaturesPage />; }
