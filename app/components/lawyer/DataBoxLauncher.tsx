'use client';

import { useEffect, useState } from 'react';
import { MailCheck, X } from 'lucide-react';
import LawyerDataBox from './LawyerDataBox';

// Kulaté tlačítko vpravo dole: otevře datovou schránku v postranním panelu z kterékoli stránky kanceláře
export default function DataBoxLauncher() {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    return (
        <>
            <button type="button" onClick={() => setOpen(true)} aria-label="Otevřít datovou schránku" title="Datová schránka" className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-700 text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-800 hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 cursor-pointer"><MailCheck size={24} aria-hidden="true" /></button>
            {open && (
                <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Datová schránka">
                    <button type="button" aria-label="Zavřít datovou schránku" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-900/40" />
                    <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl">
                        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
                            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><MailCheck size={18} className="text-indigo-700" aria-hidden="true" /> Datová schránka</h2>
                            <button type="button" onClick={() => setOpen(false)} aria-label="Zavřít" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"><X size={18} /></button>
                        </header>
                        <div className="flex-1 overflow-y-auto p-5"><LawyerDataBox /></div>
                    </aside>
                </div>
            )}
        </>
    );
}
