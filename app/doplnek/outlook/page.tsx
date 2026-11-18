import type { Metadata } from 'next';
import AddinOutlook from '@/app/components/addin/AddinOutlook';

export const metadata: Metadata = {
    title: 'Kancelář pro Outlook',
    robots: { index: false },
};

export default function Page() {
    return <AddinOutlook />;
}
