'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Banknote, CalendarClock, Check, ChevronDown, FolderOpen, Landmark, Lock, ShieldAlert, Users } from 'lucide-react';
import { czk } from '@/lib/lawyer';
import { EMPTY_PRICES, PLANS, saving, type PlanId, type Prices } from '@/lib/plans';
import { EMPTY_FIRM_PRICES, FIRM_SIZES, type FirmPrices, type FirmSize } from '@/lib/firm';
import { useAuth } from '../site/AuthContext';
import { FinalCta, SiteFooter, SiteHeader } from './LandingChrome';

const GROUPS: { icon: typeof Users; tone: string; title: string; items: string[] }[] = [
    { icon: FolderOpen, tone: 'bg-indigo-100 text-indigo-700', title: 'Spisy a lhůty', items: ['Neomezený počet věcí a klientů', 'Lhůty s přesunem na pracovní den', 'Datové schránky přímo v aplikaci', 'Lhůty z rozhodnutí k potvrzení', 'Vzory dokumentů ve Wordu'] },
    { icon: Users, tone: 'bg-sky-100 text-sky-700', title: 'Klienti a komunikace', items: ['Soukromá stránka klienta bez registrace', 'Šifrované zprávy a soubory', 'Podpis dokumentů s dokladem', 'Identifikace klienta (AML)', 'E-mail ve spisu (Gmail, Seznam a další)'] },
    { icon: Banknote, tone: 'bg-emerald-100 text-emerald-700', title: 'Peníze', items: ['Výkazy práce a automatický návrh výkazu', 'Faktury s QR platbou a ISDOC', 'Párování plateb z banky, upomínky', 'Rentabilita věcí a klientů', 'Export podkladů pro účetní'] },
    { icon: Landmark, tone: 'bg-amber-100 text-amber-700', title: 'Přehled a rejstříky', items: ['Přehled dne s nejbližšími lhůtami', 'Právní novinky a změny zákonů', 'ARES a katastr nemovitostí', 'Import dat z Excelu a jiných programů', 'Sdílené věci pro kolegy v kanceláři'] },
];

const STEPS: [string, string][] = [['Vyzkoušíte 14 dní zdarma', 'Zaregistrujete se e-mailem. Žádná platební karta, žádný závazek.'], ['Vyplníte profil', 'Jméno, číslo ČAK, adresa kanceláře a údaje pro fakturaci. Jednou a na pár minut.'], ['Vyberete délku předplatného', 'Měsíční, půlroční nebo roční. Funkce jsou ve všech stejné, liší se cena za měsíc.'], ['Platíte předem, bez automatického strhávání', 'Po skončení zaplaceného období se nic nestrhne. Pokračujete, jen když chcete.']];

const FAQ: [string, string][] = [
    ['Musím při registraci zadat kartu?', 'Ne. Zkušební období trvá 14 dní a nechce po vás žádné platební údaje.'],
    ['Obnovuje se předplatné samo?', 'Jen když si to při platbě zvolíte. Tři dny předem vám pošleme upozornění a obnovování můžete kdykoli zrušit v Nastavení. Bez něj platíte předem na zvolené období a nic se nestrhává.'],
    ['Co se stane s daty, když přestanu platit?', 'Funkce se zamknou, ale vaše data zůstanou uložená k nahlížení a stažení. Po obnovení předplatného se zase odemknou.'],
    ['Liší se plány funkcemi?', 'Ne. Měsíční, půlroční i roční plán mají úplně stejné funkce. Delší období je jen levnější za měsíc.'],
    ['Je cena s DPH?', 'Zda a v jaké výši je DPH, uvidíte u objednávky a na daňovém dokladu, který po zaplacení dostanete.'],
    ['Jak funguje balíček pro kancelář?', 'Jedna platba za celou kancelář (3, 5 nebo 10 advokátů). Každý člen má vlastní účet, heslo a vlastní data, která vedoucí kanceláře nevidí. Věc může člen nasdílet kolegovi.'],
];

