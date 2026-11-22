import type { Metadata } from 'next';
import PricingPage from '@/app/components/lawyer/PricingPage';
import { getPublicPrices } from '@/lib/publicDataServer';
import { JsonLd, softwareLd } from '@/lib/seo/jsonLd';

export const metadata: Metadata = { title: 'Ceník | Kancelář Pro', description: 'Jedna cena, všechny funkce. Měsíční, půlroční a roční předplatné pro advokáty i advokátní kanceláře. 14 dní zdarma, bez karty. Automatické obnovování je na výběr a zrušíte ho kdykoli.' };
export default async function Page() { return <><JsonLd data={softwareLd(await getPublicPrices())} /><PricingPage /></>; }
