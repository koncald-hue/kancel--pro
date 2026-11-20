import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import LawyerCalendar from '@/app/components/lawyer/LawyerCalendar';

export const metadata: Metadata = {
    title: 'Kalendář | Kancelář Pro',
    robots: { index: false },
};

export default function Page() {
    return <LawyerShell active="kalendar"><LawyerCalendar /></LawyerShell>;
}
