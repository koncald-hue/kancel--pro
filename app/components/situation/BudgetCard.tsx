'use client';

import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { BUDGET_LABEL, budgetInfo } from '@/lib/budget';
import { money } from '@/lib/billing';
import { ghostBtn, inputCls, primaryBtn } from './caseUi';

const TONE = { none: 'bg-slate-300', ok: 'bg-emerald-600', warn: 'bg-amber-500', over: 'bg-rose-600' } as const;
const TEXT = { none: 'text-slate-600', ok: 'text-emerald-800', warn: 'text-amber-800', over: 'text-rose-800' } as const;

// Rozpočet věci: dohodnutá částka, kolik práce je vykázáno a kolik zbývá vyúčtovat. Upozorní při dosažení zadaného procenta.
export default function BudgetCard({ budget, warnPct, worked, billed, onSave }: { budget: number | null; warnPct: number; worked: number; billed: number; onSave: (budget: number | null, warnPct: number) => void }) {
    const [edit, setEdit] = useState(false);
    const [value, setValue] = useState(budget ? String(budget) : '');
    const [pct, setPct] = useState(String(warnPct));
    const info = budgetInfo({ budget, warnPct, worked, billed });

    function save() {
        const n = Number(value.replace(/\s/g, '').replace(',', '.'));
        const p = Math.min(100, Math.max(1, Math.round(Number(pct)) || 80));
        onSave(value.trim() === '' ? null : Number.isFinite(n) && n >= 0 ? n : budget, p);
        setEdit(false);
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-label="Rozpočet věci">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><Wallet size={13} /> Rozpočet věci</h2>
                {!edit && <button type="button" onClick={() => { setValue(budget ? String(budget) : ''); setPct(String(warnPct)); setEdit(true); }} className="cursor-pointer text-xs font-semibold text-indigo-800 hover:underline">{budget ? 'Upravit' : 'Nastavit rozpočet'}</button>}
            </div>
            {edit ? (
                <form onSubmit={(e) => { e.preventDefault(); save(); }} className="mt-3 flex flex-wrap items-end gap-3">
                    <label className="text-xs font-semibold text-slate-700">Rozpočet (Kč)<input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="např. 25000" className={`${inputCls} mt-1 w-40`} /></label>
                    <label className="text-xs font-semibold text-slate-700">Upozornit od (%)<input value={pct} onChange={(e) => setPct(e.target.value)} inputMode="numeric" className={`${inputCls} mt-1 w-24`} /></label>
                    <button type="submit" className={primaryBtn}>Uložit</button>
                    <button type="button" onClick={() => setEdit(false)} className={ghostBtn}>Zrušit</button>
                    <p className="w-full text-xs text-slate-500">Prázdné pole rozpočet zruší. Do využití se počítá všechna vykázaná práce podle sazby.</p>
                </form>
            ) : !budget ? (
                <p className="mt-2 text-sm text-slate-600">Dohodnutý rozpočet věci zatím není nastavený. Po nastavení uvidíte, kolik z něj práce spotřebovala, a upozorníme vás předem.</p>
            ) : (
                <div className="mt-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-2xl font-bold text-slate-900">{money(worked)} <span className="text-sm font-semibold text-slate-500">z {money(budget)}</span></p>
                        <p className={`text-sm font-bold ${TEXT[info.state]}`}>{BUDGET_LABEL[info.state]} · {String(info.usedPct).replace('.', ',')} %</p>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(info.usedPct))} aria-label="Využití rozpočtu"><div className={`h-full ${TONE[info.state]}`} style={{ width: `${Math.min(100, info.usedPct)}%` }} /></div>
                    <dl className="mt-3 grid grid-cols-3 gap-3 text-xs text-slate-600">
                        <div><dt>{info.remaining < 0 ? 'Nad rozpočet' : 'Zbývá z rozpočtu'}</dt><dd className={`text-sm font-bold ${info.remaining < 0 ? 'text-rose-800' : 'text-slate-900'}`}>{money(Math.abs(info.remaining))}</dd></div>
                        <div><dt>Vyúčtováno</dt><dd className="text-sm font-bold text-slate-900">{money(billed)}</dd></div>
                        <div><dt>Zbývá vyúčtovat</dt><dd className="text-sm font-bold text-slate-900">{money(info.unbilled)}</dd></div>
                    </dl>
                    {info.state === 'warn' && <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-950">Vykázáno už {String(info.usedPct).replace('.', ',')} % rozpočtu. Zvažte, zda klienta upozornit nebo rozpočet navýšit.</p>}
                    {info.state === 'over' && <p className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-950">Rozpočet je překročený. Dohodněte s klientem navýšení, než vyúčtujete další práci.</p>}
                </div>
            )}
        </section>
    );
}
