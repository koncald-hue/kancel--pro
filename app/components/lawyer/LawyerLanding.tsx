'use client';

import Link from 'next/link';
import { ArrowRight, CalendarClock, Check, ChevronDown, FolderOpen, Lock, Receipt, Scale, Smartphone, Users } from 'lucide-react';
import { useAuth } from '../site/AuthContext';
import LawyerPricing from './LawyerPricing';
import { RETENTION_MONTHS } from '@/lib/company';
import { CaseMock, ClientMock } from './LandingMockups';

// Co aplikace dělá, v lidské řeči. Čtyři věci, které advokát denně řeší.
const FOUR: { icon: typeof Scale; tone: string; title: string; text: string }[] = [
    { icon: FolderOpen, tone: 'bg-indigo-100 text-indigo-700', title: 'Vedete spisy', text: 'Každá věc má své místo: soubory, e-maily, datové zprávy, poznámky a kontakty.' },
    { icon: CalendarClock, tone: 'bg-amber-100 text-amber-700', title: 'Hlídáte lhůty', text: 'Lhůty se spočítají a posunou na pracovní den. Včas víte, co hoří.' },
    { icon: Users, tone: 'bg-sky-100 text-sky-700', title: 'Komunikujete s klientem', text: 'Klient nahraje podklady a píše zprávy přes soukromý odkaz, bez registrace.' },
    { icon: Receipt, tone: 'bg-emerald-100 text-emerald-700', title: 'Účtujete práci', text: 'Výkazy, faktury s QR platbou a kontrola, kdo už zaplatil.' },
];

const ALSO = ['Datové schránky', 'E-mail ve spisu', 'Podpis dokumentů', 'Vzory ve Wordu', 'Insolvenční rejstřík', 'ARES a katastr', 'Import z Excelu', 'Práce v týmu'];

const FAQ: [string, string][] = [
    ['Musím něco instalovat?', 'Ne. Kancelář běží v prohlížeči na počítači i v telefonu. Klienti nepotřebují účet ani aplikaci, stačí jim odkaz.'],
    ['Jak převedu data ze současného programu?', 'Klienty, věci, lhůty i odpracovaný čas nahrajete z Excelu, CSV nebo kontaktů v telefonu. Před importem uvidíte náhled a jde ho vrátit zpět.'],
    ['Spočítá Kancelář lhůty za mě?', 'Navrhne je podle obecných pravidel a ukáže, z čeho vycházela. Každou lhůtu potvrzujete vy a za její dodržení odpovídáte vy. Kancelář je pomocník, ne náhrada advokáta.'],
    ['Co když přestanu platit?', `Funkce se zamknou, ale data zůstanou ${RETENTION_MONTHS} měsíců k nahlížení a stažení. Po obnovení předplatného pokračujete, kde jste skončili.`],
];

