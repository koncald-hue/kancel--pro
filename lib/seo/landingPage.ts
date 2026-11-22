import type { Metadata } from 'next';
import { landingBySlug, type Landing } from './landings';

// Stránka bez dat je chyba v kódu, ne chybějící obsah: build má spadnout hned
export function mustLanding(slug: string): Landing {
    const page = landingBySlug(slug);
    if (!page) throw new Error(`Chybí vstupní stránka ${slug}`);
    return page;
}

export const landingMetadata = (page: Landing): Metadata => ({
    title: page.title,
    description: page.description,
    alternates: { canonical: `/${page.slug}` },
    openGraph: { type: 'website', locale: 'cs_CZ', siteName: 'Kancelář Pro', title: page.title, description: page.description, url: `/${page.slug}` },
});
