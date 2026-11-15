'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadCases, type LegalCase } from '@/lib/cases';
import type { LawyerClient } from '@/lib/lawyer';
import { inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

const EMPTY = { name: '', email: '', phone: '', note: '', rate: '' };

export default function LawyerClients() {
    const { userId } = useLawyer();
    const [clients, setClients] = useState<LawyerClient[]>([]);
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [form, setForm] = useState(EMPTY);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');

    useEffect(() => {
        let cancelled = false;
        Promise.all([supabase.from('lawyer_clients').select('*').order('name'), loadCases()])
            .then(([res, all]) => { if (cancelled) return; if (res.error) throw new Error(res.error.message); setClients((res.data ?? []) as LawyerClient[]); setCases(all); })
            .catch(() => { if (!cancelled) setError('Klienty se nepodařilo načíst. Zkontrolujte, že je spuštěné SQL lawyer.sql.'); });
        return () => { cancelled = true; };
    }, []);

    const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

    async function add() {
        const name = form.name.trim();
        if (!name) return;
        const rate = form.rate.trim() ? Number(form.rate.replace(',', '.')) : null;
        const { data, error: err } = await supabase.from('lawyer_clients').insert({ user_id: userId, name, email: form.email.trim(), phone: form.phone.trim(), note: form.note.trim(), hourly_rate: Number.isFinite(rate) ? rate : null }).select('*').single();
        if (err) { setError(err.code === '23505' ? 'Klient s tímto jménem už existuje.' : err.message); return; }
        setClients((c) => [...c, data as LawyerClient].sort((a, b) => a.name.localeCompare(b.name, 'cs')));
        setForm(EMPTY); setError('');
    }

    async function remove(c: LawyerClient) {
        if (!window.confirm(`Smazat klienta „${c.name}“? Věci zůstanou zachované.`)) return;
        const { error: err } = await supabase.from('lawyer_clients').delete().eq('id', c.id);
        if (err) setError(err.message); else setClients((list) => list.filter((x) => x.id !== c.id));
    }

    async function saveRate(c: LawyerClient, value: string) {
        const rate = value.trim() ? Number(value.replace(',', '.')) : null;
        if (rate !== null && !Number.isFinite(rate)) return;
        const { error: err } = await supabase.from('lawyer_clients').update({ hourly_rate: rate }).eq('id', c.id);
        if (err) setError(err.message); else setClients((list) => list.map((x) => (x.id === c.id ? { ...x, hourly_rate: rate } : x)));
    }

    const q = query.trim().toLowerCase();
    const shown = clients.filter((c) => !q || `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q));

    return (
        <div className="space-y-5">
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-6">
                <input value={form.name} onChange={set('name')} placeholder="Jméno klienta nebo firma" required className={`${inputCls} sm:col-span-2`} aria-label="Jméno klienta" />
                <input type="email" value={form.email} onChange={set('email')} placeholder="E-mail" className={`${inputCls} sm:col-span-2`} aria-label="E-mail" />
                <input value={form.phone} onChange={set('phone')} placeholder="Telefon" className={inputCls} aria-label="Telefon" />
                <input value={form.rate} onChange={set('rate')} placeholder="Sazba Kč/h" inputMode="decimal" className={inputCls} aria-label="Hodinová sazba" />
                <input value={form.note} onChange={set('note')} placeholder="Poznámka" className={`${inputCls} sm:col-span-5`} aria-label="Poznámka" />
                <button type="submit" disabled={!form.name.trim()} className={`${primaryBtn} justify-center`}>Přidat klienta</button>
            </form>
            {clients.length > 5 && <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hledat klienta…" className={inputCls} aria-label="Hledat klienta" />}
            {shown.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">{clients.length ? 'Nic nenalezeno.' : 'Zatím žádní klienti. Přidejte prvního výše a pak ho vyberte u věci.'}</p> : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Klient</th><th className="px-3 py-2.5">Kontakt</th><th className="px-3 py-2.5">Věci</th><th className="px-3 py-2.5">Sazba Kč/h</th><th className="px-2 py-2.5"><span className="sr-only">Akce</span></th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {shown.map((c) => {
                                const mine = cases.filter((x) => (x.client_name ?? '').trim().toLowerCase() === c.name.toLowerCase());
                                return (
                                    <tr key={c.id}>
                                        <td className="px-4 py-2.5 font-semibold text-slate-900">{c.name}{c.note && <span className="block text-xs font-normal text-slate-500">{c.note}</span>}</td>
                                        <td className="px-3 py-2.5 text-slate-700">{[c.email, c.phone].filter(Boolean).join(' · ') || '–'}</td>
                                        <td className="px-3 py-2.5 text-slate-700">{mine.length ? `${mine.filter((m) => m.status === 'open').length} otevřených z ${mine.length}` : '–'}</td>
                                        <td className="px-3 py-2.5"><input defaultValue={c.hourly_rate ?? ''} key={`${c.id}-${c.hourly_rate}`} onBlur={(e) => void saveRate(c, e.target.value)} inputMode="decimal" aria-label={`Sazba ${c.name}`} className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm" /></td>
                                        <td className="px-2 py-2.5 text-right"><button type="button" onClick={() => void remove(c)} aria-label={`Smazat ${c.name}`} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={15} /></button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            <p className="text-xs text-slate-500">Klienta propojíte s věcí v jejím Přehledu v poli „Klient“ (stejné jméno). Sazba klienta se pak předvyplní ve výkazech práce.</p>
        </div>
    );
}
