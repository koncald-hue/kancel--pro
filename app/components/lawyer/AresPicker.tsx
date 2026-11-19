'use client';

import { useEffect, useRef, useState } from 'react';
import { Building, Loader2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AresCompany } from '@/lib/ares';
import { inputCls } from '../situation/caseUi';

// Vyhledání firmy v ARES podle IČO nebo názvu; po výběru předá název, IČO, DIČ a adresu
export default function AresPicker({ onPick, label = 'Najít firmu v ARES', compact = false }: { onPick: (c: AresCompany) => void; label?: string; compact?: boolean }) {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<AresCompany[]>([]);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');
    const seq = useRef(0);

    const run = async (text: string, mine: number) => {
        setBusy(true); setNote('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`/api/ares?${new URLSearchParams({ q: text })}`, { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } });
            if (mine !== seq.current) return;
            if (res.status === 429) { setNote('Příliš mnoho dotazů, zkuste to za chvíli.'); setResults([]); return; }
            if (!res.ok) { setNote('Registr ARES teď neodpovídá. Údaje můžete vyplnit ručně.'); setResults([]); return; }
            const body = await res.json() as { results?: AresCompany[]; note?: string };
            const list = body.results ?? [];
            setResults(list);
            if (!list.length) setNote(body.note ?? 'Nic nenalezeno. Zkontrolujte IČO nebo název.');
        } catch { if (mine === seq.current) { setNote('Registr ARES teď neodpovídá. Údaje můžete vyplnit ručně.'); setResults([]); } }
        finally { if (mine === seq.current) setBusy(false); }
    };

    // Hledá se průběžně během psaní (s krátkou prodlevou), není potřeba nic odesílat
    useEffect(() => {
        const text = q.trim();
        const mine = ++seq.current;
        if (/^[\d\s]+$/.test(text) && text.replace(/\s/g, '').length < 8) { const t = window.setTimeout(() => { if (mine === seq.current) { setResults([]); setNote(text.replace(/\s/g, '').length >= 3 ? 'IČO má 8 číslic, pokračujte v psaní.' : ''); setBusy(false); } }, 0); return () => window.clearTimeout(t); }
        if (text.length < 3) { const t = window.setTimeout(() => { if (mine === seq.current) { setResults([]); setNote(''); setBusy(false); } }, 0); return () => window.clearTimeout(t); }
        const t = window.setTimeout(() => { void run(text, mine); }, 450);
        return () => window.clearTimeout(t);
    }, [q]);

    return (
        <div className={`relative ${compact ? '' : 'rounded-xl border border-indigo-100 bg-indigo-50/50 p-3'}`}>
            <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                    <Building size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} placeholder="IČO nebo název firmy" aria-label={label} className={`${inputCls} pl-9`} />
                </div>
                <span className="inline-flex w-16 items-center justify-center text-xs font-semibold text-slate-500" aria-live="polite">{busy ? <Loader2 size={15} className="animate-spin" aria-label="Hledám" /> : <><Search size={13} className="mr-1" aria-hidden="true" />ARES</>}</span>
            </div>
            {note && <p role="status" className="mt-1.5 text-xs text-slate-600">{note}</p>}
            {results.length > 0 && (
                <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    {results.map((c) => (
                        <li key={c.ico}><button type="button" onClick={() => { onPick(c); setResults([]); setQ(''); }} className="block w-full px-3 py-2 text-left hover:bg-indigo-50 cursor-pointer"><span className="block text-sm font-semibold text-slate-900">{c.name}</span><span className="block text-xs text-slate-500">IČO {c.ico}{c.dic ? ` · DIČ ${c.dic}` : ''}{c.address ? ` · ${c.address}` : ''}</span></button></li>
                    ))}
                </ul>
            )}
            {!compact && <p className="mt-1.5 text-xs text-slate-500">Údaje se načtou z veřejného registru ARES (Ministerstvo financí). Před použitím je zkontrolujte.</p>}
        </div>
    );
}
