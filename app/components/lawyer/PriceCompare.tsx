import { COMPETITOR_CHECKED, COMPETITOR_MONTHLY } from '@/lib/competitor';
import { czk } from '@/lib/lawyer';
import type { FirmPrices } from '@/lib/firm';
import type { Prices } from '@/lib/plans';

// Srovnání měsíční ceny s jedním srovnatelným českým systémem; bez jména, jen ověřitelná čísla z jeho veřejného ceníku
export default function PriceCompare({ solo, firms }: { solo: Prices; firms: FirmPrices }) {
    const rows: [string, number, number][] = [
        ['1 advokát', solo.month, COMPETITOR_MONTHLY[1]],
        ['3 advokáti', firms[3].month, COMPETITOR_MONTHLY[3]],
        ['5 advokátů', firms[5].month, COMPETITOR_MONTHLY[5]],
        ['10 advokátů', firms[10].month, COMPETITOR_MONTHLY[10]],
        ['20 advokátů', firms[20].month, COMPETITOR_MONTHLY[20]],
    ];
    if (rows.some(([, ours]) => !(ours > 0))) return null;
    return (
        <section className="px-4 py-16 sm:px-6" aria-labelledby="porovnani-title">
            <div className="mx-auto max-w-3xl">
                <h2 id="porovnani-title" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Kolik ušetříte</h2>
                <p className="mt-2 text-sm text-slate-600">Měsíční cena bez DPH proti srovnatelnému českému systému pro advokáty.</p>
                <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[420px] text-left text-sm">
                        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Velikost</th><th className="px-4 py-3 text-right">Jiný systém</th><th className="px-4 py-3 text-right text-indigo-800">Kancelář</th><th className="px-4 py-3 text-right">Úspora</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map(([k, ours, theirs]) => (
                                <tr key={k}>
                                    <th scope="row" className="px-4 py-3 font-semibold text-slate-900">{k}</th>
                                    <td className="px-4 py-3 text-right text-slate-600">{czk(theirs)}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{czk(ours)}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{ours < theirs ? `−${Math.round((1 - ours / theirs) * 100)} %` : '–'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="mt-3 text-xs text-slate-500">Srovnání vychází z veřejného ceníku jednoho českého dodavatele, měsíční platba, bez DPH, platné k {COMPETITOR_CHECKED}. Cena u balíčků kanceláří zahrnuje i místa pro koncipienty. Dodavatel může ceny změnit.</p>
            </div>
        </section>
    );
}
