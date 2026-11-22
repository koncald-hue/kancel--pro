'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { downloadTextFile } from '@/lib/caseFile';
import { daysUntil } from '@/lib/cases';
import { czk, type LawyerAccess } from '@/lib/lawyer';
import { ghostBtn, inputCls } from '../situation/caseUi';
import ContactActions from '../lawyer/ContactActions';
import AdminNote from './AdminNote';
import { confirmAction } from '@/lib/confirm';

type OrderRow = { user_id: string; status: 'pending' | 'paid' | 'cancelled' | 'refund_due'; price_czk: number; paid_at: string | null };
type Filter = 'all' | 'verified' | 'pending' | 'active' | 'expiring' | 'expired' | 'refund';

const FILTERS: [Filter, string][] = [['all', 'Všichni'], ['verified', 'Profil vyplněn'], ['pending', 'Profil nevyplněn'], ['active', 'Platící'], ['expiring', 'Brzy končí'], ['expired', 'Neaktivní'], ['refund', 'K vrácení peněz']];
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmt = (iso?: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('cs-CZ') : '–');

function Tile({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${tone ?? 'text-slate-900'}`}>{value}</p>{note && <p className="text-xs text-slate-500">{note}</p>}</div>;
}

const addMonths = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Nastavení přístupu podle data: budoucí datum = přístup do tohoto dne (zkušební zůstává zkušební), dnešní nebo minulé = přístup skončí
function UntilDate({ row, onSet }: { row: LawyerAccess; onSet: (row: LawyerAccess, status: LawyerAccess['status'], until: string | null) => void }) {
    const [date, setDate] = useState(row.until ?? '');
    const apply = () => { if (!date) return; onSet(row, date <= todayIso() ? 'expired' : row.status === 'trial' ? 'trial' : 'active', date); };
    return (
        <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-slate-600">Přístup do data
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} mt-1 block`} />
            </label>
            <button type="button" onClick={apply} disabled={!date} className={ghostBtn}>Nastavit datum</button>
            <span className="text-[11px] text-slate-500">Dnešní nebo minulé datum přístup ukončí.</span>
        </div>
    );
}

