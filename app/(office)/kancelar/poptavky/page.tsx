import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerInquiries from '@/app/components/lawyer/LawyerInquiries';

export const metadata: Metadata = {
    title: 'Kancelář | Kancelář Pro',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="poptavky"><LawyerInquiries /></LawyerShell>;
}
