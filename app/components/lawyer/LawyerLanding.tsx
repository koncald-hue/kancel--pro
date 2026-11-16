'use client';

import Link from 'next/link';
import { ArrowRight, Bot, CalendarClock, Check, ClipboardList, FileArchive, Lock, Receipt, Scale, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../site/AuthContext';
import LawyerPricing from './LawyerPricing';
import { RETENTION_MONTHS } from '@/lib/company';
import { CaseMock, ClientMock, DashboardMock, TimesheetMock } from './LandingMockups';

const AUTOMATED: [typeof Scale, string, string][] = [
    [CalendarClock, 'Lhůty se počítají samy', 'Zadáte událost a datum, Kancelář spočítá lhůtu podle zákona, posune ji na pracovní den a ukáže ji v přehledu všech věcí.'],
    [ClipboardList, 'Spis se skládá sám', 'Soubory, chronologie, lhůty a poznámky jsou u věci pohromadě. Souhrn věci se vygeneruje jedním kliknutím.'],
    [Receipt, 'Výkazy a podklady k fakturaci', 'Stopky nebo ruční zápis času se sazbou podle klienta. Součty a export do CSV pro fakturaci hlásí, co ještě nebylo vyfakturováno.'],
    [Users, 'Klient si věci vyřídí sám', 'Klient dostane soukromý odkaz: nahraje podklady z mobilu, vidí stav věci a píše zprávy. Vy nemusíte nic přeposílat e-mailem.'],
    [FileArchive, 'Předání spisu bez ručního sbírání', 'Přehled věci s očíslovanými přílohami připravený pro soud, úřad nebo kolegu.'],
    [Bot, 'Příprava obrany s ověřenými zákony', 'Návrh postupu a podkladů s odkazy na znění zákonů. Je to pomůcka k vaší kontrole, nenahrazuje váš úsudek.'],
];

export default function LawyerLanding() {
    const { account, openLogin } = useAuth();
    const start = account
        ? <Link href="/kancelar" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700">Otevřít kancelář <ArrowRight size={16} aria-hidden="true" /></Link>
        : <button type="button" onClick={() => openLogin('register')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700">Vyzkoušet 14 dní zdarma <ArrowRight size={16} aria-hidden="true" /></button>;

    return (
        <div className="bg-white text-slate-800">
            <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                    <Link href="/" className="flex items-center gap-2.5 font-bold text-slate-900"><span className="rounded-lg bg-indigo-600 p-1.5 text-white"><Scale size={18} aria-hidden="true" /></span> Kancelář</Link>
                    <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex" aria-label="Sekce stránky">
                        <a href="#ukazky" className="hover:text-slate-900">Ukázky</a>
                        <a href="#automatizace" className="hover:text-slate-900">Automatizace</a>
                        <a href="#cenik" className="hover:text-slate-900">Ceník</a>
                    </nav>
                    <div className="flex items-center gap-2">
                        {account ? <Link href="/kancelar" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Otevřít kancelář</Link> : <>
                            <button type="button" onClick={() => openLogin('login')} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Přihlásit se</button>
                            <button type="button" onClick={() => openLogin('register')} className="hidden rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 sm:block">Zkusit zdarma</button>
                        </>}
                    </div>
                </div>
            </header>

            <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-white">
                <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pb-24 sm:pt-20">
                    <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700"><span className="h-1.5 w-1.5 rounded-full bg-indigo-600" /> Pro advokáty a advokátní kanceláře</p>
                    <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-6xl">Automatizace advokátní profese, která <span className="text-indigo-600">šetří hodiny týdně</span></h1>
                    <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">Lhůty, spisy, klienti, výkazy práce a bezpečná komunikace v jednom moderním nástroji. Méně ruční administrativy, víc času na práva.</p>
                    <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        {start}
                        <a href="#ukazky" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-7 py-3.5 text-sm font-bold text-slate-800 hover:bg-slate-50">Prohlédnout ukázky</a>
                    </div>
                    <p className="mt-4 text-sm text-slate-500">14 dní zdarma · bez zadávání karty · bez závazku</p>
                </div>
            </section>

            <section id="ukazky" className="scroll-mt-16 bg-slate-50 py-16 sm:py-24" aria-labelledby="demo-title">
                <div className="mx-auto max-w-6xl px-4 sm:px-6">
                    <div className="text-center">
                        <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Ukázky</p>
                        <h2 id="demo-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Takhle vypadá práce v Kanceláři</h2>
                        <p className="mx-auto mt-3 max-w-2xl text-slate-600">Ukázky vykreslené z aplikace. Jména a údaje jsou smyšlené.</p>
                    </div>
                    <div className="mt-12 grid items-start gap-8 lg:grid-cols-2">
                        <div className="min-w-0 space-y-8"><DashboardMock /><TimesheetMock /></div>
                        <div className="min-w-0 space-y-8"><CaseMock /><div className="pt-2"><ClientMock /><p className="mt-4 text-center text-sm text-slate-500">Klient vidí svou věc na mobilu bez registrace</p></div></div>
                    </div>
                </div>
            </section>

            <section id="automatizace" className="scroll-mt-16 py-16 sm:py-24" aria-labelledby="auto-title">
                <div className="mx-auto max-w-6xl px-4 sm:px-6">
                    <div className="text-center">
                        <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Automatizace</p>
                        <h2 id="auto-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Co za vás Kancelář udělá sama</h2>
                    </div>
                    <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {AUTOMATED.map(([Icon, title, text]) => (
                            <li key={title} className="rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-lg">
                                <span className="inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-700"><Icon size={22} aria-hidden="true" /></span>
                                <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-10 grid gap-5 rounded-3xl bg-slate-900 p-8 text-white sm:grid-cols-[auto_1fr] sm:items-center sm:p-10">
                        <span className="inline-flex w-fit rounded-2xl bg-white/10 p-4 text-indigo-300"><ShieldCheck size={30} aria-hidden="true" /></span>
                        <div>
                            <h3 className="text-xl font-bold">Postavené na ochraně důvěrných údajů</h3>
                            <p className="mt-2 text-sm leading-relaxed text-slate-300"><Lock size={13} className="mr-1 inline" aria-hidden="true" />Zprávy a soubory s klientem jsou end-to-end šifrované: klíč je jen v odkazu a ve vašem šifrovacím heslu. Každý uživatel má vyplněný profil, takže je jasné, kdo Službu používá. Stav věci a poznámky ve spisu šifrované end-to-end nejsou, citlivé podrobnosti patří do zpráv.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-slate-50 py-16 sm:py-20" aria-labelledby="steps-title">
                <div className="mx-auto max-w-5xl px-4 sm:px-6">
                    <h2 id="steps-title" className="text-center text-3xl font-bold tracking-tight text-slate-900">Začněte za pár minut</h2>
                    <ol className="mt-10 grid gap-5 md:grid-cols-3">
                        {[['1', 'Založte účet', 'Zaregistrujete se e-mailem a hned zkoušíte 14 dní zdarma.'], ['2', 'Pracujte ve spisech', 'Zakládáte věci, hlídáte lhůty a píšete výkazy. Data zůstávají uložená.'], ['3', 'Vyberte si plán', 'Po vyplnění profilu zvolíte měsíční, půlroční nebo roční předplatné.']].map(([n, t, d]) => (
                            <li key={n} className="rounded-2xl bg-white p-6 shadow-xs"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{n}</span><h3 className="mt-4 font-bold text-slate-900">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p></li>
                        ))}
                    </ol>
                </div>
            </section>

            <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24"><LawyerPricing /></div>

            <section className="px-4 pb-16 sm:px-6 sm:pb-24">
                <div className="mx-auto max-w-4xl rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-10 text-center text-white sm:p-14">
                    <h2 className="text-3xl font-bold tracking-tight">Vyzkoušejte Kancelář bez rizika</h2>
                    <p className="mx-auto mt-3 max-w-xl text-indigo-100">14 dní zdarma, bez karty a bez závazku. Vaše data se po skončení zkušební doby ještě {RETENTION_MONTHS} měsíců uchovají, nic se nesmaže hned.</p>
                    <div className="mt-7 flex justify-center">
                        {account ? <Link href="/kancelar" className="rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50">Otevřít kancelář</Link> : <button type="button" onClick={() => openLogin('register')} className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50"><Check size={16} aria-hidden="true" /> Začít zdarma</button>}
                    </div>
                </div>
            </section>

            <footer className="border-t border-slate-100 px-4 py-8 text-center text-xs leading-relaxed text-slate-500 sm:px-6">
                <p>Kancelář slouží k organizaci práce a nenahrazuje právní poradenství ani úsudek advokáta. Informace o zákonech jsou pomůckou ke kontrole.</p>
                <p className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 font-semibold"><Link href="/obchodni-podminky" className="hover:text-slate-800">Obchodní podmínky</Link><Link href="/zpracovani-osobnich-udaju" className="hover:text-slate-800">Zpracování osobních údajů</Link><Link href="/ochrana-osobnich-udaju" className="hover:text-slate-800">Ochrana soukromí</Link></p>
                <p className="mt-2">Veřejný web pro občany a studenty je samostatný projekt.</p>
            </footer>
        </div>
    );
}
