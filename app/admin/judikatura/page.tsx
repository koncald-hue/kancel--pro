import type { Metadata } from 'next';
import CaseLawAdmin from '@/app/components/shop/CaseLawAdmin';

export const metadata: Metadata = {
    title: 'Knihovna judikatury',
    robots: { index: false },
};

export default function Page() {
    return <CaseLawAdmin />;
}
