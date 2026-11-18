'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Copy, Download, ExternalLink, FileSpreadsheet, Info, XCircle } from 'lucide-react';
import { readFile } from '@/lib/importer';
import { buildClaims, claimText, claimsCsv, hasError, summary, todayIso, type Claim } from '@/lib/epr';
import { downloadTextFile } from '@/lib/caseFile';
import { czk } from '@/lib/lawyer';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';

const EPODATELNA = 'https://epodatelna.justice.cz/';
const SAMPLE = 'Dlužník;Adresa;IČO nebo RČ;Jistina;Splatnost;Číslo faktury\r\nJan Vzorový;Ukázková 1, 110 00 Praha 1;800101/0000;12500;15. 3. 2026;FA-2026-001\r\nVzorová s.r.o.;Příkladová 5, 602 00 Brno;12345678;48000;1. 2. 2026;FA-2026-002\r\n';

// Hromadné platební rozkazy: příprava podkladů. Nic se nepodává (formulář EPR je jen v e-Podatelně a vyžaduje kvalifikovaný podpis).
export default function LawyerEpr() {
    const [claims, setClaims] = useState<Claim[] | null>(null);
    const [filing, setFiling] = useState(todayIso());
    const [fileName, setFileName] = useState(''); const [tableCache, setTableCache] = useState<{ headers: string[]; rows: string[][] } | null>(null);
    const [error, setError] = useState(''); const [open, setOpen] = useState<number | null>(null); const [done, setDone] = useState<Set<number>>(new Set()); const [only, setOnly] = useState(false);
    const [copied, setCopied] = useState<number | null>(null);

    async function load(file: File) {
        setError(''); setDone(new Set()); setOpen(null);
        try {
            const sheets = await readFile(new Uint8Array(await file.arrayBuffer()), file.name);
            const t = sheets[0]?.table; if (!t || !t.rows.length) { setError('V souboru se nenašla tabulka s řádky. Použijte CSV nebo Excel s hlavičkou v prvním řádku.'); return; }
            setFileName(file.name); setTableCache(t); setClaims(buildClaims(t, filing));
        } catch { setError('Soubor se nepodařilo přečíst.'); }
    }
    function changeFiling(v: string) { setFiling(v); if (tableCache && /^\d{4}-\d{2}-\d{2}$/.test(v)) setClaims(buildClaims(tableCache, v)); }

    const sum = useMemo(() => (claims ? summary(claims) : null), [claims]);
    const shown = (claims ?? []).filter((c) => !only || c.issues.length > 0);

    return (
        <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><FileSpreadsheet size={18} className="text-indigo-700" aria-hidden="true" /> Příprava hromadných platebních rozkazů (EPR)</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Nahrajte tabulku pohledávek (CSV nebo Excel). Kancelář zkontroluje údaje, spočítá zákonný úrok a orientační soudní poplatek a připraví podklad, ze kterého jednotlivé návrhy vyplníte.</p>
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-950"><Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> Kancelář nic nepodává. Návrh na EPR se podává jen oficiálním formulářem v <a href={EPODATELNA} target="_blank" rel="noopener noreferrer" className="font-semibold underline">e-Podatelně ministerstva spravedlnosti</a> s kvalifikovaným elektronickým podpisem a hromadné podání (XML, rozhraní) tam není. Každý návrh tedy podáváte sami a odpovídáte za jeho obsah. Kontroly níže jsou pomůcka, ne právní posouzení. Data zůstávají jen ve vašem prohlížeči.</p>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                    <label className="text-sm font-semibold text-slate-800">Tabulka pohledávek
                        <input type="file" accept=".csv,.tsv,.xlsx,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); }} className="mt-1 block text-sm" />
                    </label>
                    <label className="text-sm font-semibold text-slate-800">Předpokládané datum podání
                        <input type="date" value={filing} onChange={(e) => changeFiling(e.target.value)} className={`${inputCls} mt-1 w-44`} />
                    </label>
                    <button type="button" onClick={() => downloadTextFile('epr-vzor.csv', `﻿${SAMPLE}`, 'text/csv')} className={ghostBtn}><Download size={14} /> Stáhnout vzor tabulky</button>
                </div>
                <p className="mt-2 text-xs text-slate-500">Sloupce se poznají podle názvů: Dlužník, Adresa, IČO / RČ, Jistina, Splatnost, Číslo faktury (poznámka je volitelná).</p>
            </section>

            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}

            {claims && sum && (
                <>
                    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Souhrn">
                        {[['Nároků v tabulce', String(sum.total)], ['Připraveno k podání', `${sum.ready}${sum.withWarn ? ` (z toho ${sum.withWarn} ke kontrole)` : ''}`], ['K doplnění', String(sum.withError)], ['Jistina + úrok k datu podání', czk(sum.principal + sum.interest)]].map(([l, v]) => (
                            <div key={l} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{l}</p><p className="mt-1 text-xl font-extrabold text-slate-900">{v}</p></div>
                        ))}
                    </section>
                    <p className="text-xs text-slate-600">Orientační soudní poplatky za návrhy na EPR: {czk(sum.fees)} (400 Kč do 10 000 Kč, 800 Kč do 20 000 Kč, nad to 4 %, podle sazebníku soudních poplatků, položka 2). Při zrušení rozkazu se doplácí do poplatku podle položky 1. Před podáním ověřte aktuální znění.</p>

                    <div className="flex flex-wrap items-center gap-3">
                        <button type="button" onClick={() => downloadTextFile('epr-podklad.csv', claimsCsv(claims, filing), 'text/csv')} className={primaryBtn}><Download size={15} /> Stáhnout podklad (CSV)</button>
                        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Jen s upozorněním</label>
                        <span className="text-xs text-slate-500">{fileName} · podáno ručně: {done.size} z {sum.ready}</span>
                    </div>

                    <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                        {shown.map((c) => {
                            const err = hasError(c); const isOpen = open === c.row;
                            return (
                                <li key={c.row} className="p-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                        {err ? <XCircle size={18} className="shrink-0 text-rose-600" aria-label="K doplnění" /> : c.issues.length ? <AlertTriangle size={18} className="shrink-0 text-amber-600" aria-label="Zkontrolovat" /> : <CheckCircle2 size={18} className="shrink-0 text-emerald-600" aria-label="Připraveno" />}
                                        <button type="button" onClick={() => setOpen(isOpen ? null : c.row)} aria-expanded={isOpen} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left">
                                            <span className="truncate font-semibold text-slate-900">{c.debtor || `(bez jména, řádek ${c.row})`}</span>
                                            <span className="shrink-0 text-sm text-slate-600">{c.amount !== null ? czk(c.amount) : '—'}</span>
                                            <ChevronDown size={15} className={`shrink-0 text-slate-400 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                                        </button>
                                        {!err && <label className="flex items-center gap-1.5 text-xs text-slate-700"><input type="checkbox" checked={done.has(c.row)} onChange={(e) => setDone((s) => { const n = new Set(s); if (e.target.checked) n.add(c.row); else n.delete(c.row); return n; })} /> podáno</label>}
                                    </div>
                                    {c.issues.length > 0 && <ul className="mt-2 space-y-0.5 pl-7 text-xs">{c.issues.map((i, k) => <li key={k} className={i.level === 'error' ? 'text-rose-800' : 'text-amber-900'}>{i.text}</li>)}</ul>}
                                    {isOpen && (
                                        <div className="mt-3 rounded-xl bg-slate-50 p-3 pl-7 text-sm">
                                            <pre className="whitespace-pre-wrap font-sans text-slate-800">{claimText(c, filing)}</pre>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <button type="button" onClick={() => { void navigator.clipboard?.writeText(claimText(c, filing)); setCopied(c.row); window.setTimeout(() => setCopied(null), 1200); }} className={ghostBtn}><Copy size={14} /> {copied === c.row ? 'Zkopírováno' : 'Zkopírovat údaje'}</button>
                                                <a href={EPODATELNA} target="_blank" rel="noopener noreferrer" className={ghostBtn}><ExternalLink size={14} /> Otevřít e-Podatelnu</a>
                                            </div>
                                            {c.fee !== null && <p className="mt-2 text-xs text-slate-500">Poplatek při zrušení rozkazu a pokračování řízení: {czk(c.feeFallback ?? 0)}.</p>}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                        {shown.length === 0 && <li className="p-4 text-sm text-slate-500">Žádný nárok s upozorněním.</li>}
                    </ul>
                </>
            )}
        </div>
    );
}
