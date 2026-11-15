'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { czk } from '@/lib/lawyer';
import { EMPTY_PRICES, PLANS, saving, type Prices } from '@/lib/plans';
import { useAuth } from '../site/AuthContext';
import Link from 'next/link';

const INCLUDED = [
    'Spisy, lhůty, klienti a výkazy práce bez omezení počtu věcí',
    'Klientský odkaz s end-to-end šifrovanými zprávami a soubory',
    'Poptávkový formulář pro nové klienty',
    'Export spisu s číslovanými přílohami',
    'Příprava obrany s ověřenými zákony (AI, ke kontrole advokátem)',
];

// Tři plány předplatného. Ceny se načítají z nastavení; dokud nejsou zadané, ukáže se jen „brzy".
export default function LawyerPricing() {
    const { account, openLogin } = useAuth();
    const [prices, setPrices] = useState<Prices>(EMPTY_PRICES);
    useEffect(() => {
        let cancelled = false;
        fetch('/api/lawyer-prices').then((r) => r.json()).then((p) => { if (!cancelled) setPrices({ ...EMPTY_PRICES, ...p }); }).catch(() => undefined);
        return () => { cancelled = true; };
    }, []);

    return (
        <section id="cenik" className="scroll-mt-20" aria-labelledby="plans-title">
            <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Ceník</p>
                <h2 id="plans-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Jeden produkt, tři délky předplatného</h2>
                <p className="mx-auto mt-3 max-w-2xl text-slate-600">Všechny plány mají úplně stejné funkce. Liší se jen délkou a cenou. Začnete <strong className="text-slate-900">14 dny zdarma</strong>, bez zadávání karty a bez závazku.</p>
            </div>
            <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-3">
                {PLANS.map((plan) => {
                    const price = prices[plan.id];
                    const save = saving(prices, plan.id);
                    const featured = plan.id === 'half';
                    return (
                        <div key={plan.id} className={`relative flex flex-col rounded-3xl bg-white p-7 ${featured ? 'border-2 border-indigo-600 shadow-xl shadow-indigo-100' : 'border border-slate-200'}`}>
                            {featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">Nejčastější volba</span>}
                            <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                            <p className="mt-4 flex items-baseline gap-1.5">
                                <span className="text-4xl font-bold tracking-tight text-slate-900">{price > 0 ? czk(price) : 'Brzy'}</span>
                                {price > 0 && <span className="text-sm text-slate-500">{plan.unit}</span>}
                            </p>
                            <p className="mt-1 h-5 text-xs font-semibold text-emerald-700">{save > 0 ? `Ušetříte ${czk(save)} oproti měsíčnímu placení` : price > 0 ? ' ' : 'Cenu zveřejníme před spuštěním'}</p>
                            <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-700">
                                {INCLUDED.map((f) => <li key={f} className="flex items-start gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />{f}</li>)}
                            </ul>
                            {account
                                ? <Link href="/kancelar/nastaveni" className={`mt-7 inline-flex justify-center rounded-xl px-4 py-3 text-sm font-bold ${featured ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'border border-slate-300 text-slate-800 hover:bg-slate-50'}`}>Otevřít předplatné</Link>
                                : <button type="button" onClick={() => openLogin('register')} className={`mt-7 rounded-xl px-4 py-3 text-sm font-bold ${featured ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'border border-slate-300 text-slate-800 hover:bg-slate-50'}`}>Začít 14 dní zdarma</button>}
                        </div>
                    );
                })}
            </div>
            <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-slate-500">Předplatné lze koupit po ověření totožnosti (pro advokáty podle seznamu ČAK), aby se za advokáty nemohl vydávat nikdo jiný.</p>
        </section>
    );
}
