import type { NextConfig } from "next";

// Content-Security-Policy. Aplikace používá předgenerované části stránek (cacheComponents), se kterými
// nonce nefunguje (viz dokumentace Next.js „Content Security Policy“), proto skripty smí jen z vlastní domény
// a inline (bootstrap Next.js). Zakázané jsou skripty a rámce z cizích domén, pluginy (object), změna <base>,
// odesílání formulářů jinam a vložení aplikace do cizí stránky. Seznam domén odpovídá tomu, co prohlížeč skutečně načítá.
const isDev = process.env.NODE_ENV !== 'production';
const supabase = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin; } catch { return ''; } })();
const supabaseWs = supabase.replace(/^https:/, 'wss:');
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // mapové podklady (OpenStreetMap, katastrální mapa ČÚZK), fotky jako data:, náhledy z blob:
  `img-src 'self' data: blob: https://tile.openstreetmap.org https://services.cuzk.gov.cz${supabase ? ` ${supabase}` : ''}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabase ? ` ${supabase} ${supabaseWs}` : ''}${isDev ? ' ws: http://localhost:*' : ''}`,
  // náhled PDF k podpisu (blob: nebo podepsaná adresa z úložiště)
  `frame-src 'self' blob:${supabase ? ` ${supabase}` : ''}`,
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  // Poštovní knihovny běží jen na serveru a nesmějí se sbalovat do balíčku
  serverExternalPackages: ['imapflow', 'mailparser', 'nodemailer'],
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'Content-Security-Policy', value: csp },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        { key: 'X-DNS-Prefetch-Control', value: 'off' },
      ] },
      // Data aplikace (API) se nesmějí ukládat do sdílených mezipamětí
      { source: '/api/:path((?!news$).*)', headers: [
        { key: 'Cache-Control', value: 'no-store, max-age=0' },
      ] },
      { source: '/api/portal/:path*', headers: [
        { key: 'Cache-Control', value: 'no-store, max-age=0' },
        { key: 'Pragma', value: 'no-cache' },
      ] },
    ];
  },
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
