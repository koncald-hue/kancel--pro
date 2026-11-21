import type { MetadataRoute } from 'next';

// Instalovatelná aplikace (PWA): otevře se bez adresního řádku, s vlastní ikonou. Data se nikdy neukládají do zařízení (viz public/sw.js).
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Kancelář Pro',
        short_name: 'Kancelář Pro',
        description: 'Spisy, lhůty, klienti a výkazy práce pro advokáty a právníky.',
        lang: 'cs',
        start_url: '/kancelar',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f8fafc',
        theme_color: '#1f3556',
        categories: ['business', 'productivity'],
        icons: [
            { src: '/pwa-icon/any-192', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/pwa-icon/any-512', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/pwa-icon/maskable-512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
            { name: 'Lhůty a úkoly', url: '/kancelar/ukoly' },
            { name: 'Věci', url: '/kancelar/veci' },
            { name: 'Výkazy', url: '/kancelar/vykazy' },
        ],
    };
}
