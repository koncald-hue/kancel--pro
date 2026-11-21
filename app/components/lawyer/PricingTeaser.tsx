'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { czk } from '@/lib/lawyer';
import { EMPTY_PRICES, PLANS, saving, savingPct, type Prices } from '@/lib/plans';
import { useAuth } from '../site/AuthContext';

// Stručný ceník pro hlavní stránku: tři plány a odkaz na podrobný ceník
export default function PricingTeaser({ initialPrices }: { initialPrices?: Prices }) {
    const { account, openLogin } = useAuth();
    const [prices, setPrices] = useState<Prices>(initialPrices ?? EMPTY_PRICES);
    const [loaded, setLoaded] = useState(!!initialPrices);
    useEffect(() => {
        if (initialPrices) return;
        let alive = true;
        fetch('/api/lawyer-prices').then((r) => r.json()).then((p) => { if (alive) { setPrices({ ...EMPTY_PRICES, ...p }); setLoaded(true); } }).catch(() => { if (alive) setLoaded(true); });
        return () => { alive = false; };
    }, [initialPrices]);
    return (
        <section className="bg-slate-50 px-4 py-20 sm:px-6 sm:py-24" aria-labelledby="cenik-title">
            <div className="mx-auto max-w-5xl">
                <div className="text-center">
                    <h2 id="cenik-title" className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Jedna cena. Všechny funkce v ní.</h2>
                    <p className="mx-auto mt-3 max-w-xl text-slate-600">Vybíráte jen délku předplatného. Prvních 14 dní zdarma, bez karty.</p>
                </div>
                <div className="mt-10 grid gap-4 md:grid-cols-3">
                    {PLANS.map((plan) => {
                        const price = prices[plan.id]; const save = saving(prices, plan.id); const featured = plan.id === 'half';
                        return (
                            <div key={plan.id} className={`relative rounded-2xl bg-white p-6 ${featured ? 'border-2 border-indigo-600 shadow-lg shadow-indigo-100' : 'border border-slate-200'}`}>
                                {featured && <span className="absolute -top-3 left-6 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-bold text-white">Nejčastější volba</span>}
                                <h3 className="font-bold text-slate-900">{plan.name}</h3>
                                <p className="mt-3 flex items-baseline gap-2"><span className="text-3xl font-bold tracking-tight text-slate-900">{price > 0 ? czk(price) : loaded ? 'Brzy' : <span aria-hidden="true" className="inline-block h-9 w-28 animate-pulse rounded-lg bg-slate-200 align-middle" />}</span>{price > 0 && <span className="text-sm text-slate-500">{plan.unit}</span>}</p>
                                <p className="mt-1 h-5 text-sm font-semibold text-emerald-700">{save > 0 ? `Sleva ${savingPct(prices, plan.id)} % (${czk(save)})` : ' '}</p>
                            </div>
                        );
                    })}
                </div>
                <ul className="mx-auto mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-slate-600">
                    {['Všechny funkce ve všech plánech', 'Zrušíte kdykoli jedním tlačítkem', 'Balíčky pro kanceláře'].map((t) => <li key={t} className="flex items-center gap-2"><Check size={15} className="text-emerald-600" aria-hidden="true" />{t}</li>)}
                </ul>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    {account ? <Link href="/kancelar/nastaveni" className="inline-flex items-center justify-center rounded-lg bg-indigo-700 px-6 py-3 text-[15px] font-semibold text-white hover:bg-indigo-800">Otevřít předplatné</Link> : <button type="button" onClick={() => openLogin('register')} className="inline-flex items-center justify-center rounded-lg bg-indigo-700 px-6 py-3 text-[15px] font-semibold text-white hover:bg-indigo-800 cursor-pointer">Začít 14 dní zdarma</button>}
                    <Link href="/cenik" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-[15px] font-semibold text-slate-800 hover:bg-slate-100">Podrobný ceník <ArrowRight size={16} aria-hidden="true" /></Link>
                </div>
            </div>
        </section>
    );
}