// Samostatná stránka s ceníkem: plány, co je v ceně, jak platba funguje a časté otázky
export default function PricingPage() {
    const { account, openLogin } = useAuth();
    const [prices, setPrices] = useState<Prices>(EMPTY_PRICES);
    const [firmPrices, setFirmPrices] = useState<FirmPrices>(EMPTY_FIRM_PRICES);
    const [mode, setMode] = useState<'solo' | 'firm'>('solo');
    const [size, setSize] = useState<FirmSize>(3);
    useEffect(() => {
        let alive = true;
        fetch('/api/lawyer-prices').then((r) => r.json()).then((p) => { if (alive) { setPrices({ ...EMPTY_PRICES, ...p }); setFirmPrices({ ...EMPTY_FIRM_PRICES, ...p.firm }); } }).catch(() => undefined);
        return () => { alive = false; };
    }, []);
    const table = mode === 'firm' ? firmPrices[size] : prices;
    const perMonth = (id: PlanId) => { const p = PLANS.find((x) => x.id === id); return p && table[id] > 0 ? Math.round(table[id] / p.months) : 0; };

    return (
        <div className="bg-white text-slate-800">
            <SiteHeader current="/cenik" />
            <section className="bg-gradient-to-b from-indigo-50/70 to-white px-4 pb-10 pt-16 text-center sm:px-6 sm:pt-20">
                <p className="text-sm font-semibold text-indigo-700">Ceník</p>
                <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">Jedna cena. Všechny funkce v ní.</h1>
                <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">Žádné tarify s omezeními. Vybíráte jen to, na jak dlouho předplatné koupíte. Čím déle, tím levněji.</p>

                <div className="mx-auto mt-8 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="group" aria-label="Pro koho">
                    {([['solo', 'Jednotlivý advokát'], ['firm', 'Advokátní kancelář']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)} className={`rounded-lg px-5 py-2 text-sm font-semibold cursor-pointer ${mode === id ? 'bg-indigo-700 text-white' : 'text-slate-600 hover:text-slate-900'}`}>{label}</button>)}
                </div>
                {mode === 'firm' && (
                    <div className="mt-5">
                        <div className="inline-flex flex-wrap justify-center gap-2" role="group" aria-label="Počet advokátů v kanceláři">
                            {FIRM_SIZES.map((n) => <button key={n} type="button" aria-pressed={size === n} onClick={() => setSize(n)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold cursor-pointer ${size === n ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-300 bg-white text-slate-700'}`}>Do {n} advokátů</button>)}
                        </div>
                        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600">Jedna platba za celou kancelář. Každý advokát má vlastní účet a data.</p>
                    </div>
                )}

                <div className="mx-auto mt-10 grid max-w-5xl gap-5 text-left md:grid-cols-3">
                    {PLANS.map((plan) => {
                        const price = table[plan.id]; const save = saving(table, plan.id); const featured = plan.id === 'half'; const pm = perMonth(plan.id);
                        return (
                            <div key={plan.id} className={`relative flex flex-col rounded-3xl bg-white p-7 ${featured ? 'border-2 border-indigo-600 shadow-xl shadow-indigo-100' : 'border border-slate-200'}`}>
                                {featured && <span className="absolute -top-3 left-7 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">Nejčastější volba</span>}
                                <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
                                <p className="mt-4 flex items-baseline gap-2"><span className="text-5xl font-bold tracking-tight text-slate-900">{price > 0 ? czk(price) : 'Brzy'}</span>{price > 0 && <span className="text-sm text-slate-500">{plan.unit}</span>}</p>
                                <p className="mt-2 h-5 text-sm text-slate-500">{pm > 0 && plan.months > 1 ? `tedy ${czk(pm)} měsíčně` : price > 0 ? ' ' : 'Cenu zveřejníme před spuštěním'}</p>
                                <p className="mt-1 h-5 text-sm font-semibold text-emerald-700">{save > 0 ? `Ušetříte ${czk(save)}` : ' '}</p>
                                <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-700">
                                    {['Všechny funkce', 'Neomezený počet věcí a klientů', mode === 'firm' ? `Až ${size} advokátů v ceně` : 'Zkušební období 14 dní zdarma', 'Zrušíte kdykoli jedním tlačítkem'].map((f) => <li key={f} className="flex items-start gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />{f}</li>)}
                                </ul>
                                {account
                                    ? <Link href={mode === 'firm' ? '/kancelar/tym' : '/kancelar/nastaveni'} className={`mt-7 inline-flex justify-center rounded-xl px-4 py-3 text-sm font-bold ${featured ? 'bg-indigo-700 text-white hover:bg-indigo-800' : 'border border-slate-300 text-slate-800 hover:bg-slate-50'}`}>{mode === 'firm' ? 'Otevřít tým' : 'Otevřít předplatné'}</Link>
                                    : <button type="button" onClick={() => openLogin('register')} className={`mt-7 rounded-xl px-4 py-3 text-sm font-bold cursor-pointer ${featured ? 'bg-indigo-700 text-white hover:bg-indigo-800' : 'border border-slate-300 text-slate-800 hover:bg-slate-50'}`}>Začít 14 dní zdarma</button>}
                            </div>
                        );
                    })}
                </div>
                <p className="mx-auto mt-6 max-w-2xl text-xs leading-relaxed text-slate-500">Před použitím aplikace vyplníte povinný profil (jméno, evidenční číslo ČAK, kancelář a kontakt). Předplatné lze koupit po jeho vyplnění.</p>
            </section>

            <section className="px-4 py-20 sm:px-6 sm:py-24" aria-labelledby="vcene-title">
                <div className="mx-auto max-w-6xl">
                    <h2 id="vcene-title" className="max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Co všechno je v ceně</h2>
                    <p className="mt-3 max-w-2xl text-slate-600">Žádné funkce za příplatek, kromě jediné volitelné služby uvedené níže.</p>
                    <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
                        {GROUPS.map(({ icon: Icon, tone, title, items }) => (
                            <div key={title}>
                                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}><Icon size={20} aria-hidden="true" /></span>
                                <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
                                <ul className="mt-3 space-y-2 text-sm text-slate-600">{items.map((t) => <li key={t} className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-indigo-600" aria-hidden="true" />{t}</li>)}</ul>
                            </div>
                        ))}
                    </div>
                    <div className="mt-14 flex flex-col gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:flex-row sm:items-center sm:p-8">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700"><ShieldAlert size={22} aria-hidden="true" /></span>
                        <div><h3 className="text-lg font-bold text-slate-900">Volitelný doplněk: Hlídání insolvence</h3><p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-700">Denní kontrola klientů a protistran v insolvenčním rejstříku a v ARES s upozorněním a návrhem lhůty. Za příplatek k aktivnímu předplatnému. U kanceláře ho platí vedoucí jednou za všechny.</p></div>
                    </div>
                </div>
            </section>

            <section className="border-y border-slate-100 bg-slate-50 px-4 py-20 sm:px-6 sm:py-24" aria-labelledby="jak-title">
                <div className="mx-auto max-w-6xl">
                    <h2 id="jak-title" className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Jak to funguje</h2>
                    <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                        {STEPS.map(([t, d], i) => <li key={t}><span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-700 text-sm font-bold text-white">{i + 1}</span><h3 className="mt-4 font-bold text-slate-900">{t}</h3><p className="mt-1.5 text-sm leading-relaxed text-slate-600">{d}</p></li>)}
                    </ol>
                    <ul className="mt-12 grid gap-4 sm:grid-cols-3">
                        {([[BadgeCheck, 'Žádné skryté poplatky', 'Cena je za předplatné, nic dalšího za základní funkce.'], [CalendarClock, 'Obnova pod vaší kontrolou', 'Automatické obnovování je volitelné, předem vás upozorníme a zrušíte ho kdykoli.'], [Lock, 'Vaše data zůstávají vaše', 'Po skončení je máte měsíce k nahlížení a stažení.']] as const).map(([Icon, t, d]) => <li key={t} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-5"><Icon size={20} className="mt-0.5 shrink-0 text-indigo-700" aria-hidden="true" /><span><span className="block font-semibold text-slate-900">{t}</span><span className="mt-1 block text-sm text-slate-600">{d}</span></span></li>)}
                    </ul>
                </div>
            </section>

            <section className="px-4 py-20 sm:px-6 sm:py-24" aria-labelledby="otazky-title">
                <div className="mx-auto max-w-3xl">
                    <h2 id="otazky-title" className="text-center text-3xl font-bold tracking-tight text-slate-900">Otázky k ceně</h2>
                    <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
                        {FAQ.map(([q, a]) => <details key={q} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold text-slate-900">{q}<ChevronDown size={18} className="shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden="true" /></summary><p className="mt-3 leading-relaxed text-slate-600">{a}</p></details>)}
                    </div>
                </div>
            </section>

            <FinalCta title="Začněte s 14 dny zdarma" text="Bez karty a bez závazku. Data převedete importem a nic nepřijde nazmar." />
            <SiteFooter />
        </div>
    );
}
