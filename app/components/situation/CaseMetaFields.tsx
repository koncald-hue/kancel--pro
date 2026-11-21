'use client';

import { useState } from 'react';
import { Tag, X } from 'lucide-react';
import { CASE_TYPES, cleanLabels, MAX_LABELS } from '@/lib/caseMeta';
import type { LegalCase } from '@/lib/cases';
import { inputCls } from './caseUi';

// Druh případu, odpovědná osoba a štítky věci
export default function CaseMetaFields({ item, patchItem }: { item: LegalCase; patchItem: (c: Partial<LegalCase>) => void }) {
    const [label, setLabel] = useState('');
    const labels = item.labels ?? [];
    const add = () => { const next = cleanLabels([...labels, label]); setLabel(''); if (next.length !== labels.length) patchItem({ labels: next }); };
    return (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-semibold text-slate-600">Druh případu
                <select value={item.case_type ?? ''} onChange={(e) => patchItem({ case_type: e.target.value })} className={`${inputCls} mt-1 font-normal`}>
                    <option value="">Nezadáno</option>
                    {CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
            </label>
            <label className="block text-xs font-semibold text-slate-600">Odpovídá (kdo spis vede)
                <input key={`${item.id}-resp`} defaultValue={item.responsible ?? ''} maxLength={120} placeholder="např. JUDr. Nováková" onBlur={(e) => { const v = e.target.value.trim(); if (v !== (item.responsible ?? '')) patchItem({ responsible: v }); }} className={`${inputCls} mt-1 font-normal`} />
            </label>
            <div className="text-xs font-semibold text-slate-600">Štítky
                <div className="mt-1 flex gap-2">
                    <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} maxLength={24} placeholder="Přidat štítek a Enter" aria-label="Nový štítek" disabled={labels.length >= MAX_LABELS} className={`${inputCls} font-normal`} />
                </div>
            </div>
            {labels.length > 0 && <ul className="flex flex-wrap gap-1.5 sm:col-span-3" aria-label="Štítky spisu">{labels.map((l) => <li key={l} className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-950"><Tag size={11} aria-hidden="true" />{l}<button type="button" onClick={() => patchItem({ labels: labels.filter((x) => x !== l) })} aria-label={`Odebrat štítek ${l}`} className="cursor-pointer"><X size={11} /></button></li>)}</ul>}
        </div>
    );
}
