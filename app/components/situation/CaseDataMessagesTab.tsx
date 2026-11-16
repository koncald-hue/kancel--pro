'use client';

import { useCallback, useEffect, useState } from 'react';
import { Inbox, MailCheck, Send, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { dmMarker, type SavedMessage } from '@/lib/dataMessages';
import type { TabProps } from './caseUi';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–');

// Datové zprávy přiřazené k věci: záznam o zprávě a odkaz na přílohy v souborech věci
export default function CaseDataMessagesTab({ item, bundle, fail }: TabProps) {
    const [rows, setRows] = useState<SavedMessage[] | null | undefined>(undefined);

    const load = useCallback(async () => {
        const { data, error } = await supabase.from('case_data_messages').select('*').eq('case_id', item.id).order('delivered_at', { ascending: false });
        if (error) { setRows(null); if (!/case_data_messages|schema cache|does not exist/i.test(error.message)) fail(new Error(error.message)); return; }
        setRows((data ?? []) as SavedMessage[]);
    }, [item.id, fail]);
    useEffect(() => { let alive = true; Promise.resolve().then(() => { if (alive) void load(); }); return () => { alive = false; }; }, [load]);

    async function remove(r: SavedMessage) {
        if (!window.confirm('Odebrat záznam o zprávě z věci? Uložené přílohy zůstanou v souborech věci.')) return;
        const { error } = await supabase.from('case_data_messages').delete().eq('id', r.id);
        if (error) fail(new Error(error.message)); else setRows((l) => (l ?? []).filter((x) => x.id !== r.id));
    }

    if (rows === undefined) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (rows === null) return <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">Datové zprávy ve věci zatím nejsou v databázi zapnuté (chybí spuštění souboru datove-zpravy-ve-veci.sql).</p>;

    return (
        <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-600">Sem se ukládají datové zprávy, které přiřadíte k věci v datové schránce (kulaté tlačítko vpravo dole). Přílohy najdete v záložce Soubory s poznámkou „Datová zpráva …“.</p>
            {rows.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><MailCheck size={26} className="mx-auto text-indigo-700" aria-hidden="true" /><p className="mt-2 text-sm text-slate-600">Ke věci zatím není přiřazená žádná datová zpráva.</p></div>
            ) : (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    {rows.map((r) => {
                        const files = bundle.files.filter((f) => f.note === dmMarker(r.dm_id));
                        return (
                            <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${r.direction === 'received' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'}`}>{r.direction === 'received' ? <Inbox size={15} aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-900">{r.annotation || '(bez věci)'}</p>
                                    <p className="truncate text-xs text-slate-500">{r.direction === 'received' ? `od ${r.sender || '–'}` : `komu ${r.recipient || '–'}`} · {fmt(r.delivered_at)} · ID {r.dm_id}</p>
                                    <p className="mt-0.5 text-xs text-slate-500">{files.length ? `Přílohy ve spisu: ${files.map((f) => f.name).join(', ')}` : 'Přílohy zatím neuloženy'}</p>
                                </div>
                                <button type="button" onClick={() => void remove(r)} aria-label="Odebrat záznam" className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={15} /></button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