export default function LawyerLanding() {
    const { account, openLogin } = useAuth();
    const cta = (cls = 'px-6 py-3 text-[15px]', light = false) => account
        ? <Link href="/kancelar" className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold ${cls} ${light ? 'bg-white text-indigo-800 hover:bg-indigo-50' : 'bg-indigo-700 text-white hover:bg-indigo-800'}`}>Otevřít Kancelář <ArrowRight size={16} aria-hidden="true" /></Link>
        : <button type="button" onClick={() => openLogin('register')} className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold cursor-pointer ${cls} ${light ? 'bg-white text-indigo-800 hover:bg-indigo-50' : 'bg-indigo-700 text-white hover:bg-indigo-800'}`}>Vyzkoušet 14 dní zdarma <ArrowRight size={16} aria-hidden="true" /></button>;

    return (
        <div className="bg-white text-slate-800">
            <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                    <Link href="/" className="flex items-center gap-2.5 font-bold text-slate-900"><span className="rounded-lg bg-indigo-700 p-1.5 text-white"><Scale size={18} aria-hidden="true" /></span> Kancelář</Link>
                    <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex" aria-label="Sekce stránky">
                        <a href="#co" className="hover:text-slate-900">Co umí</a>
                        <a href="#klient" className="hover:text-slate-900">Pro klienty</a>
                        <a href="#cenik" className="hover:text-slate-900">Ceník</a>
                    </nav>
                    <div className="flex items-center gap-2">
                        {!account && <button type="button" onClick={() => openLogin('login')} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">Přihlásit se</button>}
                        <span className="hidden sm:block">{cta('px-4 py-2 text-sm')}</span>
                    </div>
                </div>
            </header>

            {/* 1. Co to je: jedna věta a jeden obrázek */}
            <section className="overflow-hidden bg-gradient-to-b from-indigo-50/70 to-white">
                <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_1.1fr] lg:pb-28">
                    <div>
                        <p className="text-sm font-semibold text-indigo-700">Pracovní prostor pro advokáty</p>
                        <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">Všechna vaše práce na jednom místě.</h1>
                        <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600">Spisy, lhůty, klienti a faktury. Nahrazuje Excel, složky v e-mailu a papírový kalendář.</p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            {cta()}
                            <a href="#co" className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-[15px] font-semibold text-slate-800 hover:bg-slate-50">Co všechno umí</a>
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
            <section id="co" className="scroll-mt-16 px-4 py-20 sm:px-6 sm:py-24" aria-labelledby="co-title">
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
                    <p className="mt-14 text-sm font-semibold text-slate-500">K tomu navíc</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                        {ALSO.map((t) => <li key={t} className="rounded-full border border-slate-200 px-3.5 py-1.5 text-sm text-slate-700">{t}</li>)}
                    </ul>
                </div>
            </section>

            {/* 3. Klient: barevný pás s telefonem */}
            <section id="klient" className="scroll-mt-16 bg-indigo-700 text-white" aria-labelledby="klient-title">
                <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-2">
                    <div>
                        <p className="flex items-center gap-2 text-sm font-semibold text-indigo-200"><Smartphone size={16} aria-hidden="true" /> Pro vaše klienty</p>
                        <h2 id="klient-title" className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Klient vidí svou věc v telefonu. Bez registrace.</h2>
                        <ul className="mt-7 space-y-3 text-lg text-indigo-50">
                            {['Pošlete mu odkaz', 'Nahraje podklady a napíše zprávu', 'Podepíše smlouvu', 'Vy nic nepřeposíláte e-mailem'].map((t) => <li key={t} className="flex items-center gap-3"><Check size={20} className="shrink-0 text-indigo-300" aria-hidden="true" />{t}</li>)}
                        </ul>
                        <p className="mt-7 flex items-center gap-2 text-sm text-indigo-200"><Lock size={14} aria-hidden="true" /> Zprávy a soubory jsou šifrované end-to-end.</p>
                    </div>
                    <div className="flex justify-center"><ClientMock /></div>
                </div>
            </section>

            {/* 4. Ceník */}
            <section id="cenik" className="scroll-mt-16 bg-slate-50 px-4 py-20 sm:px-6 sm:py-24" aria-labelledby="cenik-title">
                <div className="mx-auto max-w-6xl">
                    <h2 id="cenik-title" className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Jednoduchý ceník</h2>
                    <div className="mt-6"><LawyerPricing bare /></div>
                </div>
            </section>

            {/* 5. Otázky */}
            <section className="px-4 py-20 sm:px-6 sm:py-24" aria-labelledby="faq-title">
                <div className="mx-auto max-w-3xl">
                    <h2 id="faq-title" className="text-center text-3xl font-bold tracking-tight text-slate-900">Časté otázky</h2>
                    <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
                        {FAQ.map(([q, a]) => (
                            <details key={q} className="group py-5">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold text-slate-900">{q}<ChevronDown size={18} className="shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden="true" /></summary>
                                <p className="mt-3 leading-relaxed text-slate-600">{a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            <section className="px-4 pb-20 sm:px-6">
                <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-3xl bg-indigo-50 px-6 py-14 text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Vyzkoušejte to na své vlastní věci</h2>
                    <p className="max-w-lg text-slate-600">14 dní zdarma, bez karty a bez závazku.</p>
                    {cta()}
                </div>
            </section>

            <footer className="border-t border-slate-100 px-4 py-8 text-center text-xs leading-relaxed text-slate-500 sm:px-6">
                <p>Kancelář slouží k organizaci práce a nenahrazuje právní poradenství ani úsudek advokáta. Lhůty a výpočty jsou pomůckou ke kontrole. Ukázky rozhraní obsahují smyšlená jména a údaje.</p>
                <p className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 font-semibold"><Link href="/obchodni-podminky" className="hover:text-slate-800">Obchodní podmínky</Link><Link href="/zpracovani-osobnich-udaju" className="hover:text-slate-800">Zpracování osobních údajů</Link><Link href="/ochrana-osobnich-udaju" className="hover:text-slate-800">Ochrana soukromí</Link></p>
            </footer>
        </div>
    );
}
