'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Compass, Loader2, Search, Sparkles, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { KINDS, groupResults, splitMatch, type SearchRow } from '@/lib/search';
import { requestOpen, searchCached } from '@/lib/dataBoxState';
import { STATUS_LABELS } from '@/lib/isds';
import { matchTools, type Tool } from '@/lib/tools';

// Hledání napříč celou kanceláří: věci, klienti, poznámky, kontakty, soubory, lhůty, poptávky, vzory, výkazy, faktury
export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
    const router = useRouter();
    const [q, setQ] = useState('');
    const [rows, setRows] = useState<SearchRow[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [active, setActive] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const seq = useRef(0);
    const [ai, setAi] = useState<{ q: string; items: (Tool & { reason: string })[]; state: 'idle' | 'busy' | 'none' | 'off' }>({ q: '', items: [], state: 'idle' });

    useEffect(() => { if (open) window.setTimeout(() => input.current?.focus(), 0); }, [open]);

    useEffect(() => {
        const text = q.trim();
        const mine = ++seq.current;
        const t = window.setTimeout(async () => {
            if (text.length < 2) { if (mine === seq.current) { setRows([]); setError(''); setBusy(false); } return; }
            setBusy(true); setError('');
            const { data, error: err } = await supabase.rpc('search_all', { p_q: text });
            if (mine !== seq.current) return;
            setBusy(false);
            if (err) { setRows([]); setError(/search_all|schema cache|find the function/i.test(err.message) ? 'Hledání zatím není v databázi zapnuté (chybí spuštění souboru hledani.sql).' : err.message); return; }
            // Zprávy načtené z datové schránky (jen z této relace) se přidají k výsledkům; kliknutím se otevře schránka
            const live: SearchRow[] = searchCached(text).map((r) => ({ kind: 'datovka', id: `live:${r.id}`, case_id: null, title: r.annotation || '(bez věci)', snippet: `V datové schránce · od ${r.sender} · ${STATUS_LABELS[r.status] ?? r.status}`, rank: 1 }));
            setRows([...live, ...((data ?? []) as SearchRow[])]); setActive(0);
        }, text.length < 2 ? 0 : 250);
        return () => window.clearTimeout(t);
    }, [q]);

    const groups = groupResults(rows);
    const flat = groups.flatMap((g) => g.rows);
    // Nástroje a stránky: okamžitá lokální shoda, a když nic nesedí, doporučení od AI
    const text = q.trim();
    const local = text.length >= 2 ? matchTools(text).slice(0, 4).map((m) => ({ ...m.tool, reason: '' })) : [];
    const aiItems = ai.q === text ? ai.items.filter((a) => !local.some((l) => l.id === a.id)) : [];
    const tools = [...local, ...aiItems];
    const nothing = text.length >= 3 && !busy && !error && flat.length === 0 && local.length === 0;

    async function askAi(query: string) {
        setAi({ q: query, items: [], state: 'busy' });
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/assist', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ q: query }) });
            if (res.status === 503) { setAi({ q: query, items: [], state: 'off' }); return; }
            if (!res.ok) { setAi({ q: query, items: [], state: 'none' }); return; }
            const out = await res.json() as { suggestions: (Tool & { reason: string })[] };
            setAi({ q: query, items: out.suggestions.map((x) => ({ ...x, words: [] })), state: out.suggestions.length ? 'idle' : 'none' });
        } catch { setAi({ q: query, items: [], state: 'none' }); }
    }
    // Když hledání nic nenajde, AI se zeptá samo (až po krátké pauze v psaní)
    useEffect(() => {
        if (!nothing || ai.q === text) return;
        const t = window.setTimeout(() => { void askAi(text); }, 700);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nothing, text]);

    function goTool(t: Tool) { onClose(); router.push(t.href); }

    function go(r: SearchRow) { onClose(); if (r.id.startsWith('live:')) { requestOpen(); return; } router.push(KINDS[r.kind]?.href(r) ?? '/kancelar'); }

    function onKey(e: React.KeyboardEvent) {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, tools.length + flat.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
        else if (e.key === 'Enter' && active < tools.length && tools[active]) { e.preventDefault(); goTool(tools[active]); }
        else if (e.key === 'Enter' && flat[active - tools.length]) { e.preventDefault(); go(flat[active - tools.length]); }
    }

    useEffect(() => { document.getElementById(`sr-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

    if (!open) return null;
    let index = tools.length - 1;
    const mark = (text: string) => { const [a, m, b] = splitMatch(text, q); return m ? <>{a}<mark className="rounded bg-amber-200 px-0.5 text-slate-900">{m}</mark>{b}</> : text; };
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-[8vh]" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-label="Hledání" onClick={(e) => e.stopPropagation()} onKeyDown={onKey} className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
                    {busy ? <Loader2 size={18} className="shrink-0 animate-spin text-slate-400" aria-hidden="true" /> : <Search size={18} className="shrink-0 text-slate-400" aria-hidden="true" />}
                    <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hledat ve věcech, klientech, souborech, nebo co chcete udělat…" aria-label="Hledaný text" className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400" />
                    <button type="button" onClick={onClose} aria-label="Zavřít hledání" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"><X size={18} /></button>
                </div>
                <div className="overflow-y-auto" role="listbox" aria-label="Výsledky">
                    {error && <p role="alert" className="m-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
                    {!error && q.trim().length < 2 && <p className="px-5 py-8 text-center text-sm text-slate-500">Pište aspoň dvě písmena. Hledá se bez ohledu na velikost písmen a diakritiku. <span className="block mt-1 text-xs text-slate-400">Šifrované zprávy a chat se prohledat nedají, server je nevidí.</span></p>}
                    {tools.length > 0 && (
                        <section aria-label="Nástroje a stránky">
                            <h3 className="sticky top-0 flex items-center gap-1.5 bg-slate-50 px-5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500"><Compass size={12} aria-hidden="true" /> Nástroje a stránky</h3>
                            <ul>{tools.map((t, i) => (
                                <li key={t.id}><button type="button" id={`sr-${i}`} role="option" aria-selected={active === i} onMouseEnter={() => setActive(i)} onClick={() => goTool(t)} className={`block w-full px-5 py-2.5 text-left cursor-pointer ${active === i ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">{t.name}{t.reason && <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800"><Sparkles size={10} aria-hidden="true" /> doporučeno</span>}</span>
                                    <span className="mt-0.5 block text-xs text-slate-600">{t.reason || t.desc}</span>
                                </button></li>))}</ul>
                        </section>
                    )}
                    {!error && text.length >= 3 && ai.q === text && ai.state === 'busy' && <p className="flex items-center justify-center gap-2 px-5 py-6 text-sm text-slate-500" role="status"><Sparkles size={15} className="text-violet-600" aria-hidden="true" /> Hledám, co by se vám mohlo hodit…</p>}
                    {!error && text.length >= 2 && !busy && flat.length === 0 && tools.length === 0 && ai.state !== 'busy' && <p className="px-5 py-8 text-center text-sm text-slate-500">Nic nenalezeno.{ai.q === text && ai.state === 'off' ? ' Nápověda s AI zatím není zapnutá.' : ''}</p>}
                    {!error && text.length >= 3 && !busy && flat.length > 0 && ai.q !== text && <button type="button" onClick={() => void askAi(text)} className="mx-5 mb-2 mt-2 inline-flex items-center gap-1.5 rounded-full border border-violet-200 px-3 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-50 cursor-pointer"><Sparkles size={12} aria-hidden="true" /> Nenašli jste? Poradit s AI</button>}
                    {groups.map((g) => {
                        const meta = KINDS[g.kind];
                        const Icon = meta.icon;
                        return (
                            <section key={g.kind} aria-label={meta.label}>
                                <h3 className="sticky top-0 flex items-center gap-1.5 bg-slate-50 px-5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500"><Icon size={12} aria-hidden="true" /> {meta.label} ({g.rows.length})</h3>
                                <ul>{g.rows.map((r) => {
                                    index += 1;
                                    const i = index;
                                    return (
                                        <li key={`${r.kind}-${r.id}`}>
                                            <button type="button" id={`sr-${i}`} role="option" aria-selected={active === i} onMouseEnter={() => setActive(i)} onClick={() => go(r)} className={`block w-full px-5 py-2.5 text-left cursor-pointer ${active === i ? 'bg-indigo-50' : ''}`}>
                                                <span className="block truncate text-sm font-semibold text-slate-900">{mark(r.title)}</span>
                                                {r.snippet && <span className="mt-0.5 block line-clamp-2 text-xs text-slate-600">{mark(r.snippet)}</span>}
                                            </button>
                                        </li>
                                    );
                                })}</ul>
                            </section>
                        );
                    })}
                </div>
                <p className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-400">↑↓ výběr · Enter otevřít · Esc zavřít</p>
            </div>
        </div>
    );
}