// Přehled advokátů pro správce: profily, předplatné a platby. Obsah jejich věcí správce nevidí.
export default function AdminLawyers({ rows, onSet, onDeleted }: { rows: LawyerAccess[]; onSet: (row: LawyerAccess, status: LawyerAccess['status'], until: string | null) => void; onDeleted?: (message: string) => void }) {
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [open, setOpen] = useState('');
    const [now] = useState(() => Date.now());

    useEffect(() => {
        let cancelled = false;
        supabase.from('lawyer_orders').select('user_id, status, price_czk, paid_at').then(({ data }) => { if (!cancelled) setOrders((data ?? []) as OrderRow[]); });
        return () => { cancelled = true; };
    }, [rows]);

    const deleteAccount = async (r: LawyerAccess, hasPaid: boolean) => {
        const who = r.email;
        if (!(await confirmAction(`Smazat účet ${who} úplně? Zmizí přihlášení i všechna data účtu (spisy, klienti, lhůty, soubory, nastavení). Smazání je nevratné.${hasPaid ? ' Účet má zaplacené objednávky, ty se smažou také (účetní záznamy zůstanou v účetní knize).' : ''}`, { title: 'Smazat účet', confirmLabel: 'Pokračovat', danger: true }))) return;
        if (!(await confirmAction(`Opravdu naposledy: smazat účet ${who}? Pro potvrzení opište e-mail.`, { title: 'Poslední potvrzení', confirmLabel: 'Smazat účet navždy', danger: true, typeToConfirm: who }))) return;
        const { data: sess } = await supabase.auth.getSession();
        const res = await fetch('/api/admin/delete-user', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.session?.access_token ?? ''}` }, body: JSON.stringify({ userId: r.user_id, force: hasPaid }) });
        const out = (await res.json().catch(() => ({}))) as { message?: string; mailed?: boolean };
        if (!res.ok) { onDeleted?.(/admin_delete_user|schema cache|Could not find/i.test(out.message ?? '') ? 'Mazání účtů ještě není v databázi zapnuté (chybí spuštění souboru 20261122_34_mazani-uctu-a-skryte-emaily.sql).' : (out.message || 'Smazání se nepodařilo.')); return; }
        onDeleted?.(`Účet ${who} je smazaný.${out.mailed ? ' Advokátovi odešel e-mail.' : ' E-mail advokátovi se odeslat nepodařilo.'}`);
    };

    const today = todayIso();
    const data = useMemo(() => rows.map((r) => {
        const mine = orders.filter((o) => o.user_id === r.user_id);
        const paid = mine.filter((o) => o.status === 'paid');
        const left = r.until ? daysUntil(new Date(`${r.until}T12:00:00`)) : null;
        const activeSub = r.status === 'active' && !!r.until && r.until >= today;
        return { r, paidSum: paid.reduce((s, o) => s + o.price_czk, 0), paidCount: paid.length, refund: mine.some((o) => o.status === 'refund_due'), left, activeSub, expiring: activeSub && left !== null && left <= 14 };
    }), [rows, orders, today]);

    const revenueAll = orders.filter((o) => o.status === 'paid').reduce((s, o) => s + o.price_czk, 0);
    const monthAgo = now - 30 * 86_400_000;
    const revenue30 = orders.filter((o) => o.status === 'paid' && o.paid_at && new Date(o.paid_at).getTime() >= monthAgo).reduce((s, o) => s + o.price_czk, 0);

    const q = query.trim().toLowerCase();
    const shown = data.filter(({ r, activeSub, expiring, refund }) => {
        if (filter === 'verified' && r.verification_status !== 'verified') return false;
        if (filter === 'pending' && r.verification_status === 'verified') return false;
        if (filter === 'active' && !activeSub) return false;
        if (filter === 'expiring' && !expiring) return false;
        if (filter === 'expired' && activeSub) return false;
        if (filter === 'refund' && !refund) return false;
        return !q || `${r.email} ${r.display_name ?? ''} ${r.register_name ?? ''} ${r.firm_name} ${r.bar_number ?? ''} ${r.phone ?? ''}`.toLowerCase().includes(q);
    });

    function exportCsv() {
        const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
        const lines = [['Jméno', 'E-mail', 'Kancelář', 'Telefon', 'Evidenční číslo ČAK', 'Profese', 'Adresa kanceláře', 'Kontaktní e-mail', 'Profil vyplněn', 'Profil vyplněn dne', 'Předplatné', 'Platí do', 'Zaplaceno celkem (Kč)', 'Počet plateb', 'Registrace'].map(cell).join(';')];
        for (const { r, paidSum, paidCount } of shown) lines.push([r.register_name || r.display_name || '', r.email, r.firm_name, r.phone ?? '', r.bar_number ?? '', r.profession === 'jiny' ? 'jiný právník' : 'advokát', r.office ?? '', r.contact_email ?? '', r.verification_status === 'verified' ? 'ano' : 'ne', r.verified_at ? fmt(r.verified_at) : '', r.status, r.until ?? '', String(paidSum), String(paidCount), fmt((r as unknown as { created_at?: string }).created_at)].map(cell).join(';'));
        downloadTextFile('advokati.csv', `﻿${lines.join('\r\n')}\r\n`, 'text/csv;charset=utf-8');
    }

    const badge = (v?: string) => v === 'verified' ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900">vyplněn</span> : <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-900">nevyplněn</span>;

    return (
        <section className="mt-6" aria-label="Přehled advokátů">
            <h2 className="text-xl font-bold text-slate-900">Přehled advokátů</h2>
            <p className="mt-1 text-xs text-slate-600">Vidíte, kdo aplikaci používá: jména, kontakty, evidenční čísla, předplatné a platby. Obsah jejich spisů, souborů a zpráv nevidíte a vidět nemůžete.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Tile label="Advokátů celkem" value={String(rows.length)} note={`${rows.filter((r) => r.verification_status === 'verified').length} s vyplněným profilem`} />
                <Tile label="Platící" value={String(data.filter((d) => d.activeSub).length)} note={`${data.filter((d) => d.expiring).length} brzy končí`} />
                <Tile label="Profil nevyplněn" value={String(rows.filter((r) => r.verification_status !== 'verified').length)} tone={rows.some((r) => r.verification_status !== 'verified') ? 'text-indigo-800' : undefined} />
                <Tile label="K vrácení peněz" value={String(data.filter((d) => d.refund).length)} tone={data.some((d) => d.refund) ? 'text-rose-700' : undefined} />
                <Tile label="Tržby celkem" value={czk(revenueAll)} />
                <Tile label="Tržby za 30 dní" value={czk(revenue30)} />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
                {FILTERS.map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={`rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer ${filter === id ? 'border-indigo-700 bg-indigo-100 text-indigo-950' : 'border-slate-200 bg-white text-slate-700'}`}>{label}</button>)}
                <div className="relative ml-auto min-w-48 flex-1 sm:max-w-64"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Jméno, e-mail, číslo…" aria-label="Hledat advokáta" className={`${inputCls} pl-9`} /></div>
                <button type="button" onClick={exportCsv} disabled={!shown.length} className={ghostBtn}><Download size={15} /> CSV</button>
            </div>

            {shown.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">{rows.length ? 'Nic neodpovídá filtru.' : 'Zatím nikdo.'}</p> : (
                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[980px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Advokát</th><th className="px-3 py-2.5">Kancelář a kontakt</th><th className="px-3 py-2.5">Ev. č. ČAK</th><th className="px-3 py-2.5">Profil</th><th className="px-3 py-2.5">Předplatné</th><th className="px-3 py-2.5">Zaplaceno</th><th className="px-2 py-2.5"><span className="sr-only">Detail</span></th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {shown.map(({ r, paidSum, paidCount, left, activeSub, expiring, refund }) => (
                                <Fragment key={r.user_id}>
                                    <tr className={refund ? 'bg-rose-50/60' : ''}>
                                        <td className="px-4 py-2.5"><span className="font-semibold text-slate-900">{r.register_name || r.display_name || '(bez jména)'}</span><span className="block text-xs text-slate-500">{r.email}{r.firm_name && ` · ${r.firm_name}`}</span></td>
                                        <td className="px-3 py-2.5 text-slate-700">{r.firm_name || '–'}<span className="block text-xs text-slate-500">{r.phone || 'bez telefonu'}{r.contact_email ? ` · ${r.contact_email}` : ''}</span></td>
                                        <td className="px-3 py-2.5 text-slate-700">{r.bar_number || '–'}<span className="block text-xs text-slate-500">{r.profession === 'jiny' ? 'jiný právník' : 'advokát'}</span></td>
                                        <td className="px-3 py-2.5">{badge(r.verification_status)}{r.verified_at && <span className="block text-xs text-slate-500">{fmt(r.verified_at)}</span>}</td>
                                        <td className="px-3 py-2.5">{activeSub ? <><span className="font-semibold text-emerald-800">aktivní</span><span className={`block text-xs ${expiring ? 'font-bold text-rose-700' : 'text-slate-500'}`}>do {fmt(r.until)}{left !== null && ` (${left} dní)`}</span></> : <span className="text-slate-500">{r.status === 'trial' ? 'zkušební' : 'neaktivní'}{r.until && <span className="block text-xs">do {fmt(r.until)}</span>}</span>}</td>
                                        <td className="px-3 py-2.5 text-slate-700">{czk(paidSum)}<span className="block text-xs text-slate-500">{paidCount}× {refund && <strong className="text-rose-700">vrátit peníze</strong>}</span></td>
                                        <td className="px-2 py-2.5 text-right"><button type="button" onClick={() => setOpen(open === r.user_id ? '' : r.user_id)} aria-expanded={open === r.user_id} aria-label={`Detail ${r.email}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"><ChevronDown size={16} className={open === r.user_id ? 'rotate-180' : ''} /></button></td>
                                    </tr>
                                    {open === r.user_id && (
                                        <tr className="bg-slate-50/60">
                                            <td colSpan={7} className="px-4 py-3 text-xs text-slate-700">
                                                <p>Adresa: {r.office || '–'} · Web: {r.website || '–'}</p>
                                                <p className="mt-1">Kontakt: <ContactActions email={r.contact_email || r.email} phone={r.phone} /></p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <button type="button" onClick={() => onSet(r, 'active', addMonths(1))} className={ghostBtn}>Ručně aktivovat 1 měsíc</button>
                                                    <button type="button" onClick={() => onSet(r, 'active', addMonths(12))} className={ghostBtn}>Ručně aktivovat 1 rok</button>
                                                    <button type="button" onClick={() => onSet(r, 'expired', null)} className={`${ghostBtn} text-rose-700`}>Zrušit přístup</button>
                                                    <button type="button" onClick={() => void deleteAccount(r, paidCount > 0 || refund)} className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 cursor-pointer">Smazat účet</button>
                                                </div>
                                                <UntilDate key={`${r.user_id}-${r.until}`} row={r} onSet={onSet} />
                                                <AdminNote userId={r.user_id} />
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
