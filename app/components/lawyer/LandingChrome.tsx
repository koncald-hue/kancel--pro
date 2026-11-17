'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Menu, Scale, X } from 'lucide-react';
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
    const [open, setOpen] = useState(false);
    return (
        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
                <Link href="/" className="flex items-center gap-2.5 text-slate-900" aria-label="Kancelář, úvodní stránka">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-sm shadow-indigo-300/50"><Scale size={18} aria-hidden="true" /></span>
                    <span className="text-lg font-bold tracking-tight">Kancelář</span>
                </Link>
                <nav className="mx-auto hidden items-center gap-1 rounded-full border border-slate-200 bg-slate-50/80 p-1 md:flex" aria-label="Hlavní navigace">
                    {NAV.map(([href, label]) => <Link key={href} href={href} aria-current={current === href ? 'page' : undefined} className={`rounded-full px-5 py-1.5 text-sm font-medium transition ${current === href ? 'bg-white text-indigo-800 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900'}`}>{label}</Link>)}
                </nav>
                <div className="ml-auto flex items-center gap-2 md:ml-0">
                    {!account && <button type="button" onClick={() => openLogin('login')} className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:block cursor-pointer">Přihlásit se</button>}
                    <span className="hidden sm:block"><StartButton size="sm" /></span>
                    <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? 'Zavřít menu' : 'Otevřít menu'} className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden cursor-pointer">{open ? <X size={22} /> : <Menu size={22} />}</button>
                </div>
            </div>
            {open && (
                <nav className="border-t border-slate-100 bg-white px-4 pb-4 pt-2 md:hidden" aria-label="Hlavní navigace (mobil)">
                    <ul className="space-y-1">
                        {NAV.map(([href, label]) => <li key={href}><Link href={href} onClick={() => setOpen(false)} className={`block rounded-lg px-3 py-3 text-base font-medium ${current === href ? 'bg-indigo-50 text-indigo-800' : 'text-slate-700 hover:bg-slate-50'}`}>{label}</Link></li>)}
                    </ul>
                    <div className="mt-3 flex flex-col gap-2">
                        {!account && <button type="button" onClick={() => { setOpen(false); openLogin('login'); }} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 cursor-pointer">Přihlásit se</button>}
                        <StartButton />
                    </div>
                </nav>
            )}
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
