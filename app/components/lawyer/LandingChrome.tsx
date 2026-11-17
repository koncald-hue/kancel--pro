'use client';

import Link from 'next/link';
import { ArrowRight, Scale } from 'lucide-react';
import { useAuth } from '../site/AuthContext';

export const NAV = [['/funkce', 'Co umí'], ['/pro-klienty', 'Pro klienty'], ['/cenik', 'Ceník']] as const;

// Tlačítko výzvy: přihlášenému otevře Kancelář, ostatním registraci
export function StartButton({ size = 'lg', light = false }: { size?: 'lg' | 'sm'; light?: boolean }) {
    const { account, openLogin } = useAuth();
    const cls = `inline-flex items-center justify-center gap-2 rounded-lg font-semibold ${size === 'lg' ? 'px-6 py-3 text-[15px]' : 'px-4 py-2 text-sm'} ${light ? 'bg-white text-indigo-800 hover:bg-indigo-50' : 'bg-indigo-700 text-white hover:bg-indigo-800'}`;
    return account
        ? <Link href="/kancelar" className={cls}>Otevřít Kancelář <ArrowRight size={16} aria-hidden="true" /></Link>
        : <button type="button" onClick={() => openLogin('register')} className={`${cls} cursor-pointer`}>Vyzkoušet 14 dní zdarma <ArrowRight size={16} aria-hidden="true" /></button>;
}

export function SiteHeader({ current }: { current?: string }) {
    const { account, openLogin } = useAuth();
    return (
        <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                <Link href="/" className="flex items-center gap-2.5 font-bold text-slate-900"><span className="rounded-lg bg-indigo-700 p-1.5 text-white"><Scale size={18} aria-hidden="true" /></span> Kancelář</Link>
                <nav className="hidden items-center gap-7 text-sm font-medium md:flex" aria-label="Hlavní navigace">
                    {NAV.map(([href, label]) => <Link key={href} href={href} aria-current={current === href ? 'page' : undefined} className={current === href ? 'text-indigo-700' : 'text-slate-600 hover:text-slate-900'}>{label}</Link>)}
                </nav>
                <div className="flex items-center gap-2">
                    {!account && <button type="button" onClick={() => openLogin('login')} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">Přihlásit se</button>}
                    <span className="hidden sm:block"><StartButton size="sm" /></span>
                </div>
            </div>
            <nav className="flex justify-center gap-6 border-t border-slate-100 px-4 py-2 text-sm font-medium md:hidden" aria-label="Hlavní navigace (mobil)">
                {NAV.map(([href, label]) => <Link key={href} href={href} className={current === href ? 'text-indigo-700' : 'text-slate-600'}>{label}</Link>)}
            </nav>
        </header>
    );
}

export function SiteFooter() {
    return (
        <footer className="border-t border-slate-100 px-4 py-8 text-center text-xs leading-relaxed text-slate-500 sm:px-6">
            <p>Kancelář slouží k organizaci práce a nenahrazuje právní poradenství ani úsudek advokáta. Lhůty a výpočty jsou pomůckou ke kontrole. Ukázky rozhraní obsahují smyšlená jména a údaje.</p>
            <p className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 font-semibold"><Link href="/funkce" className="hover:text-slate-800">Co umí</Link><Link href="/pro-klienty" className="hover:text-slate-800">Pro klienty</Link><Link href="/cenik" className="hover:text-slate-800">Ceník</Link><Link href="/obchodni-podminky" className="hover:text-slate-800">Obchodní podmínky</Link><Link href="/zpracovani-osobnich-udaju" className="hover:text-slate-800">Zpracování osobních údajů</Link><Link href="/ochrana-osobnich-udaju" className="hover:text-slate-800">Ochrana soukromí</Link></p>
        </footer>
    );
}

export function FinalCta({ title = 'Vyzkoušejte to na své vlastní věci', text = '14 dní zdarma, bez karty a bez závazku.' }: { title?: string; text?: string }) {
    return (
        <section className="px-4 pb-20 sm:px-6">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-3xl bg-indigo-50 px-6 py-14 text-center">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h2>
                <p className="max-w-lg text-slate-600">{text}</p>
                <StartButton />
            </div>
        </section>
    );
}
