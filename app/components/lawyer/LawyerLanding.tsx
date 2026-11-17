'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Check, ChevronDown, FileArchive, FileText, KeyRound, Landmark, Lock, Map as MapIcon, Scale, ShieldCheck, Upload, Users } from 'lucide-react';
import { useAuth } from '../site/AuthContext';
import LawyerPricing from './LawyerPricing';
import { RETENTION_MONTHS } from '@/lib/company';
import { ClientMock, WorkMock } from './LandingMockups';
import { DatovkaMock, InvoiceMock, MailMock, ProductDemo, RadarMock, SignMock } from './LandingDemo';

const serif = 'font-[family-name:var(--font-display)]';

// Hlavní funkce: text vlevo, skutečná ukázka rozhraní vpravo (střídavě)
const FEATURES: { kicker: string; title: string; text: string; points: string[]; mock: React.ReactNode }[] = [
    { kicker: 'Datové schránky a lhůty', title: 'Z rozhodnutí rovnou lhůta v kalendáři', text: 'Datové zprávy čtete přímo v Kanceláři. U rozhodnutí aplikace najde poučení o lhůtě, spočítá její konec a posune ho na pracovní den. Ukáže přesnou větu, ze které vycházela, a uloží až po vašem potvrzení.', points: ['Přihlášení heslem nebo Mobilním klíčem', 'Zpráva i příloha jedním kliknutím do věci', 'Svátky a víkendy podle zákona'], mock: <DatovkaMock /> },
    { kicker: 'E-mail', title: 'Pošta tam, kde je spis', text: 'Připojíte Gmail, Seznam nebo vlastní doménu a e-maily čtete i píšete v aplikaci. Kancelář pozná klienta podle adresy a nabídne, do které věci zprávu i přílohy uložit.', points: ['Odpověď se zapíše do chronologie věci', 'Přílohy rovnou mezi soubory spisu', 'Heslo uložené jen zašifrované'], mock: <MailMock /> },
    { kicker: 'Výkaz práce', title: 'Výkaz, který se napíše sám', text: 'Kancelář si všímá, na čem jste pracovali: přečtené datovky, odeslané e-maily, připravené dokumenty, zprávy klientům. Večer navrhne výkaz po věcech. Čas upravíte a jedním kliknutím potvrdíte.', points: ['Nic se nezapíše bez potvrzení', 'Zaokrouhlení podle vaší praxe', 'Rovnou do vyúčtování'], mock: <WorkMock /> },
    { kicker: 'Klient', title: 'Klient si podklady nahraje sám', text: 'Každá věc může mít soukromou stránku pro klienta. Vidí stav, nahraje dokumenty z telefonu, napíše zprávu a podepíše smlouvu. Bez registrace a bez přeposílání e-mailů.', points: ['Komunikace šifrovaná end-to-end', 'Podpis s dokladem o podpisu', 'Identifikace klienta pro AML'], mock: <div className="grid items-center gap-6 xl:grid-cols-[auto_1fr]"><ClientMock /><SignMock /></div> },
    { kicker: 'Peníze', title: 'Faktura, QR platba a kontrola úhrad', text: 'Z výkazu vystavíte fakturu s QR platbou. Platby z účtu se samy spárují podle variabilního symbolu, po splatnosti připraví upomínku a účetní dostane podklady včetně ISDOC.', points: ['Fio automaticky, ostatní banky výpisem', 'Upomínky s úrokem z prodlení', 'Rentabilita věcí a klientů'], mock: <InvoiceMock /> },
    { kicker: 'Radar', title: 'Víte o protistraně dřív než ostatní', text: 'Kancelář hlídá firmy a osoby ve vašich věcech v insolvenčním rejstříku a v ARES. Když dlužník vstoupí do insolvence nebo firma do likvidace, upozorní vás a navrhne lhůtu.', points: ['Dlužníci, protistrany i klienti', 'Upozornění přímo ve věci', 'Lhůtu vždy potvrzujete vy'], mock: <RadarMock /> },
];

const MORE: [typeof Scale, string, string][] = [
    [FileText, 'Vzory dokumentů', 'Smlouvy, plné moci, výzvy. Vyplní se z věci a klienta, výstup je upravený Word.'],
    [MapIcon, 'Katastr nemovitostí', 'Parcely a stavby na mapě i podle čísla, přímo u věci.'],
    [Users, 'Práce v týmu', 'Sdílené věci s kolegy, role a šifrovaný chat kanceláře.'],
    [Upload, 'Přechod za odpoledne', 'Import klientů, věcí, lhůt a času z Excelu nebo jiného programu.'],
    [FileArchive, 'Předání spisu', 'Souhrn věci s očíslovanými přílohami pro soud, úřad nebo kolegu.'],
    [Landmark, 'ARES a insolvence', 'Údaje o firmě jedním kliknutím, hlídání klientů v insolvenčním rejstříku.'],
];

