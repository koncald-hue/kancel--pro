'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Check } from 'lucide-react';
import { czk } from '@/lib/lawyer';

const FEATURES = ['Lhůty, spisy, klienti a výkazy práce', 'Klientský odkaz a poptávkový formulář', 'End-to-end šifrovaná komunikace s klientem', 'Předání spisu s číslovanými přílohami'];

// Balíčky předplatného: ceny vidí každý, koupit lze až po ověření totožnosti
export default function LawyerPricing() {
    const [prices, setPrices] = useState<{ month: number; year: number } | null>(null);
    useEffect(() => {
        let cancelled = false;
        fetch('/api/lawyer-prices').then((r) => r.json()).then((p) => { if (!cancelled) setPrices(p); }).catch(() => { if (!cancelled) setPrices({ month: 0, year: 0 }); });
        return () => { cancelled = true; };
    }, []);

    const plans = [['month', 'Měsíční', prices?.month ?? 0, 'za měsíc'], ['year', 'Roční', prices?.year ?? 0, 'za rok']] as const;
    const yearSaving = prices && prices.month > 0 && prices.year > 0 ? prices.month * 12 - prices.year : 0;

    return (
        <section className="mt-12" aria-labelledby="lawyer-plans">
            <h2 id="lawyer-plans" className="text-center text-2xl font-bold text-slate-900">Předplatné</h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-sm leading-relaxed text-slate-600">Přístup platí po dobu zaplaceného předplatného. Koupit ho můžete po <strong>ověření totožnosti</strong> podle seznamu ČAK, aby se za advokáty nemohl vydávat nikdo jiný.</p>
            <div className="mx-auto mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
                {plans.map(([id, name, price, unit]) => (
                    <div key={id} className={`rounded-2xl border bg-white p-6 ${id === 'year' ? 'border-2 border-indigo-700' : 'border-slate-200'}`}>
                        {id === 'year' && yearSaving > 0 && <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-bold text-indigo-950">Ušetříte {czk(yearSaving)}</span>}
                        <p className="mt-2 text-lg font-bold text-slate-900">{name}</p>
                        <p className="mt-1 text-3xl font-bold text-slate-900">{price > 0 ? czk(price) : '–'} <span className="font-sans text-sm font-normal text-slate-500">{price > 0 ? unit : 'cena bude brzy zveřejněna'}</span></p>
                        <ul className="mt-4 space-y-2 text-sm text-slate-700">{FEATURES.map((f) => <li key={f} className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />{f}</li>)}</ul>
                        <Link href="/kancelar/nastaveni" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"><BadgeCheck size={15} aria-hidden="true" /> Nejdřív ověřit totožnost</Link>
                    </div>
                ))}
            </div>
        </section>
    );
}
