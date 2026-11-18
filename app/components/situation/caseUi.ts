export const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-700/40';
export const primaryBtn = 'inline-flex items-center gap-2 rounded-lg bg-indigo-800 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-900 disabled:opacity-60 cursor-pointer';
export const ghostBtn = 'inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer';
export const daysWord = (n: number) => (n === 1 ? 'den' : n >= 2 && n <= 4 ? 'dny' : 'dní');
export const shortDate = (d: Date) => d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });

import type { CaseBundle } from '@/lib/caseFile';
import type { LegalCase } from '@/lib/cases';

export type TabProps = {
    item: LegalCase;
    bundle: CaseBundle;
    userId: string;
    // Advokátský režim: odemyká klienty, údaje o věci, ZIP a vyšší limity
    lawyer: boolean;
    patchItem: (change: Partial<LegalCase>) => void;
    patchLocal?: (change: Partial<LegalCase>) => void;
    setBundle: (update: (b: CaseBundle) => CaseBundle) => void;
    fail: (err: unknown) => void;
};
