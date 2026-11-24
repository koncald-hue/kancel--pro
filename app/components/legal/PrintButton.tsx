'use client';

export function PrintButton({ label = 'Stáhnout jako PDF / vytisknout' }: { label?: string }) {
    return (
        <button
            type="button"
            onClick={() => window.print()}
            className="print:hidden rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
            {label}
        </button>
    );
}
