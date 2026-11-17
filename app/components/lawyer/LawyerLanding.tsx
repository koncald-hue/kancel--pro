'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Banknote, CalendarClock, Check, ChevronDown, FileSignature, FileText, FolderInput, Inbox, KeyRound, Landmark, Lock, Mail, MailCheck, Scale, ShieldCheck, Sparkles, Upload, Users } from 'lucide-react';
import { useAuth } from '../site/AuthContext';
import LawyerPricing from './LawyerPricing';
import { RETENTION_MONTHS } from '@/lib/company';
import { CaseMock, ClientMock, DashboardMock, WorkMock } from './LandingMockups';

const serif = 'font-[family-name:var(--font-display)] font-normal tracking-[-0.01em]';

// Co se v hlavičce střídá: jeden den, kdy Kancelář pracuje sama
const FLOW: [typeof Inbox, string, string, string][] = [
    [MailCheck, 'Datová zpráva', 'Okresní soud Plzeň-město · Rozsudek', 'text-sky-300'],
    [CalendarClock, 'Lhůta nalezena', 'Odvolání do 15 dnů · pondělí 7. 12. (posunuto z neděle)', 'text-amber-300'],
    [FolderInput, 'Založeno do věci', 'Novák proti Dvořákovi · příloha a chronologie', 'text-violet-300'],
    [Sparkles, 'Návrh výkazu', 'Studium rozsudku, příprava odvolání · 1:15 h', 'text-indigo-300'],
    [Banknote, 'Platba spárována', 'Faktura 2026-014 · 12 100 Kč podle variabilního symbolu', 'text-emerald-300'],
];

function LiveFlow() {
    const [step, setStep] = useState(0);
    const [still, setStill] = useState(false);
    useEffect(() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) { const t = window.setTimeout(() => { setStill(true); setStep(FLOW.length - 1); }, 0); return () => window.clearTimeout(t); }
        const id = window.setInterval(() => setStep((s) => (s + 1) % (FLOW.length + 2)), 1900);
        return () => window.clearInterval(id);
    }, []);
    return (
        <div className="relative mx-auto w-full max-w-md" aria-label="Ukázka: co Kancelář udělá sama během jednoho dne" role="img">
            <div className="absolute -inset-10 rounded-[3rem] bg-indigo-500/20 blur-3xl" aria-hidden="true" />
            <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl" aria-hidden="true">
                <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Dnes v Kanceláři</p>
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span> Běží</span>
                </div>
                <ol className="mt-4 space-y-2.5">
                    {FLOW.map(([Icon, title, detail, tone], i) => {
                        const shown = still || i <= step;
                        return (
                            <li key={title} className={`flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 transition-all duration-700 ${shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'} ${i === step && !still ? 'border-white/25 bg-white/[0.1]' : ''}`}>
                                <span className={`mt-0.5 rounded-xl bg-white/10 p-2 ${tone}`}><Icon size={16} /></span>
                                <span className="min-w-0"><span className="block text-sm font-semibold text-white">{title}</span><span className="block text-xs leading-relaxed text-white/60">{detail}</span></span>
                                {shown && <Check size={14} className="ml-auto mt-1 shrink-0 text-emerald-300" />}
                            </li>
                        );
                    })}
                </ol>
                <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/45">Každý krok vidíte a potvrzujete. Kancelář připraví, rozhodnutí je vaše.</p>
            </div>
        </div>
    );
}

// Jeden den v Kanceláři: časová osa s ukázkami
const DAY: { time: string; title: string; text: string; points: string[]; mock: React.ReactNode }[] = [
    { time: '8:30', title: 'Ráno víte, co hoří', text: 'Přehled ukáže lhůty, které se blíží, nové datové zprávy, neuhrazené faktury a čas, který jste včera nezapsali.', points: ['Lhůty seřazené podle naléhavosti', 'Svátky a jmeniny, ať nic nepřekvapí', 'Nevyfakturovaná práce v korunách'], mock: <DashboardMock /> },
    { time: '10:15', title: 'Datovka přijde, lhůta se spočítá', text: 'Kancelář přečte rozhodnutí, najde poučení o lhůtě, spočítá konec podle zákona a posune ho na pracovní den. Vy jen potvrdíte.', points: ['Datové schránky přímo v aplikaci', 'Lhůta s citací z rozhodnutí', 'Zpráva i příloha rovnou ve spisu'], mock: <CaseMock /> },
    { time: '14:00', title: 'Klient si vyřídí sám', text: 'Klient dostane soukromý odkaz. Nahraje podklady z mobilu, napíše zprávu a podepíše smlouvu, aniž by si cokoli instaloval.', points: ['End-to-end šifrovaná komunikace', 'Podpis dokumentu s dokladem', 'Žádné přeposílání e-mailů'], mock: <div className="py-4"><ClientMock /></div> },
    { time: '18:00', title: 'Výkaz se napíše sám', text: 'Kancelář ví, na čem jste dnes pracovali: datovky, e-maily, dokumenty, zprávy klientům. Navrhne výkaz po věcech a vy ho jedním kliknutím potvrdíte.', points: ['Čas a popis úkonu navržené', 'Nic se nezapíše bez potvrzení', 'Rovnou do vyúčtování'], mock: <WorkMock /> },
];

