'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CornerDownRight, FolderTree, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BLANK_CASE, createCase, type NewCase } from '@/lib/cases';
import { ghostBtn, inputCls, primaryBtn, type TabProps } from './caseUi';

type Row = { id: string; title: string; status: 'open' | 'done'; reference: string | null };

// Podspisy: věci patřící pod tuto věc (např. exekuce pod hlavním řízením), a odkaz na nadřazenou věc, pokud je tato věc podspis
export default function CaseSubcases({ item, userId, fail }: Pick<TabProps, 'item' | 'userId' | 'fail'>) {
    const [children, setChildren] = useState<Row[] | null>(null);
    const [parent, setParent] = useState<{ id: string; title: string } | null>(null);
    const [title, setTitle] = useState('');
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState(false);

    const load = useCallback(async () => {
        const [c, p] = await Promise.all([
            supabase.from('cases').select('id, title, status, reference').eq('parent_id', item.id).order('created_at'),
            item.parent_id ? supabase.from('cases').select('id, title').eq('id', item.parent_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        ]);
        // Dokud migrace 20261119_27 není spuštěná, sloupec parent_id neexistuje a podspisy se tiše skryjí
        setChildren(c.error ? null : ((c.data ?? []) as Row[]));
        setParent((p.data as { id: string; title: string } | null) ?? null);
    }, [item.id, item.parent_id]);
    useEffect(() => { let alive = true; Promise.resolve().then(() => { if (alive) void load(); }); return () => { alive = false; }; }, [load]);

    async function add(e: React.FormEvent) {
        e.preventDefault();
        const t = title.trim();
        if (!t) return;
        setBusy(true);
        try {
            const input = { ...BLANK_CASE, title: t.slice(0, 100), parent_id: item.id, client_name: item.client_name ?? '', client_id: item.client_id ?? null, client_email: item.client_email ?? '', client_phone: item.client_phone ?? '', authority: '' } as unknown as NewCase;
            await createCase(userId, input);
            setTitle(''); setOpen(false);
            await load();
        } catch (err) { fail(err); } finally { setBusy(false); }
    }

    if (children === null && !parent) return null;
    return (
        <section aria-label="Podspisy" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            {parent && <p className="mb-3 flex items-center gap-1.5 text-sm text-slate-700"><CornerDownRight size={15} className="text-indigo-800" aria-hidden="true" /> Podspis k věci <Link href={`/kancelar/veci/${parent.id}`} className="font-semibold text-indigo-800 hover:underline">{parent.title}</Link></p>}
            <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><FolderTree size={15} className="text-indigo-800" aria-hidden="true" /> Podspisy{children && children.length > 0 ? ` (${children.length})` : ''}</h2>
                {!open && <button type="button" onClick={() => setOpen(true)} className={`${ghostBtn} shrink-0 whitespace-nowrap`}><Plus size={14} /> Nový podspis</button>}
            </div>
            {children && children.length === 0 && !open && <p className="mt-2 text-sm text-slate-600">Věc můžete rozdělit na části, například hlavní řízení, odvolání a exekuci. Každý podspis má vlastní lhůty, dokumenty a čas.</p>}
            {children && children.length > 0 && <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">{children.map((c) => <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><Link href={`/kancelar/veci/${c.id}`} className="min-w-0 truncate font-semibold text-indigo-800 hover:underline">{c.title}{c.reference ? <span className="ml-2 font-normal text-slate-500">{c.reference}</span> : null}</Link><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${c.status === 'done' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-900'}`}>{c.status === 'done' ? 'Vyřešeno' : 'Otevřený'}</span></li>)}</ul>}
            {open && (
                <form onSubmit={add} className="mt-3 flex flex-wrap gap-2">
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Název podspisu (např. Exekuce)" aria-label="Název podspisu" maxLength={100} autoFocus className={`${inputCls} min-w-0 flex-1`} />
                    <button type="submit" disabled={busy || !title.trim()} className={primaryBtn}>Založit</button>
                    <button type="button" onClick={() => setOpen(false)} className={ghostBtn}>Zrušit</button>
                    <p className="w-full text-xs text-slate-500">Klient a kontakt se převezmou z této věci.</p>
                </form>
            )}
        </section>
    );
}
