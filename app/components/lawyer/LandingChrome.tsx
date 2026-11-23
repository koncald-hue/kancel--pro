'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, ChevronDown, Clock3, Lock, Mail, MailCheck, Menu, Phone, Receipt, Scale, ShieldAlert, Users, X } from 'lucide-react';
import { useAuth } from '../site/AuthContext';
import { LogoSvg } from '@/lib/logo';
import { PROVIDER as COMPANY } from '@/lib/company';

const phoneHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
import { LANDINGS } from '@/lib/seo/landings';

export const NAV = [['/pro-klienty', 'Pro klienty'], ['/navody', 'Návody'], ['/cenik', 'Ceník']] as const;

// Rozbalovací nabídka funkcí: ukáže hned, co aplikace umí
const FUNCS: { id: string; icon: typeof Scale; title: string; text: string }[] = [
    { id: 'datovky', icon: MailCheck, title: 'Datové schránky a lhůty', text: 'Lhůta z rozhodnutí rovnou v kalendáři' },
    { id: 'email', icon: Mail, title: 'E-mail ve spisu', text: 'Pošta uložená tam, kde je spis' },
    { id: 'vykaz', icon: Clock3, title: 'Výkaz práce', text: 'Navrhne se sám, vy potvrdíte' },
    { id: 'klient', icon: Users, title: 'Klient a podpisy', text: 'Soukromá stránka bez registrace' },
    { id: 'penize', icon: Receipt, title: 'Faktury a platby', text: 'Faktury a kontrola úhrad' },
    { id: 'radar', icon: ShieldAlert, title: 'Radar protistrany', text: 'Insolvence a změny firem' },
];