function DayTour() {
    const [i, setI] = useState(0);
    const d = DAY[i];
    return (
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
                <div className="flex gap-1.5 overflow-x-auto rounded-2xl bg-slate-100 p-1.5" role="tablist" aria-label="Části dne">
                    {DAY.map((x, j) => (
                        <button key={x.time} type="button" role="tab" aria-selected={i === j} onClick={() => setI(j)} className={`flex-1 shrink-0 rounded-xl px-3 py-2.5 text-center transition cursor-pointer ${i === j ? 'bg-white shadow-sm' : 'hover:bg-white/60'}`}>
                            <span className={`block font-mono text-sm font-semibold ${i === j ? 'text-indigo-700' : 'text-slate-500'}`}>{x.time}</span>
                        </button>
                    ))}
                </div>
                <div key={d.time} className="mt-8 motion-safe:animate-[fadeUp_.5s_ease-out]" role="tabpanel">
                    <h3 className={`${serif} text-4xl leading-tight text-slate-900 sm:text-5xl`}>{d.title}</h3>
                    <p className="mt-4 text-lg leading-relaxed text-slate-600">{d.text}</p>
                    <ul className="mt-6 space-y-2.5">
                        {d.points.map((p) => <li key={p} className="flex items-center gap-3 text-slate-700"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-700"><Check size={14} aria-hidden="true" /></span>{p}</li>)}
                    </ul>
                    <div className="mt-8 flex gap-2">
                        <button type="button" onClick={() => setI((i + DAY.length - 1) % DAY.length)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">Předchozí</button>
                        <button type="button" onClick={() => setI((i + 1) % DAY.length)} className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 cursor-pointer">Další část dne <ArrowRight size={14} aria-hidden="true" /></button>
                    </div>
                </div>
            </div>
            <div key={`m-${d.time}`} className="min-w-0 motion-safe:animate-[fadeUp_.5s_ease-out]">{d.mock}</div>
        </div>
    );
}

// Funkce v mřížce různých velikostí
const BENTO: { icon: typeof Inbox; title: string; text: string; wide?: boolean; dark?: boolean }[] = [
    { icon: MailCheck, title: 'Datové schránky uvnitř', text: 'Přijaté i odeslané zprávy, přihlášení jménem a heslem nebo Mobilním klíčem. Zprávu i přílohu jedním kliknutím do věci.', wide: true, dark: true },
    { icon: CalendarClock, title: 'Lhůty z rozhodnutí', text: 'Najde poučení, spočítá konec, posune na pracovní den a ukáže citaci.' },
    { icon: Mail, title: 'E-mail ve spisu', text: 'Gmail, Seznam a další. Čtete, odpovídáte a ukládáte do věci bez přepínání.' },
    { icon: Sparkles, title: 'Výkaz, který se píše sám', text: 'Z toho, na čem jste pracovali, navrhne čas a popis úkonu. Vy potvrdíte.', wide: true },
    { icon: FileSignature, title: 'Podpis na dálku', text: 'Klient podepíše v portálu, vy dostanete PDF s dokladem o podpisu.' },
    { icon: Banknote, title: 'Peníze pod kontrolou', text: 'QR platba na faktuře, párování plateb z banky, upomínky a export pro účetní (ISDOC).' },
    { icon: FileText, title: 'Vzory s Wordem', text: 'Smlouvy, plné moci, výzvy. Pole se vyplní z věci a klienta, výstup je hotový dokument.' },
    { icon: Landmark, title: 'Rejstříky po ruce', text: 'ARES, insolvenční rejstřík a katastr přímo u klienta i věci.' },
    { icon: Users, title: 'Kancelář jako tým', text: 'Šifrovaný chat, sdílené věci s kolegy a role. Každý vidí jen to, co má.' },
    { icon: Upload, title: 'Přechod za odpoledne', text: 'Import klientů, věcí, lhůt a času z Excelu, CSV i jiných programů. Jde vrátit.' },
];

function Calculator() {
    const [rate, setRate] = useState(2000);
    const [lost, setLost] = useState(20);
    const month = Math.round((rate * lost) / 60 * 20 / 100) * 100;
    const fmt = (n: number) => new Intl.NumberFormat('cs-CZ').format(n);
    return (
        <div className="grid gap-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div className="space-y-7">
                <label className="block">
                    <span className="flex items-baseline justify-between text-sm font-semibold text-slate-700">Vaše hodinová sazba <span className="font-mono text-lg text-slate-900">{fmt(rate)} Kč</span></span>
                    <input type="range" min={800} max={6000} step={100} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="mt-3 w-full accent-indigo-700" />
                </label>
                <label className="block">
                    <span className="flex items-baseline justify-between text-sm font-semibold text-slate-700">Kolik minut denně nezapíšete <span className="font-mono text-lg text-slate-900">{lost} min</span></span>
                    <input type="range" min={5} max={90} step={5} value={lost} onChange={(e) => setLost(Number(e.target.value))} className="mt-3 w-full accent-indigo-700" />
                    <span className="mt-2 block text-xs text-slate-500">Krátké e-maily, telefonáty, přečtené datovky a drobné úpravy dokumentů.</span>
                </label>
            </div>
            <div className="rounded-3xl bg-slate-950 p-7 text-center text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Měsíčně nevyfakturováno</p>
                <p className={`${serif} mt-3 text-6xl text-white`} aria-live="polite">{fmt(month)} Kč</p>
                <p className="mt-3 text-sm leading-relaxed text-white/60">při 20 pracovních dnech. Tohle je práce, kterou Kancelář pomáhá najít a zapsat.</p>
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
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => { const on = () => setScrolled(window.scrollY > 24); on(); window.addEventListener('scroll', on, { passive: true }); return () => window.removeEventListener('scroll', on); }, []);

    const cta = (light = false) => account
        ? <Link href="/kancelar" className={`group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold transition ${light ? 'bg-white text-slate-950 hover:bg-indigo-50' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>Otevřít Kancelář <ArrowRight size={16} className="transition group-hover:translate-x-0.5" aria-hidden="true" /></Link>
        : <button type="button" onClick={() => openLogin('register')} className={`group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold transition cursor-pointer ${light ? 'bg-white text-slate-950 hover:bg-indigo-50' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>Vyzkoušet 14 dní zdarma <ArrowRight size={16} className="transition group-hover:translate-x-0.5" aria-hidden="true" /></button>;

    return (
        <div className="bg-[#fbfaf7] text-slate-800">
            <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>

            <header className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${scrolled ? 'border-b border-white/10 bg-slate-950/80 backdrop-blur-xl' : 'bg-transparent'}`}>
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
                    <Link href="/" className="flex items-center gap-2.5 text-white"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-950"><Scale size={17} aria-hidden="true" /></span><span className={`${serif} text-2xl`}>Kancelář</span></Link>
                    <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex" aria-label="Sekce stránky">
                        <a href="#den" className="hover:text-white">Jak to funguje</a>
                        <a href="#funkce" className="hover:text-white">Funkce</a>
                        <a href="#bezpecnost" className="hover:text-white">Bezpečnost</a>
                        <a href="#cenik" className="hover:text-white">Ceník</a>
                    </nav>
                    <div className="flex items-center gap-2">
                        {account ? <Link href="/kancelar" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-indigo-50">Otevřít Kancelář</Link> : <>
                            <button type="button" onClick={() => openLogin('login')} className="rounded-full px-4 py-2 text-sm font-semibold text-white/80 hover:text-white cursor-pointer">Přihlásit se</button>
                            <button type="button" onClick={() => openLogin('register')} className="hidden rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-indigo-50 sm:block cursor-pointer">Zkusit zdarma</button>
                        </>}
                    </div>
                </div>
            </header>

            {/* Úvod */}
            <section className="relative overflow-hidden bg-slate-950 text-white">
                <div className="pointer-events-none absolute inset-0 opacity-[0.15] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" aria-hidden="true" />
                <div className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-indigo-600/25 blur-[120px]" aria-hidden="true" />
                <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-32 sm:px-6 sm:pt-40 lg:grid-cols-[1.15fr_1fr] lg:pb-32">
                    <div>
                        <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/70"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Software pro advokáty a advokátní kanceláře</p>
                        <h1 className={`${serif} mt-7 text-[3.4rem] leading-[0.98] sm:text-7xl lg:text-[5.4rem]`}>Kancelář, která <em className="italic text-amber-200">myslí</em> dopředu.</h1>
                        <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/65">Datové schránky, lhůty, e-maily, klienti a fakturace na jednom místě. Kancelář čte, počítá a připravuje. Vy rozhodujete.</p>
                        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                            {cta()}
                            <a href="#den" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold text-white hover:bg-white/5">Projít jeden den v Kanceláři</a>
                        </div>
                        <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/55">
                            {['14 dní zdarma, bez karty', 'Šifrovaná komunikace s klientem', 'Pro české právo, česky'].map((t) => <li key={t} className="flex items-center gap-2"><Check size={14} className="text-amber-200" aria-hidden="true" />{t}</li>)}
                        </ul>
                    </div>
                    <LiveFlow />
                </div>
                <div className="relative border-t border-white/10">
                    <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 py-6 text-center text-xs font-medium uppercase tracking-[0.14em] text-white/45 sm:px-6 md:grid-cols-5">
                        {['Datové schránky', 'Insolvenční rejstřík', 'ARES', 'Katastr nemovitostí', 'ISDOC a QR platby'].map((t) => <li key={t} className="py-1">{t}</li>)}
                    </ul>
                </div>
            </section>

            {/* Jeden den */}
            <section id="den" className="scroll-mt-20 py-24 sm:py-32" aria-labelledby="den-title">
                <div className="mx-auto max-w-6xl px-4 sm:px-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">Jak to funguje</p>
                    <h2 id="den-title" className={`${serif} mt-3 max-w-3xl text-5xl leading-[1.05] text-slate-900 sm:text-6xl`}>Jeden běžný den. O hodinu kratší.</h2>
                    <div className="mt-14"><DayTour /></div>
                </div>
            </section>

            {/* Funkce */}
            <section id="funkce" className="scroll-mt-20 border-y border-slate-200/70 bg-white py-24 sm:py-32" aria-labelledby="funkce-title">
                <div className="mx-auto max-w-6xl px-4 sm:px-6">
                    <div className="flex flex-wrap items-end justify-between gap-6">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">Funkce</p>
                            <h2 id="funkce-title" className={`${serif} mt-3 max-w-2xl text-5xl leading-[1.05] text-slate-900 sm:text-6xl`}>Všechno, co advokát dělá. Na jednom místě.</h2>
                        </div>
                        <p className="max-w-sm text-slate-600">Žádné přepínání mezi datovkou, e-mailem, Excelem a bankou. Věc drží pohromadě všechno, co k ní patří.</p>
                    </div>
                    <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {BENTO.map(({ icon: Icon, title, text, wide, dark }) => (
                            <li key={title} className={`group rounded-3xl border p-6 transition duration-300 hover:-translate-y-0.5 ${wide ? 'lg:col-span-2' : ''} ${dark ? 'border-slate-900 bg-slate-950 text-white' : 'border-slate-200 bg-[#fbfaf7] hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/60'}`}>
                                <span className={`inline-flex rounded-2xl p-3 ${dark ? 'bg-white/10 text-amber-200' : 'bg-white text-indigo-700 shadow-sm'}`}><Icon size={20} aria-hidden="true" /></span>
                                <h3 className={`mt-5 text-lg font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
                                <p className={`mt-2 text-sm leading-relaxed ${dark ? 'text-white/65' : 'text-slate-600'}`}>{text}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* Kalkulačka */}
            <section className="py-24 sm:py-32" aria-labelledby="kalk-title">
                <div className="mx-auto max-w-5xl px-4 sm:px-6">
                    <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">Spočítejte si to</p>
                    <h2 id="kalk-title" className={`${serif} mx-auto mt-3 max-w-3xl text-center text-5xl leading-[1.05] text-slate-900 sm:text-6xl`}>Kolik práce vám každý měsíc uteče?</h2>
                    <div className="mt-14"><Calculator /></div>
                </div>
            </section>

            {/* Bezpečnost */}
            <section id="bezpecnost" className="scroll-mt-20 bg-slate-950 py-24 text-white sm:py-32" aria-labelledby="bezp-title">
                <div className="mx-auto max-w-6xl px-4 sm:px-6">
                    <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-center">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/80">Bezpečnost</p>
                            <h2 id="bezp-title" className={`${serif} mt-3 text-5xl leading-[1.05] sm:text-6xl`}>Mlčenlivost není funkce. Je to základ.</h2>
                            <p className="mt-6 text-lg leading-relaxed text-white/60">Kancelář je postavená tak, aby k nejcitlivějším údajům neměl přístup nikdo jiný než vy a váš klient. Ani my.</p>
                        </div>
                        <ul className="grid gap-4 sm:grid-cols-2">
                            {([[Lock, 'End-to-end šifrování', 'Zprávy a soubory s klientem se šifrují ve vašem prohlížeči. Klíč nemáme.'], [KeyRound, 'Hesla jen u vás', 'Přístupy k datovce, bance a e-mailu jsou uložené zašifrované vaším heslem.'], [ShieldCheck, 'Doklady a stopy', 'Podpisy mají zapečetěný doklad, importy jdou vrátit, nic se neděje bez vašeho potvrzení.'], [BadgeCheck, 'Data zůstávají vaše', `Po skončení předplatného je máte ${RETENTION_MONTHS} měsíců k nahlížení a stažení.`]] as const).map(([Icon, t, d]) => (
                                <li key={t} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"><Icon size={20} className="text-amber-200" aria-hidden="true" /><h3 className="mt-4 font-semibold text-white">{t}</h3><p className="mt-2 text-sm leading-relaxed text-white/60">{d}</p></li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            {/* Ceník */}
            <section id="cenik" className="scroll-mt-20 py-24 sm:py-32" aria-label="Ceník">
                <div className="mx-auto max-w-6xl px-4 sm:px-6">
                    <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">Ceník</p>
                    <h2 className={`${serif} mx-auto mt-3 max-w-3xl text-center text-5xl leading-[1.05] text-slate-900 sm:text-6xl`}>Jedna cena. Všechno v ní.</h2>
                    <div className="mt-10"><LawyerPricing bare /></div>
                </div>
            </section>

            {/* Otázky */}
            <section className="border-t border-slate-200/70 bg-white py-24 sm:py-32" aria-labelledby="faq-title">
                <div className="mx-auto max-w-3xl px-4 sm:px-6">
                    <h2 id="faq-title" className={`${serif} text-center text-5xl leading-[1.05] text-slate-900`}>Časté otázky</h2>
                    <div className="mt-12 divide-y divide-slate-200 border-y border-slate-200">
                        {FAQ.map(([q, a]) => (
                            <details key={q} className="group py-5">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-slate-900">{q}<ChevronDown size={18} className="shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden="true" /></summary>
                                <p className="mt-3 leading-relaxed text-slate-600">{a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* Závěr */}
            <section className="px-4 py-24 sm:px-6">
                <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-slate-950 px-6 py-16 text-center text-white sm:px-16 sm:py-20">
                    <div className="pointer-events-none absolute -bottom-40 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-indigo-600/30 blur-[100px]" aria-hidden="true" />
                    <h2 className={`${serif} relative text-5xl leading-[1.05] sm:text-6xl`}>Zkuste si zítřek <em className="italic text-amber-200">už dnes</em>.</h2>
                    <p className="relative mx-auto mt-5 max-w-xl text-white/60">14 dní zdarma, bez karty a bez závazku. Data si během zkoušky převedete importem a nic nepřijde nazmar.</p>
                    <div className="relative mt-9 flex justify-center">{cta(true)}</div>
                </div>
            </section>

            <footer className="border-t border-slate-200/70 px-4 py-10 sm:px-6">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-xs text-slate-500 md:flex-row">
                    <p className="flex items-center gap-2 text-slate-700"><Scale size={14} aria-hidden="true" /><span className={`${serif} text-lg`}>Kancelář</span></p>
                    <p className="flex flex-wrap justify-center gap-x-5 gap-y-1 font-medium"><Link href="/obchodni-podminky" className="hover:text-slate-800">Obchodní podmínky</Link><Link href="/zpracovani-osobnich-udaju" className="hover:text-slate-800">Zpracování osobních údajů</Link><Link href="/ochrana-osobnich-udaju" className="hover:text-slate-800">Ochrana soukromí</Link></p>
                </div>
                <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-slate-400">Kancelář slouží k organizaci práce a nenahrazuje právní poradenství ani úsudek advokáta. Lhůty a výpočty jsou pomůckou ke kontrole. Ukázky rozhraní obsahují smyšlená jména a údaje.</p>
            </footer>
        </div>
    );
}
