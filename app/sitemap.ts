import type { MetadataRoute } from 'next';
import { getSiteOrigin } from '@/lib/siteUrl';

const PAGES: [string, number][] = [['/', 1], ['/funkce', 0.8], ['/pro-klienty', 0.7], ['/cenik', 0.9], ['/zabezpeceni', 0.7], ['/obchodni-podminky', 0.3], ['/zpracovani-osobnich-udaju', 0.3], ['/ochrana-osobnich-udaju', 0.3]];

// Bez nastavené veřejné adresy (NEXT_PUBLIC_SITE_URL) se mapa webu nevytváří
export default function sitemap(): MetadataRoute.Sitemap {
    const origin = getSiteOrigin();
    if (!origin) return [];
    return PAGES.map(([path, priority]) => ({ url: `${origin}${path === '/' ? '' : path}`, priority }));
}
