'use client';

import { confirmAction } from '@/lib/confirm';
import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ParcelaView, PropertySnapshot } from '@/lib/katastr';
import KatastrSearch, { PropertyCard, snapshotLabel } from '../lawyer/KatastrSearch';
import type { TabProps } from './caseUi';

type Saved = { id: string; label: string; snapshot: PropertySnapshot | ParcelaView; data_as_of: string; created_at: string; watch?: boolean; watch_checked_at?: string | null; watch_error?: string };

// Nemovitosti ve spisu: vyhledání parcely v katastru a uložení jejích údajů ke věci
export default function CaseKatastrTab({ item, userId, fail }: TabProps) {
    const [saved, setSaved] = useState<Saved[] | null>(null);

    const load = useCallback(async () => {
        const { data, error } = await supabase.from('case_properties').select('*').eq('case_id', item.id).order('created_at', { ascending: false });
        if (error) { fail(new Error(/case_properties|relation|does not exist/i.test(error.message) ? 'Katastr ve spisu zatím není v databázi zapnutý (chybí spuštění souboru katastr.sql).' : error.message)); setSaved([]); return; }
        setSaved((data ?? []) as Saved[]);
    }, [item.id, fail]);

    useEffect(() => {
        let cancelled = false;
        void (async () => { await Promise.resolve(); if (!cancelled) await load(); })();
        return () => { cancelled = true; };
    }, [load]);

    async function save(p: PropertySnapshot, dataAsOf: string) {
        const { error } = await supabase.from('case_properties').insert({ case_id: item.id, user_id: userId, label: snapshotLabel(p).slice(0, 200), snapshot: p, data_as_of: dataAsOf });
        if (error) throw new Error(error.message);
        await load();
    }

    async function toggleWatch(s: Saved) {
        const { error } = await supabase.from('case_properties').update({ watch: !s.watch, watch_error: '' }).eq('id', s.id);
        if (error) { fail(new Error(/watch|column|schema cache/i.test(error.message) ? 'Hlídání vyžaduje SQL migraci 20261118_10.' : error.message)); return; }
        setSaved((l) => (l ?? []).map((x) => (x.id === s.id ? { ...x, watch: !s.watch, watch_error: '' } : x)));
    }

    async function remove(id: string) {
        if (!await confirmAction('Odebrat nemovitost ze spisu?')) return;
        const { error } = await supabase.from('case_properties').delete().eq('id', id);
        if (error) fail(new Error(error.message)); else setSaved((s) => (s ?? []).filter((x) => x.id !== id));
    }

    return (
        <div className="space-y-5">
            <KatastrSearch onSave={save} />
            <section aria-label="Nemovitosti ve spisu">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Uloženo ve spisu</h2>
                {saved === null ? <p className="mt-3 text-sm text-slate-500" role="status">Načítám…</p> : saved.length === 0 ? <p className="mt-3 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">K této věci zatím není uložena žádná nemovitost.</p> : (
                    <div className="mt-3 space-y-3">
                        {saved.map((s) => (
                            <PropertyCard key={s.id} snap={s.snapshot} dataAsOf={s.data_as_of || null}>
                                {(s.snapshot as { kind?: string }).kind === 'rizeni' && (
                                    <span className="flex flex-wrap items-center gap-2 text-xs">
                                        <label className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-slate-800"><input type="checkbox" checked={!!s.watch} onChange={() => void toggleWatch(s)} className="h-4 w-4 accent-indigo-800" /> Hlídat změny řízení</label>
                                        {s.watch && <span className="text-slate-500">{s.watch_checked_at ? `naposledy zkontrolováno ${new Date(s.watch_checked_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'zkontroluje se při příštím otevření aplikace'}</span>}
                                        {s.watch && s.watch_error && <span className="text-amber-800">{s.watch_error}</span>}
                                    </span>
                                )}
                                <span className="flex items-center gap-2 text-xs text-slate-500">uloženo {new Date(s.created_at).toLocaleDateString('cs-CZ')}<button type="button" onClick={() => void remove(s.id)} aria-label={`Odebrat ${s.label}`} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50"><Trash2 size={15} /></button></span>
                            </PropertyCard>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
