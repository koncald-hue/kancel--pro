import Link from 'next/link';
import { Scale } from 'lucide-react';
import { PROVIDER, type ProviderKey } from '@/lib/company';

// Údaj provozovatele; když chybí, zobrazí se výrazně jako „DOPLNIT“, aby se nedostal do ostrého provozu
export function Fill({ k, label }: { k: ProviderKey; label?: string }) {
    const value = PROVIDER[k];
    if (value) return <>{value}</>;
    return <mark className="rounded bg-yellow-200 px-1 font-semibold text-yellow-950">[DOPLNIT: {label ?? k}]</mark>;
}

export function LegalPage({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-white text-slate-800">
            <header className="border-b border-slate-100">
                <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
                    <Link href="/" className="flex items-center gap-2.5 font-bold text-slate-900"><span className="rounded-lg bg-indigo-600 p-1.5 text-white"><Scale size={18} aria-hidden="true" /></span> Kancelář</Link>
                    <nav className="flex gap-4 text-xs font-semibold text-slate-600" aria-label="Právní dokumenty">
                        <Link href="/obchodni-podminky" className="hover:text-slate-900">Obchodní podmínky</Link>
                        <Link href="/zpracovani-osobnich-udaju" className="hover:text-slate-900">Zpracování údajů</Link>
                        <Link href="/ochrana-osobnich-udaju" className="hover:text-slate-900">Ochrana soukromí</Link>
                    </nav>
                </div>
            </header>
            <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
                {intro && <p className="mt-3 text-sm leading-relaxed text-slate-600">{intro}</p>}
                <div className="mt-8 space-y-8 text-[15px] leading-relaxed">{children}</div>
            </main>
        </div>
    );
}

export const Section = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
    <section aria-labelledby={`s${n}`}>
        <h2 id={`s${n}`} className="text-lg font-bold text-slate-900">{n}. {title}</h2>
        <div className="mt-3 space-y-2.5">{children}</div>
    </section>
);

// Očíslovaný odstavec, např. 3.2
export const Cl = ({ n, children }: { n: string; children: React.ReactNode }) => (
    <p className="flex gap-3"><span className="w-9 shrink-0 text-right font-semibold text-slate-400">{n}</span><span className="min-w-0 flex-1">{children}</span></p>
);

export const Sub = ({ children }: { children: React.ReactNode }) => <ul className="ml-12 list-disc space-y-1 pl-5 text-slate-700">{children}</ul>;
