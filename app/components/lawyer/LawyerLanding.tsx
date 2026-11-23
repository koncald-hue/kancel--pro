'use client';

import Link from 'next/link';
import { ArrowRight, CalendarClock, Check, FolderOpen, Lock, Receipt, Scale, ShieldCheck, Smartphone, Undo2, UserPlus, Users, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Prices } from '@/lib/plans';
import PricingTeaser from './PricingTeaser';
import { FinalCta, SiteFooter, SiteHeader, StartButton } from './LandingChrome';
import { CaseMock, ClientMock } from './LandingMockups';
import LandingFlow from './LandingFlow';

// Co aplikace dělá, v lidské řeči. Čtyři věci, které advokát denně řeší.
const FOUR: { icon: typeof Scale; tone: string; title: string; text: string }[] = [
    { icon: FolderOpen, tone: 'bg-slate-100 text-indigo-800', title: 'Vedete spisy', text: 'Každý spis má své místo: soubory, e-maily, datové zprávy, poznámky a kontakty.' },
    { icon: CalendarClock, tone: 'bg-slate-100 text-indigo-800', title: 'Hlídáte lhůty', text: 'Lhůty se spočítají a posunou na pracovní den. Včas víte, co hoří.' },
    { icon: Users, tone: 'bg-slate-100 text-indigo-800', title: 'Komunikujete s klientem', text: 'Klient nahraje podklady a píše zprávy přes soukromý odkaz, bez registrace.' },
    { icon: Receipt, tone: 'bg-slate-100 text-indigo-800', title: 'Účtujete práci', text: 'Výkazy, faktury a kontrola, kdo už zaplatil.' },
];

const CMP: [string, string, string][] = [
    ['Lhůty', 'Počítáte ručně a hlídáte v kalendáři', 'Spočítají se a posunou na pracovní den'],
    ['Podklady od klienta', 'Přílohy v e-mailu', 'Klient je nahraje přes soukromý odkaz'],
    ['Čas a faktury', 'Tabulka a ruční fakturace', 'Výkazy, faktura, kontrola plateb'],
    ['Data o klientech', 'Rozeseta po složkách a schránkách', 'Na jednom místě, šifrovaná'],
];

const ALSO = ['Noví klienti ze Studuj právo', 'Datové schránky', 'E-mail ve spisu', 'Podpis dokumentů', 'Vzory ve Wordu', 'Insolvenční rejstřík', 'ARES a katastr', 'Import z Excelu', 'Práce v týmu'];