function Calculator() {
    const [rate, setRate] = useState(2000);
    const [lost, setLost] = useState(20);
    const month = Math.round((rate * lost) / 60 * 20 / 100) * 100;
    const fmt = (n: number) => new Intl.NumberFormat('cs-CZ').format(n);
    return (
        <div className="grid gap-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div className="space-y-7">
                <label className="block">
                    <span className="flex items-baseline justify-between text-sm font-medium text-slate-700">Vaše hodinová sazba <span className="text-base font-semibold text-slate-900 tabular-nums">{fmt(rate)} Kč</span></span>
                    <input type="range" min={800} max={6000} step={100} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="mt-3 w-full accent-indigo-700" />
                </label>
                <label className="block">
                    <span className="flex items-baseline justify-between text-sm font-medium text-slate-700">Kolik minut denně nezapíšete <span className="text-base font-semibold text-slate-900 tabular-nums">{lost} min</span></span>
                    <input type="range" min={5} max={90} step={5} value={lost} onChange={(e) => setLost(Number(e.target.value))} className="mt-3 w-full accent-indigo-700" />
                    <span className="mt-2 block text-xs text-slate-500">Krátké e-maily, telefonáty, přečtené datovky, drobné úpravy dokumentů.</span>
                </label>
            </div>
            <div className="rounded-xl bg-indigo-50 p-7 text-center">
                <p className="text-sm font-medium text-indigo-900/70">Za měsíc nevyfakturováno</p>
                <p className={`${serif} mt-2 text-5xl font-semibold text-indigo-950 tabular-nums`} aria-live="polite">{fmt(month)} Kč</p>
                <p className="mt-3 text-sm text-indigo-900/70">při 20 pracovních dnech</p>
            </div>
            <p className="text-xs text-slate-400 lg:col-span-2">Orientační výpočet z čísel, která sami zadáte. Skutečný přínos závisí na vaší praxi.</p>
        </div>
    );
}

const FAQ: [string, string][] = [
    ['Musím něco instalovat?', 'Ne. Kancelář běží v prohlížeči na počítači i v telefonu. Klienti nepotřebují účet ani aplikaci, stačí jim odkaz.'],
    ['Funguje s mou datovou schránkou?', 'Ano. Přihlásíte se jménem a heslem, nebo Mobilním klíčem eGovernmentu. Přihlašovací údaje se ukládají jen zašifrované vaším heslem.'],
    ['Jak převedu data ze současného programu?', 'Klienty, věci, lhůty, kontakty i odpracovaný čas nahrajete z Excelu, CSV nebo kontaktů v telefonu. Před importem uvidíte náhled a import jde jedním krokem vrátit.'],
    ['Spočítá Kancelář lhůty za mě?', 'Navrhne je podle obecných pravidel a ukáže, z čeho vycházela. Každou lhůtu ale potvrzujete vy a za její dodržení odpovídáte vy. Kancelář je pomocník, ne náhrada advokáta.'],
    ['Co když přestanu platit?', `Funkce se zamknou, ale data zůstanou ${RETENTION_MONTHS} měsíců k nahlížení a stažení. Po obnovení předplatného pokračujete, kde jste skončili.`],
];

