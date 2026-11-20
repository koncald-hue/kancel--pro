import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AuthProvider } from '@/app/components/site/AuthContext';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import ThemeSync from '@/app/components/site/ThemeSync';
import PwaRegister from '@/app/components/site/PwaRegister';
import ConfirmHost from '@/app/components/site/ConfirmHost';
import { getSiteOrigin } from '@/lib/siteUrl';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin', 'latin-ext'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin', 'latin-ext'] });

const origin = getSiteOrigin();

export const metadata: Metadata = {
  ...(origin ? { metadataBase: new URL(origin) } : {}),
  title: 'Kancelář Pro | software pro advokáty a právníky',
  description: 'Spisy, lhůty, klienti, výkazy práce a bezpečná komunikace s klientem na jednom místě.',
  applicationName: 'Kancelář Pro',
  openGraph: { type: 'website', locale: 'cs_CZ', siteName: 'Kancelář Pro', title: 'Kancelář Pro | software pro advokáty a právníky', description: 'Spisy, lhůty, klienti, výkazy práce a bezpečná komunikace s klientem na jednom místě.' },
  appleWebApp: { capable: true, title: 'Kancelář Pro', statusBarStyle: 'default' },
  icons: { apple: '/pwa-icon/apple-180' },
};

export const viewport: Viewport = { themeColor: '#4338ca' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="cs" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-800">
        <AuthProvider>{children}</AuthProvider>
        <ConfirmHost />
        <PwaRegister />
        <ThemeSync />
      </body>
    </html>
  );
}
