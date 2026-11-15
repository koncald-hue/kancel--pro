import type { Metadata } from 'next';
import LawyerAdmin from '@/app/components/shop/LawyerAdmin';

export const metadata: Metadata = {
    title: 'Přístupy advokátů',
    robots: { index: false },
};

export default function Page() {
    return <LawyerAdmin />;
}
