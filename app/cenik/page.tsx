import type { Metadata } from 'next';
import PricingPage from '@/app/components/lawyer/PricingPage';

export const metadata: Metadata = { title: 'Ceník | Kancelář', description: 'Jedna cena, všechny funkce. Měsíční, půlroční a roční předplatné pro advokáty i advokátní kanceláře. 14 dní zdarma, bez karty a bez automatického strhávání.' };
export default function Page() { return <PricingPage />; }