export default function LawyerLanding({ initialPrices, reviews }: { initialPrices?: Prices; reviews?: ReactNode }) {
    return (
        <div className="serif-headings bg-white text-slate-800">
            <SiteHeader />

            {/* 1. Co to je: jedna věta a jeden obrázek */}
            <section className="overflow-hidden border-b border-slate-200 bg-slate-50">
                <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_1.1fr] lg:pb-28">
                    <div>
                        <p className="text-sm font-semibold text-indigo-700">Pracovní prostor pro advokáty</p>
                        <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">Všechna vaše práce na jednom místě.</h1>
                        <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600">Kancelář hlídá lhůty, počítá odpracované hodiny, vystaví fakturu a pošle klientovi odkaz, přes který nahraje podklady a podepíše. <strong className="font-semibold text-slate-800">A přivede vám nové klienty</strong> z bezplatné právní poradny Studuj právo.</p>
                        <a href="#novi-klienti" className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3.5 py-1.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-200"><UserPlus size={15} aria-hidden="true" /> Noví klienti bez provizí: jak to funguje <ArrowRight size={14} aria-hidden="true" /></a>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <StartButton />
                            <Link href="/funkce" className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-[15px] font-semibold text-slate-800 hover:bg-slate-50">Co všechno umí</Link>
                        </div>
                        <p className="mt-4 text-sm text-slate-500">14 dní zdarma · bez platební karty · bez závazku · data šifrovaná, <Link href="/zabezpeceni" className="underline hover:text-slate-700">jak je chráníme</Link></p>
                    </div>
                    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
                        <div className="lg:pr-24"><CaseMock /></div>
                        <div className="mt-6 flex justify-center lg:absolute lg:-bottom-12 lg:right-0 lg:mt-0"><div className="scale-[0.82] origin-top lg:origin-bottom-right"><ClientMock /></div></div>
                    </div>
                </div>
            </section>

            {/* Noví klienti: Kancelář se zaplatí sama, protože přivádí poptávky ze Studuj právo */}
            <section id="novi-klienti" className="scroll-mt-20 bg-emerald-700 px-4 py-16 text-white sm:px-6 sm:py-20" aria-labelledby="klienti-title">
                <div className="mx-auto max-w-6xl">
                    <p className="text-sm font-semibold text-emerald-200">V ceně předplatného</p>
                    <h2 id="klienti-title" className="mt-3 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Kancelář vám přivede nové klienty. Bez provizí.</h2>
                    <p className="mt-4 max-w-3xl text-lg leading-relaxed text-emerald-50">Na studujpravo.cz se lidé dozvědí, jaký mají právní problém a co s ním dělat. Každý den se ptají v bezplatné poradně: výpověď z bytu, rozvod, pokuta, dluh, pracovní spor. Kdo potřebuje advokáta, dostane katalog advokátů ze svého oboru a kraje. S Kanceláří Pro jste v něm i vy.</p>
                    <ol className="mt-10 grid gap-4 sm:grid-cols-3">
                        {[
                            ['Člověk se zeptá v poradně', 'Popíše svůj problém. Když je potřeba advokát, pošleme mu katalog advokátů z jeho oboru a kraje.'],
                            ['Vybere si vás', 'Automaticky se zobrazíte v katalogu, a to s fotkou, svými obory a cenou první konzultace. Zájemce si vás vybere a rovnou vám pošle popis své věci.'],
                            ['Přijmete jedním klikem', 'Poptávka vám přijde do Kanceláře i e-mailem. Přijetím vznikne klient i spis a zájemce dostane vaše kontakty.'],
                        ].map(([t, d], i) => (
                            <li key={t} className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/15">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-emerald-800">{i + 1}</span>
                                <p className="mt-3 font-semibold">{t}</p>
                                <p className="mt-1 text-sm leading-relaxed text-emerald-50">{d}</p>
                            </li>
                        ))}
                    </ol>
                    <ul className="mt-8 grid gap-2 text-sm text-emerald-50 sm:grid-cols-3">
                        {['Žádná provize ani platba za poptávku: celý honorář je váš', 'Zájemce už ví, co potřebuje: z poradny má popsaný problém', 'Nechcete nové klienty? Katalog si vypnete jedním kliknutím'].map((t) => <li key={t} className="flex items-start gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-200" aria-hidden="true" />{t}</li>)}
                    </ul>
                    <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <StartButton light />
                        <p className="text-sm text-emerald-100">Jediný nový klient obvykle pokryje předplatné na dlouho dopředu.</p>
                    </div>
                </div>
            </section>

            {/* Důvěra: mlčenlivost je pro advokáta podmínka, proto hned za úvodem */}
            <section className="border-y border-slate-200 bg-white px-4 py-12 sm:px-6" aria-labelledby="duvera-title">
                <div className="mx-auto max-w-6xl">
                    <h2 id="duvera-title" className="max-w-3xl text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Mlčenlivost je základ vaší práce. Proto je na prvním místě.</h2>
                    <ul className="mt-8 grid gap-4 md:grid-cols-3">
                        {[
                            { icon: Lock, title: 'Komunikace s klientem je end-to-end šifrovaná', text: 'Zprávy a soubory se šifrují ve vašem prohlížeči. Provozovatel je přečíst nemůže.' },
                            { icon: ShieldCheck, title: 'Každý vidí jen svá data', text: 'Přístup ke spisům hlídá přímo databáze, ne jen aplikace. Kolega vidí jen to, co mu sdílíte. Přihlášení lze chránit druhým krokem.' },
                            { icon: Undo2, title: 'Jasně, co je a co není šifrované', text: 'Na jedné stránce rozepisujeme, co provozovatel technicky vidí a kdo data zpracovává. Nepíšeme „vše je šifrované“.' },
                        ].map(({ icon: Icon, title, text }) => (
                            <li key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-indigo-700"><Icon size={20} aria-hidden="true" /></span>
                                <h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3>
                                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-6 text-sm text-slate-600"><Link href="/zabezpeceni" className="font-semibold text-indigo-700 underline hover:text-indigo-900">Přečíst celé zabezpečení</Link> · Vyrobeno v ČR · Zrušíte kdykoli</p>
                </div>
            </section>

            {/* 2. Čtyři věci, které za vás vyřeší */}
            <section className="px-4 py-20 sm:px-6 sm:py-24" aria-labelledby="co-title">
                <div className="mx-auto max-w-6xl">
                    <h2 id="co-title" className="max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Čtyři věci, které advokát dělá každý den</h2>
                    <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                        {FOUR.map(({ icon: Icon, tone, title, text }) => (
                            <li key={title}>
                                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 ${tone}`}><Icon size={22} aria-hidden="true" /></span>
                                <h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3>
                                <p className="mt-2 leading-relaxed text-slate-600">{text}</p>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-14 text-sm font-semibold text-slate-500">K tomu navíc <Link href="/funkce" className="ml-2 text-indigo-700 hover:underline">Všechny funkce →</Link></p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                        {ALSO.map((t) => <li key={t} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700">{t}</li>)}
                    </ul>
                </div>
            </section>

            {/* Ukázka v pohybu */}
            <section className="px-4 py-16 sm:px-6" aria-labelledby="flow-title">
                <div className="mx-auto max-w-6xl">
                    <h2 id="flow-title" className="max-w-2xl text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Jak to funguje v praxi</h2>
                    <div className="mt-8"><LandingFlow /></div>
                </div>
            </section>

            {/* Excel a papír proti Kanceláři */}
            <section className="bg-slate-50 px-4 py-16 sm:px-6" aria-labelledby="cmp-title">
                <div className="mx-auto max-w-3xl">
                    <h2 id="cmp-title" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Proti Excelu a papíru</h2>
                    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3"> </th><th className="px-4 py-3">Excel a e-mail</th><th className="px-4 py-3 text-indigo-800">Kancelář</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">
                                {CMP.map(([k, a, b]) => (
                                    <tr key={k}>
                                        <th scope="row" className="px-4 py-3 font-semibold text-slate-900">{k}</th>
                                        <td className="px-4 py-3 text-slate-600"><X size={14} className="mr-1 inline text-rose-600" aria-hidden="true" />{a}</td>
                                        <td className="px-4 py-3 text-slate-900"><Check size={14} className="mr-1 inline text-emerald-600" aria-hidden="true" />{b}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* 3. Klient: barevný pás s telefonem */}
            <section className="bg-indigo-700 text-white" aria-labelledby="klient-title">
                <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-2">
                    <div>
                        <p className="flex items-center gap-2 text-sm font-semibold text-indigo-200"><Smartphone size={16} aria-hidden="true" /> Pro vaše klienty</p>
                        <h2 id="klient-title" className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Klient vidí svůj spis v telefonu. Bez registrace.</h2>
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
            {reviews}
            <PricingTeaser initialPrices={initialPrices} />

            <FinalCta />
            <SiteFooter />
        </div>
    );
}
