import type { Metadata } from 'next';
import ClientsPage from '@/app/components/lawyer/ClientsPage';

export const metadata: Metadata = { title: 'Pro klienty | Kancelář Pro', description: 'Klient vidí svou věc v telefonu, nahraje podklady, píše zprávy a podepisuje dokumenty přes soukromý odkaz, bez registrace.' };
export default function Page() { return <ClientsPage />; }
