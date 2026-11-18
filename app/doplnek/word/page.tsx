import type { Metadata } from 'next';
import AddinWord from '@/app/components/addin/AddinWord';

export const metadata: Metadata = {
    title: 'Kancelář pro Word',
    robots: { index: false },
};

export default function Page() {
    return <AddinWord />;
}
