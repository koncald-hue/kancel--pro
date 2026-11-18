import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AuthProvider } from '@/app/components/site/AuthContext';
import ConfirmHost from '@/app/components/site/ConfirmHost';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin', 'latin-ext'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin', 'latin-ext'] });

export const metadata: Metadata = {
  title: 'Kancelář | software pro advokáty a právníky',
  description: 'Spisy, lhůty, klienti, výkazy práce a bezpečná komunikace s klientem na jednom místě.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="cs" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-800">
        <AuthProvider>{children}</AuthProvider>
        <ConfirmHost />
      </body>
    </html>
  );
}