function FunctionsMenu({ current }: { current?: string }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
    }, [open]);
    return (
        <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
            <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(true)} className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium cursor-pointer ${current === '/funkce' || open ? 'text-indigo-800' : 'text-slate-600 hover:text-slate-900'}`}>Funkce <ChevronDown size={15} className={`transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" /></button>
            {open && (
                <div className="absolute left-0 top-full z-50 w-[34rem] pt-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-300/40">
                        <ul className="grid grid-cols-2 gap-1">
                            {FUNCS.map(({ id, icon: Icon, title, text }) => (
                                <li key={id}><Link href={`/funkce#${id}`} onClick={() => setOpen(false)} className="flex items-start gap-3 rounded-xl p-3 hover:bg-slate-50"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700"><Icon size={17} aria-hidden="true" /></span><span><span className="block text-sm font-semibold text-slate-900">{title}</span><span className="block text-xs text-slate-500">{text}</span></span></Link></li>
                            ))}
                        </ul>
                        <Link href="/funkce" onClick={() => setOpen(false)} className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-slate-100">Všechny funkce <ArrowRight size={15} aria-hidden="true" /></Link>
                    </div>
                </div>
            )}
        </div>
    );
}

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
        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white">
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
                <Link href="/" className="flex items-center gap-2.5 text-slate-900" aria-label="Kancelář, úvodní stránka">
                    <LogoSvg size={36} radius={9} />
                    <span className="text-lg font-bold tracking-tight">Kancelář Pro</span>
                </Link>
                <nav className="hidden items-center gap-1 md:flex" aria-label="Hlavní navigace">
                    <FunctionsMenu current={current} />
                    {NAV.map(([href, label]) => <Link key={href} href={href} aria-current={current === href ? 'page' : undefined} className={`rounded-lg px-3 py-2 text-sm font-medium ${current === href ? 'text-indigo-800' : 'text-slate-600 hover:text-slate-900'}`}>{label}</Link>)}
                </nav>
                <div className="ml-auto flex items-center gap-2">
                    {!account && <button type="button" onClick={() => openLogin('login')} className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:block cursor-pointer">Přihlásit se</button>}
                    <span className="hidden sm:block"><StartButton size="sm" /></span>
                    <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? 'Zavřít menu' : 'Otevřít menu'} className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden cursor-pointer">{open ? <X size={22} /> : <Menu size={22} />}</button>
                </div>
            </div>
            {open && (
                <nav className="border-t border-slate-100 bg-white px-4 pb-4 pt-2 md:hidden" aria-label="Hlavní navigace (mobil)">
                    <ul className="space-y-1">
                        <li><Link href="/funkce" onClick={() => setOpen(false)} className={`block rounded-lg px-3 py-3 text-base font-medium ${current === '/funkce' ? 'bg-indigo-50 text-indigo-800' : 'text-slate-700 hover:bg-slate-50'}`}>Funkce</Link></li>
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

const FOOT_LINK = 'hover:text-white';

function FooterColumn({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
    return (
        <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">{title}</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
                {links.map(([href, label]) => <li key={href}><Link href={href} className={`text-slate-300 ${FOOT_LINK}`}>{label}</Link></li>)}
            </ul>
        </div>
    );
}

export function SiteFooter() {
    const detail = [COMPANY.ico ? `IČO ${COMPANY.ico}` : '', COMPANY.address].filter(Boolean);
    return (
        <footer className="relative overflow-hidden bg-slate-950 text-slate-300 print:hidden">
            <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-indigo-600/15 blur-3xl" />
            <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-14 sm:px-6">
                <div className="grid gap-10 lg:grid-cols-[1.3fr_0.8fr_0.8fr_1.1fr]">
                    <div>
                        <Link href="/" className="inline-flex items-center gap-2.5 text-white" aria-label="Kancelář Pro, úvodní stránka">
                            <LogoSvg size={38} radius={9} />
                            <span className="text-lg font-bold tracking-tight">Kancelář Pro</span>
                        </Link>
                        <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">Spisy, lhůty, klienti a výkazy práce v jedné aplikaci pro advokáty a advokátní kanceláře.</p>
                        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-slate-300 ring-1 ring-white/10"><Lock size={13} className="text-amber-300" aria-hidden="true" /> Data šifrovaně v EU</p>
                    </div>

                    <FooterColumn title="Aplikace" links={[['/funkce', 'Funkce'], ['/pro-klienty', 'Pro klienty'], ['/cenik', 'Ceník'], ['/zabezpeceni', 'Zabezpečení'], ['/navody', 'Návody']]} />
                    <FooterColumn title="Právní" links={[['/obchodni-podminky', 'Obchodní podmínky'], ['/zpracovani-osobnich-udaju', 'Zpracování osobních údajů'], ['/ochrana-osobnich-udaju', 'Ochrana soukromí']]} />

                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">Kontakt</h3>
                        <div className="mt-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                            <p className="text-sm font-semibold text-white">{COMPANY.name}</p>
                            <p className="text-xs text-slate-400">Zakladatel a provozovatel</p>
                            <ul className="mt-3 space-y-2 text-sm">
                                <li><a href={`mailto:${COMPANY.email}`} className={`inline-flex items-center gap-2 text-slate-200 ${FOOT_LINK}`}><Mail size={14} className="text-amber-300" aria-hidden="true" /> {COMPANY.email}</a></li>
                                <li><a href={phoneHref(COMPANY.phone)} className={`inline-flex items-center gap-2 text-slate-200 ${FOOT_LINK}`}><Phone size={14} className="text-amber-300" aria-hidden="true" /> {COMPANY.phone}</a></li>
                                {detail.length > 0 && <li className="flex items-start gap-2 text-slate-400"><Building2 size={14} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" /><span>{detail.join(' · ')}</span></li>}
                            </ul>
                        </div>
                    </div>
                </div>

                <nav aria-label="Kancelář Pro pro advokáty" className="mt-12 border-t border-white/10 pt-6">
                    <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-400 lg:justify-start">
                        {LANDINGS.map((l) => <li key={l.slug}><Link href={`/${l.slug}`} className={FOOT_LINK}>{l.kicker}</Link></li>)}
                    </ul>
                </nav>

                <div className="mt-6 flex flex-col gap-2 text-xs leading-relaxed text-slate-500 lg:flex-row lg:items-start lg:justify-between">
                    <p className="max-w-3xl">Kancelář slouží k organizaci práce a nenahrazuje právní poradenství ani úsudek advokáta. Lhůty a výpočty jsou pomůckou ke kontrole. Ukázky rozhraní obsahují smyšlená jména a údaje.</p>
                    <p className="shrink-0">© {COMPANY.name}</p>
                </div>
            </div>
        </footer>
    );
}

export function FinalCta({ title = 'Vyzkoušejte to na svých vlastních spisech', text = '14 dní zdarma, bez karty a bez závazku.' }: { title?: string; text?: string }) {
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
