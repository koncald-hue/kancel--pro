'use client';

import Link from 'next/link';
import { ArrowRight, CalendarClock, Check, FolderOpen, Lock, Receipt, Scale, Smartphone, Users } from 'lucide-react';
import PricingTeaser from './PricingTeaser';
import { FinalCta, SiteFooter, SiteHeader, StartButton } from './LandingChrome';
import { CaseMock, ClientMock } from './LandingMockups';

// Co aplikace dělá, v lidské řeči. Čtyři věci, které advokát denně řeší.
const FOUR: { icon: typeof Scale; tone: string; title: string; text: string }[] = [
    { icon: FolderOpen, tone: 'bg-indigo-100 text-indigo-700', title: 'Vedete spisy', text: 'Každá věc má své místo: soubory, e-maily, datové zprávy, poznámky a kontakty.' },
    { icon: CalendarClock, tone: 'bg-amber-100 text-amber-700', title: 'Hlídáte lhůty', text: 'Lhůty se spočítají a posunou na pracovní den. Včas víte, co hoří.' },
    { icon: Users, tone: 'bg-sky-100 text-sky-700', title: 'Komunikujete s klientem', text: 'Klient nahraje podklady a píše zprávy přes soukromý odkaz, bez registrace.' },
    { icon: Receipt, tone: 'bg-emerald-100 text-emerald-700', title: 'Účtujete práci', text: 'Výkazy, faktury s QR platbou a kontrola, kdo už zaplatil.' },
];

const ALSO = ['Datové schránky', 'E-mail ve spisu', 'Podpis dokumentů', 'Vzory ve Wordu', 'Insolvenční rejstřík', 'ARES a katastr', 'Import z Excelu', 'Práce v týmu'];

export default function LawyerLanding() {
    return (
        <div className="bg-white text-slate-800">
            <SiteHeader />

            {/* 1. Co to je: jedna věta a jeden obrázek */}
            <section className="overflow-hidden bg-gradient-to-b from-indigo-50/70 to-white">
                <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_1.1fr] lg:pb-28">
                    <div>
                        <p className="text-sm font-semibold text-indigo-700">Pracovní prostor pro advokáty</p>
                        <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">Všechna vaše práce na jednom místě.</h1>
                        <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600">Spisy, lhůty, klienti a faktury. Nahrazuje Excel, složky v e-mailu a papírový kalendář.</p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <StartButton />
                            <Link href="/funkce" className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-[15px] font-semibold text-slate-800 hover:bg-slate-50">Co všechno umí</Link>
                        </div>
                        <p className="mt-4 text-sm text-slate-500">14 dní zdarma · bez platební karty · bez závazku</p>
                    </div>
                    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
                        <div className="lg:pr-24"><CaseMock /></div>
                        <div className="mt-6 flex justify-center lg:absolute lg:-bottom-12 lg:right-0 lg:mt-0"><div className="scale-[0.82] origin-top lg:origin-bottom-right"><ClientMock /></div></div>
                    </div>
                </div>
            </section>

            {/* 2. Čtyři věci, které za vás vyřeší */}
            <section className="px-4 py-20 sm:px-6 sm:py-24" aria-labelledby="co-title">
                <div className="mx-auto max-w-6xl">
                    <h2 id="co-title" className="max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Čtyři věci, které advokát dělá každý den</h2>
                    <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                        {FOUR.map(({ icon: Icon, tone, title, text }) => (
                            <li key={title}>
                                <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}><Icon size={22} aria-hidden="true" /></span>
                                <h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3>
                                <p className="mt-2 leading-relaxed text-slate-600">{text}</p>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-14 text-sm font-semibold text-slate-500">K tomu navíc <Link href="/funkce" className="ml-2 text-indigo-700 hover:underline">Všechny funkce →</Link></p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                        {ALSO.map((t) => <li key={t} className="rounded-full border border-slate-200 px-3.5 py-1.5 text-sm text-slate-700">{t}</li>)}
                    </ul>
                </div>
            </section>

            {/* 3. Klient: barevný pás s telefonem */}
            <section className="bg-indigo-700 text-white" aria-labelledby="klient-title">
                <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-2">
                    <div>
                        <p className="flex items-center gap-2 text-sm font-semibold text-indigo-200"><Smartphone size={16} aria-hidden="true" /> Pro vaše klienty</p>
                        <h2 id="klient-title" className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Klient vidí svou věc v telefonu. Bez registrace.</h2>
                        <ul className="mt-7 space-y-3 text-lg text-indigo-50">
                            {['Pošlete mu odkaz', 'Nahraje podklady a napíše zprávu', 'Podepíše smlouvu', 'Vy nic nepřeposíláte e-mailem'].map((t) => <li key={t} className="flex items-center gap-3"><Check size={20} className="shrink-0 text-indigo-300" aria-hidden="true" />{t}</li>)}
                        </ul>
                        <p className="mt-7 flex items-center gap-2 text-sm text-indigo-200"><Lock size={14} aria-hidden="true" /> Zprávy a soubory jsou šifrované end-to-end.</p>
                        <Link href="/pro-klienty" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-50">Jak to vidí klient <ArrowRight size={15} aria-hidden="true" /></Link>
                    </div>
                    <div className="flex justify-center"><ClientMock /></div>
                </div>
            </section>

            {/* 4. Stručný ceník, podrobnosti na samostatné stránce */}
            <PricingTeaser />

            <FinalCta />
            <SiteFooter />
        </div>
    );
}
