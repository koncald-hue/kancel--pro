'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, ExternalLink, Gavel, Info } from 'lucide-react';
import { loadCases, type LegalCase } from '@/lib/cases';
import { INFOSOUD_URL, infosoudDirectLink, isCourt, parseFileNumber, type FileNumber } from '@/lib/infosoud';
import { inputCls } from '../situation/caseUi';

type Row = { c: LegalCase; fn: FileNumber | null };

function CopyChip({ label, value }: { label: string; value: string }) {
    const [done, setDone] = useState(false);
    if (!value) return null;
    return (
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(value); setDone(true); window.setTimeout(() => setDone(false), 1200); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer" aria-label={`Zkopírovat ${label}: ${value}`}>
            <span className="text-slate-500">{label}</span><strong className="font-mono text-slate-900">{value}</strong>{done ? <Check size={12} className="text-emerald-600" aria-hidden="true" /> : <Copy size={12} className="text-slate-400" aria-hidden="true" />}
        </button>
    );
}

function Parts({ fn, court }: { fn: FileNumber; court: string }) {
    return (
        <div className="mt-2 flex flex-wrap gap-1.5">
            {court && <CopyChip label="Soud" value={court} />}
            {fn.senat !== null && <CopyChip label="Senát" value={String(fn.senat)} />}
            <CopyChip label="Rejstřík" value={fn.druh} />
            <CopyChip label="Číslo" value={String(fn.cislo)} />
            <CopyChip label="Ročník" value={String(fn.rocnik)} />
        </div>
    );
}

// Soudní řízení: spisové značky věcí připravené pro vyhledání v InfoSoudu (služba Ministerstva spravedlnosti)
export default function LawyerInfosoud() {
    const [cases, setCases] = useState<LegalCase[] | null>(null);
    const [error, setError] = useState('');
    const [manual, setManual] = useState('');
    useEffect(() => {
        let alive = true;
        loadCases().then((c) => { if (alive) setCases(c); }).catch(() => { if (alive) setError('Věci se nepodařilo načíst.'); });
        return () => { alive = false; };
    }, []);

    const rows = useMemo<Row[]>(() => (cases ?? []).filter((c) => c.status === 'open' && (c.reference ?? '').trim()).map((c) => ({ c, fn: parseFileNumber(c.reference ?? '') })), [cases]);
    const courts = rows.filter((r) => r.fn && (isCourt(r.c.authority ?? '') || !(r.c.authority ?? '').trim()));
    const other = rows.filter((r) => !courts.includes(r));
    const typed = manual.trim() ? parseFileNumber(manual) : null;
    const open = <a href={INFOSOUD_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-800 px-3 py-1.5 text-sm font-bold text-white hover:bg-indigo-900"><ExternalLink size={14} aria-hidden="true" /> Otevřít InfoSoud</a>;

    return (
        <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Gavel size={18} className="text-indigo-700" aria-hidden="true" /> Průběh soudních řízení v InfoSoudu</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">InfoSoud ukazuje, v jakém stavu je řízení u soudu (jednání, rozhodnutí, odvolání). Kancelář z vašich věcí připraví údaje ze spisové značky. U okresních soudů otevře tlačítko přímo řízení, u ostatních údaje klepnutím zkopírujete a ve formuláři InfoSoudu vyplníte.</p>
                <p className="mt-2 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600"><Info size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" /> InfoSoud nemá veřejné rozhraní pro jiné aplikace, proto ho Kancelář sama nečte ani nehlídá. Vyhledání proběhne na stránce ministerstva ve vašem prohlížeči a do Kanceláře se nic neukládá.</p>
                <form onSubmit={(e) => e.preventDefault()} className="mt-4">
                    <label className="block text-sm font-semibold text-slate-800">Rozložit jinou spisovou značku
                        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="např. 10 C 123/2024" maxLength={60} className={`${inputCls} mt-1 max-w-sm`} />
                    </label>
                    {manual.trim() && (typed ? <Parts fn={typed} court="" /> : <p className="mt-2 text-xs text-amber-800">Tohle nevypadá jako spisová značka soudu (senát, rejstřík, číslo/ročník).</p>)}
                </form>
                <div className="mt-4">{open}</div>
            </section>

            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            {cases === null && !error && <p className="text-sm text-slate-500" role="status">Načítám věci…</p>}

            {cases !== null && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="is-list">
                    <h3 id="is-list" className="text-base font-bold text-slate-900">Věci se spisovou značkou soudu ({courts.length})</h3>
                    {courts.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">Žádná otevřená věc zatím nemá spisovou značku soudu. Doplníte ji ve věci na kartě Přehled (pole „Spisová značka / č. j.“ a „Úřad nebo soud“).</p>
                    ) : (
                        <ul className="mt-3 divide-y divide-slate-100">
                            {courts.map(({ c, fn }) => (
                                <li key={c.id} className="py-3">
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                        <Link href={`/kancelar/veci/${c.id}`} className="font-semibold text-slate-900 hover:underline">{c.title}{c.client_name ? <span className="font-normal text-slate-500"> · {c.client_name}</span> : null}</Link>
                                        <span className="font-mono text-sm text-slate-700">{fn!.text}{c.authority ? <span className="font-sans text-slate-500"> · {c.authority}</span> : null}</span>
                                    </div>
                                    {(() => { const link = infosoudDirectLink(fn!, c.authority ?? ''); return link ? <a href={link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-900"><ExternalLink size={13} aria-hidden="true" /> Otevřít řízení v InfoSoudu</a> : null; })()}
                                    <Parts fn={fn!} court={c.authority ?? ''} />
                                </li>
                            ))}
                        </ul>
                    )}
                    {other.length > 0 && (
                        <details className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
                            <summary className="cursor-pointer font-semibold text-slate-700">Další věci se značkou, která nevypadá jako soudní ({other.length})</summary>
                            <ul className="mt-2 space-y-1 text-slate-600">{other.map(({ c }) => <li key={c.id}><Link href={`/kancelar/veci/${c.id}`} className="hover:underline">{c.title}</Link> · <span className="font-mono">{c.reference}</span>{c.authority ? ` · ${c.authority}` : ''}</li>)}</ul>
                        </details>
                    )}
                </section>
            )}
        </div>
    );
}