export default function LawyerLanding() {
    const { account, openLogin } = useAuth();
    const cta = (big = true) => account
        ? <Link href="/kancelar" className={`inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-700 font-semibold text-white hover:bg-indigo-800 ${big ? 'px-6 py-3 text-[15px]' : 'px-4 py-2 text-sm'}`}>Otevřít Kancelář <ArrowRight size={16} aria-hidden="true" /></Link>
        : <button type="button" onClick={() => openLogin('register')} className={`inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-700 font-semibold text-white hover:bg-indigo-800 cursor-pointer ${big ? 'px-6 py-3 text-[15px]' : 'px-4 py-2 text-sm'}`}>Vyzkoušet 14 dní zdarma <ArrowRight size={16} aria-hidden="true" /></button>;

    return (
        <div className="bg-[#faf9f6] text-slate-800">
            <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

            <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#faf9f6]/90 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                    <Link href="/" className="flex items-center gap-2 text-slate-900"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-700 text-white"><Scale size={16} aria-hidden="true" /></span><span className={`${serif} text-xl font-semibold`}>Kancelář</span></Link>
                    <nav className="hidden items-center gap-7 text-sm text-slate-600 md:flex" aria-label="Sekce stránky">
                        <a href="#funkce" className="hover:text-slate-900">Funkce</a>
                        <a href="#bezpecnost" className="hover:text-slate-900">Bezpečnost</a>
                        <a href="#cenik" className="hover:text-slate-900">Ceník</a>
                        <a href="#otazky" className="hover:text-slate-900">Otázky</a>
                    </nav>
                    <div className="flex items-center gap-2">
                        {!account && <button type="button" onClick={() => openLogin('login')} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer">Přihlásit se</button>}
                        <span className="hidden sm:block">{cta(false)}</span>
                    </div>
                </div>
            </header>

            {/* Úvod s klikatelnou ukázkou aplikace */}
            <section className="px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
                <div className="mx-auto max-w-3xl text-center">
                    <p className="text-sm font-medium text-indigo-700">Software pro advokáty a advokátní kanceláře</p>
                    <h1 className={`${serif} mt-4 text-[2.6rem] font-semibold leading-[1.08] text-slate-900 sm:text-6xl`}>Spisy, lhůty, datovky a fakturace v jednom okně</h1>
                    <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">Kancelář přečte rozhodnutí a navrhne lhůtu, uloží e-mail do správné věci, sepíše výkaz za den a pohlídá, kdo zaplatil. Vy jen kontrolujete a rozhodujete.</p>
                    <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        {cta()}
                        <a href="#funkce" className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-[15px] font-semibold text-slate-800 hover:bg-slate-50">Co všechno umí</a>
                    </div>
                    <p className="mt-4 text-sm text-slate-500">14 dní zdarma · bez platební karty · bez závazku</p>
                </div>
                <div className="mx-auto mt-14 max-w-5xl">
                    <ProductDemo />
                    <p className="mt-3 text-center text-sm text-slate-500">Klikněte v levém menu a projděte si aplikaci. Údaje jsou smyšlené.</p>
                </div>
            </section>

            <section className="border-y border-slate-200 bg-white">
                <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-y-2 px-4 py-6 text-center text-sm text-slate-500 sm:px-6 md:grid-cols-5">
                    {['Datové schránky', 'Insolvenční rejstřík', 'ARES', 'Katastr nemovitostí', 'ISDOC a QR platby'].map((t) => <li key={t} className="flex items-center justify-center gap-1.5"><Check size={14} className="text-indigo-600" aria-hidden="true" />{t}</li>)}
                </ul>
            </section>

            {/* Funkce střídavě s ukázkami */}
            <section id="funkce" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28" aria-labelledby="funkce-title">
                <div className="mx-auto max-w-6xl">
                    <h2 id="funkce-title" className={`${serif} mx-auto max-w-2xl text-center text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl`}>Co za vás Kancelář udělá</h2>
                    <div className="mt-16 space-y-24 sm:space-y-32">
                        {FEATURES.map((f, i) => (
                            <div key={f.title} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                                <div className={i % 2 ? 'lg:order-2' : ''}>
                                    <p className="text-sm font-semibold text-indigo-700">{f.kicker}</p>
                                    <h3 className={`${serif} mt-3 text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl`}>{f.title}</h3>
                                    <p className="mt-4 text-[17px] leading-relaxed text-slate-600">{f.text}</p>
                                    <ul className="mt-6 space-y-2.5">
                                        {f.points.map((p) => <li key={p} className="flex items-start gap-2.5 text-slate-700"><Check size={18} className="mt-0.5 shrink-0 text-indigo-600" aria-hidden="true" />{p}</li>)}
                                    </ul>
                                </div>
                                <div className={`min-w-0 ${i % 2 ? 'lg:order-1' : ''}`}>{f.mock}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Další funkce */}
            <section className="border-t border-slate-200 bg-white px-4 py-20 sm:px-6" aria-labelledby="dalsi-title">
                <div className="mx-auto max-w-6xl">
                    <h2 id="dalsi-title" className={`${serif} text-3xl font-semibold text-slate-900 sm:text-4xl`}>A k tomu</h2>
                    <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                        {MORE.map(([Icon, t, d]) => (
                            <li key={t} className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-indigo-700"><Icon size={18} aria-hidden="true" /></span><span><span className="block font-semibold text-slate-900">{t}</span><span className="mt-1 block text-sm leading-relaxed text-slate-600">{d}</span></span></li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* Kalkulačka */}
            <section className="px-4 py-20 sm:px-6 sm:py-28" aria-labelledby="kalk-title">
                <div className="mx-auto max-w-5xl">
                    <h2 id="kalk-title" className={`${serif} mx-auto max-w-2xl text-center text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl`}>Kolik práce vám každý měsíc uteče?</h2>
                    <p className="mx-auto mt-4 max-w-xl text-center text-slate-600">Drobné úkony se zapomínají zapsat nejčastěji. Výkaz, který se píše sám, je najde.</p>
                    <div className="mt-12"><Calculator /></div>
                </div>
            </section>

            {/* Bezpečnost */}
            <section id="bezpecnost" className="scroll-mt-20 border-y border-slate-200 bg-white px-4 py-20 sm:px-6 sm:py-28" aria-labelledby="bezp-title">
                <div className="mx-auto max-w-6xl">
                    <div className="max-w-2xl">
                        <h2 id="bezp-title" className={`${serif} text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl`}>Postavené na mlčenlivosti</h2>
                        <p className="mt-4 text-lg leading-relaxed text-slate-600">K nejcitlivějším údajům nemá přístup nikdo jiný než vy a váš klient. Ani provozovatel.</p>
                    </div>
                    <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                        {([[Lock, 'End-to-end šifrování', 'Zprávy a soubory s klientem se šifrují ve vašem prohlížeči. Klíč nemáme.'], [KeyRound, 'Hesla jen u vás', 'Přístupy k datovce, bance a e-mailu jsou uložené zašifrované vaším heslem.'], [ShieldCheck, 'Nic bez potvrzení', 'Lhůty, výkazy i párování plateb aplikace navrhne. Rozhodnutí je vždy vaše.'], [BadgeCheck, 'Data zůstávají vaše', `Po skončení předplatného je máte ${RETENTION_MONTHS} měsíců k nahlížení a stažení.`]] as const).map(([Icon, t, d]) => (
                            <li key={t} className="border-t-2 border-indigo-700 pt-5"><Icon size={20} className="text-indigo-700" aria-hidden="true" /><h3 className="mt-3 font-semibold text-slate-900">{t}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{d}</p></li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* Ceník */}
            <section id="cenik" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28" aria-labelledby="cenik-title">
                <div className="mx-auto max-w-6xl">
                    <h2 id="cenik-title" className={`${serif} mx-auto max-w-2xl text-center text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl`}>Jednoduchý ceník</h2>
                    <div className="mt-8"><LawyerPricing bare /></div>
                </div>
            </section>

            {/* Otázky */}
            <section id="otazky" className="scroll-mt-20 border-t border-slate-200 bg-white px-4 py-20 sm:px-6 sm:py-28" aria-labelledby="faq-title">
                <div className="mx-auto max-w-3xl">
                    <h2 id="faq-title" className={`${serif} text-center text-4xl font-semibold text-slate-900`}>Časté otázky</h2>
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

            {/* Závěr */}
            <section className="px-4 py-20 sm:px-6 sm:py-24">
                <div className="mx-auto max-w-4xl rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-14 text-center sm:px-12">
                    <h2 className={`${serif} text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl`}>Vyzkoušejte to na své vlastní věci</h2>
                    <p className="mx-auto mt-4 max-w-xl text-slate-600">14 dní zdarma, bez karty a bez závazku. Data si během zkoušky převedete importem a nic nepřijde nazmar.</p>
                    <div className="mt-8 flex justify-center">{cta()}</div>
                </div>
            </section>

            <footer className="border-t border-slate-200 bg-white px-4 py-10 sm:px-6">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-500 md:flex-row">
                    <p className="flex items-center gap-2 text-slate-800"><Scale size={15} className="text-indigo-700" aria-hidden="true" /><span className={`${serif} text-lg font-semibold`}>Kancelář</span></p>
                    <p className="flex flex-wrap justify-center gap-x-5 gap-y-1"><Link href="/obchodni-podminky" className="hover:text-slate-800">Obchodní podmínky</Link><Link href="/zpracovani-osobnich-udaju" className="hover:text-slate-800">Zpracování osobních údajů</Link><Link href="/ochrana-osobnich-udaju" className="hover:text-slate-800">Ochrana soukromí</Link></p>
                </div>
                <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-slate-400">Kancelář slouží k organizaci práce a nenahrazuje právní poradenství ani úsudek advokáta. Lhůty a výpočty jsou pomůckou ke kontrole. Ukázky rozhraní obsahují smyšlená jména a údaje.</p>
            </footer>
        </div>
    );
}
