'use client';

import { useRef, useState } from 'react';
import { Building, Loader2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AresCompany } from '@/lib/ares';
import { ghostBtn, inputCls } from '../situation/caseUi';

// Vyhledání firmy v ARES podle IČO nebo názvu; po výběru předá název, IČO, DIČ a adresu
export default function AresPicker({ onPick, label = 'Najít firmu v ARES', compact = false }: { onPick: (c: AresCompany) => void; label?: string; compact?: boolean }) {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<AresCompany[]>([]);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');
    const seq = useRef(0);

    async function search() {
        const text = q.trim();
        if (text.length < 3) { setNote('Zadejte IČO nebo aspoň 3 znaky názvu.'); setResults([]); return; }
        const mine = ++seq.current;
        setBusy(true); setNote(''); setResults([]);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`/api/ares?${new URLSearchParams({ q: text })}`, { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } });
            if (mine !== seq.current) return;
            if (res.status === 429) { setNote('Příliš mnoho dotazů, zkuste to za chvíli.'); return; }
            if (!res.ok) { setNote('Registr ARES teď neodpovídá. Údaje můžete vyplnit ručně.'); return; }
            const body = await res.json() as { results?: AresCompany[]; note?: string };
            const list = body.results ?? [];
            if (list.length === 1 && /^\s*\d[\d\s]{6,}\d\s*$/.test(text)) { onPick(list[0]); setQ(''); return; }
            setResults(list);
            if (!list.length) setNote(body.note ?? 'Nic nenalezeno. Zkontrolujte IČO nebo název.');
        } catch { if (mine === seq.current) setNote('Registr ARES teď neodpovídá. Údaje můžete vyplnit ručně.'); }
        finally { if (mine === seq.current) setBusy(false); }
    }

    return (
        <div className={`relative ${compact ? '' : 'rounded-xl border border-indigo-100 bg-indigo-50/50 p-3'}`}>
            <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                    <Building size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search(); } }} placeholder="IČO nebo název firmy" aria-label={label} className={`${inputCls} pl-9`} />
                </div>
                <button type="button" onClick={() => void search()} disabled={busy} className={ghostBtn}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} ARES</button>
            </div>
            {note && <p role="status" className="mt-1.5 text-xs text-slate-600">{note}</p>}
            {results.length > 0 && (
                <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    {results.map((c) => (
                        <li key={c.ico}><button type="button" onClick={() => { onPick(c); setResults([]); setQ(''); }} className="block w-full px-3 py-2 text-left hover:bg-indigo-50 cursor-pointer"><span className="block text-sm font-semibold text-slate-900">{c.name}</span><span className="block text-xs text-slate-500">IČO {c.ico}{c.dic ? ` · DIČ ${c.dic}` : ''}{c.address ? ` · ${c.address}` : ''}</span></button></li>
                    ))}
                </ul>
            )}
            {!compact && <p className="mt-1.5 text-[11px] text-slate-500">Údaje se načtou z veřejného registru ARES (Ministerstvo financí). Před použitím je zkontrolujte.</p>}
        </div>
    );
}
