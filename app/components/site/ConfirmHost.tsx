'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { onConfirmRequest, type ConfirmRequest } from '@/lib/confirm';

// Dialog pro confirmAction(): u nebezpečných akcí červené tlačítko, u nejzávažnějších je nutné opsat slovo (např. SMAZAT)
export default function ConfirmHost() {
    const [req, setReq] = useState<ConfirmRequest | null>(null);
    const [typed, setTyped] = useState('');
    const cancelRef = useRef<HTMLButtonElement>(null);
    useEffect(() => { onConfirmRequest((r) => { setTyped(''); setReq(r); }); return () => onConfirmRequest(null); }, []);
    useEffect(() => {
        if (!req) return;
        const t = window.setTimeout(() => cancelRef.current?.focus(), 20);
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(false); } };
        window.addEventListener('keydown', onKey);
        return () => { window.clearTimeout(t); window.removeEventListener('keydown', onKey); };
    });
    if (!req) return null;
    function close(ok: boolean) { req?.resolve(ok); setReq(null); }
    const needText = req.typeToConfirm ?? '';
    const ready = !needText || typed.trim().toUpperCase() === needText.toUpperCase();
    const [first, ...rest] = req.message.split('\n\n');
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => close(false)}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <div className="flex items-start gap-3">
                    <span className={`mt-0.5 rounded-full p-2 ${req.danger ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>{req.danger ? <AlertTriangle size={20} aria-hidden="true" /> : <HelpCircle size={20} aria-hidden="true" />}</span>
                    <div className="min-w-0">
                        <h2 id="confirm-title" className="text-base font-bold text-slate-900">{req.title ?? (req.danger ? 'Opravdu to chcete udělat?' : 'Potvrzení')}</h2>
                        <div id="confirm-text" className="mt-1.5 space-y-2 text-sm leading-relaxed text-slate-700"><p className="whitespace-pre-line">{first}</p>{rest.map((p, i) => <p key={i} className={`whitespace-pre-line ${/nevratn|nelze vrátit|nejde vrátit/i.test(p) ? 'font-semibold text-rose-800' : ''}`}>{p}</p>)}</div>
                    </div>
                </div>
                {needText && (
                    <label className="mt-4 block text-sm text-slate-700">Pro potvrzení napište <strong className="font-mono">{needText}</strong>
                        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" spellCheck={false} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200" onKeyDown={(e) => { if (e.key === 'Enter' && ready) close(true); }} />
                    </label>
                )}
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button ref={cancelRef} type="button" onClick={() => close(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer">{req.cancelLabel ?? 'Zpět'}</button>
                    <button type="button" disabled={!ready} onClick={() => close(true)} className={`rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50 cursor-pointer ${req.danger ? 'bg-rose-700 hover:bg-rose-800' : 'bg-indigo-700 hover:bg-indigo-800'}`}>{req.confirmLabel ?? (req.danger ? 'Ano, provést' : 'Pokračovat')}</button>
                </div>
            </div>
        </div>
    );
}
