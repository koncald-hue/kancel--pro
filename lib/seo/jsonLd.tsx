// Strukturovaná data (schema.org, JSON-LD) pro vyhledávače: aplikace s cenou, organizace, časté otázky, drobečková navigace a články.
import { getSiteOrigin } from '@/lib/siteUrl';
import type { Prices } from '@/lib/plans';

type Json = Record<string, unknown>;
const abs = (path: string) => `${getSiteOrigin() ?? 'https://kancelarpro.cz'}${path === '/' ? '' : path}`;

export function JsonLd({ data }: { data: Json | Json[] }) {
    // Každý objekt ve vlastní značce: vestavěné prohlížeče (Facebook, Instagram) čtou JSON-LD jako jeden objekt
    // a na poli padaly s chybou „r["@context"].toLowerCase“. Google bere obě formy stejně.
    // Znak < se nahrazuje, aby text nemohl ukončit značku <script> (doporučení Next.js)
    return (Array.isArray(data) ? data : [data]).map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d).replace(/</g, '\\u003c') }} />
    ));
}

export const organizationLd = (): Json => ({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Kancelář Pro',
    url: abs('/'),
    logo: abs('/icon'),
});

export function softwareLd(prices?: Prices): Json {
    const offers = prices && prices.month > 0
        ? [
            { '@type': 'Offer', name: 'Měsíční předplatné', price: prices.month, priceCurrency: 'CZK', url: abs('/cenik') },
            ...(prices.half > 0 ? [{ '@type': 'Offer', name: 'Půlroční předplatné', price: prices.half, priceCurrency: 'CZK', url: abs('/cenik') }] : []),
            ...(prices.year > 0 ? [{ '@type': 'Offer', name: 'Roční předplatné', price: prices.year, priceCurrency: 'CZK', url: abs('/cenik') }] : []),
        ]
        : undefined;
    return {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Kancelář Pro',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, iOS, Android',
        inLanguage: 'cs',
        url: abs('/'),
        description: 'Software pro advokáty: spisy, lhůty z datových schránek, e-mail ve spisu, výkaz práce, faktury a klientský portál.',
        featureList: ['Evidence spisů', 'Lhůty z datových schránek', 'E-mail ve spisu', 'Výkaz práce', 'Fakturace a párování plateb', 'Klientský portál s podpisem', 'Kontrola střetu zájmů', 'Evidence úschov', 'AML identifikace klienta'],
        ...(offers ? { offers } : {}),
        publisher: { '@type': 'Organization', name: 'Kancelář Pro', url: abs('/') },
    };
}

export const faqLd = (faq: { q: string; a: string }[]): Json => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

export const breadcrumbLd = (items: [string, string][]): Json => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })),
});

export const articleLd = (a: { title: string; description: string; path: string; published: string; updated: string }): Json => ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    inLanguage: 'cs',
    datePublished: a.published,
    dateModified: a.updated,
    mainEntityOfPage: abs(a.path),
    author: { '@type': 'Organization', name: 'Kancelář Pro', url: abs('/') },
    publisher: { '@type': 'Organization', name: 'Kancelář Pro', logo: { '@type': 'ImageObject', url: abs('/icon') } },
});
