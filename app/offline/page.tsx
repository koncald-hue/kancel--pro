import type { Metadata } from 'next';
import { Scale } from 'lucide-react';

export const metadata: Metadata = { title: 'Jste offline | Kancelář', robots: { index: false } };

// Zobrazí se, když zařízení nemá připojení. Žádná data kanceláře se v zařízení neukládají, proto zde nic z nich není.
export default function OfflinePage() {
    return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
            <span className="rounded-2xl bg-indigo-600 p-4 text-white" aria-hidden="true"><Scale size={36} /></span>
            <h1 className="mt-5 text-xl font-bold text-slate-900">Jste offline</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Kancelář potřebuje připojení k internetu. Z bezpečnostních důvodů se data spisů, klientů ani lhůt neukládají do zařízení, takže bez připojení nejsou k dispozici. Jakmile se spojení vrátí, otevřete aplikaci znovu.</p>
        </main>
    );
}
