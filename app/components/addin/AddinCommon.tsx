'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { Scale } from 'lucide-react';
import { insideOffice } from '@/lib/officeBridge';
import { loadCases, type LegalCase } from '@/lib/cases';
import { inputCls } from '../situation/caseUi';
import LawyerGate from '../lawyer/LawyerGate';

// Společný rám doplňků pro Word a Outlook: načte Office.js, přihlásí uživatele (včetně druhého faktoru) a nabídne otevřené věci
export function AddinFrame({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <>
            <Script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js" strategy="afterInteractive" />
            <LawyerGate>
                <div className="mx-auto max-w-md space-y-3 p-3 text-sm">
                    <h1 className="flex items-center gap-2 text-base font-bold text-slate-900"><span className="rounded-md bg-indigo-600 p-1 text-white"><Scale size={14} aria-hidden="true" /></span> Kancelář Pro · {title}</h1>
                    {children}
                </div>
            </LawyerGate>
        </>
    );
}

// Office.js se načítá až po vykreslení stránky, proto se na něj čeká (nejdéle 15 s)
export function useOfficeReady(): 'wait' | 'ready' | 'none' {
    const [state, setState] = useState<'wait' | 'ready' | 'none'>(() => (insideOffice() ? 'ready' : 'wait'));
    useEffect(() => {
        if (state === 'ready') return;
        let n = 0;
        const t = window.setInterval(() => {
            n++;
            if (insideOffice()) { setState('ready'); window.clearInterval(t); } else if (n > 75) { setState('none'); window.clearInterval(t); }
        }, 200);
        return () => window.clearInterval(t);
    }, [state]);
    return state;
}

export function useOpenCases(): LegalCase[] | null {
    const [cases, setCases] = useState<LegalCase[] | null>(null);
    useEffect(() => { let a = true; loadCases().then((c) => { if (a) setCases(c.filter((x) => x.status === 'open')); }).catch(() => { if (a) setCases([]); }); return () => { a = false; }; }, []);
    return cases;
}

export function CasePicker({ cases, value, onChange, hint }: { cases: LegalCase[]; value: string; onChange: (id: string) => void; hint?: Record<string, string> }) {
    return (
        <label className="block text-xs font-semibold text-slate-600">Věc
            <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} mt-1 font-normal`}>
                <option value="">Vyberte věc…</option>
                {cases.map((c) => <option key={c.id} value={c.id}>{c.title}{c.client_name ? ` · ${c.client_name}` : ''}{hint?.[c.id] ? ` (${hint[c.id]})` : ''}</option>)}
            </select>
        </label>
    );
}
