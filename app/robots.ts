import type { MetadataRoute } from 'next';
import { getSiteOrigin } from '@/lib/siteUrl';

// Veřejné stránky jsou k vyhledání, pracovní prostor, správa a osobní odkazy ne
export default function robots(): MetadataRoute.Robots {
    const origin = getSiteOrigin();
    return {
        rules: [{ userAgent: '*', allow: '/', disallow: ['/kancelar', '/admin', '/api/', '/klient/', '/poptavka/', '/pozvanka', '/obnova-hesla', '/offline'] }],
        ...(origin ? { sitemap: `${origin}/sitemap.xml`, host: origin } : {}),
    };
}
