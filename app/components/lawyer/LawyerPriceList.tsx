'use client';

import { confirmAction } from '@/lib/confirm';
import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { KIND_LABELS, UNITS, VAT_RATES, loadPriceItems, money, parseAmount, type PriceItem, type PriceKind } from '@/lib/billing';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

type Form = { name: string; description: string; kind: PriceKind; unit: string; price: string; vat: number };
const EMPTY: Form = { name: '', description: '', kind: 'sluzba', unit: 'hod', price: '', vat: 21 };

// Ceník produktů a služeb: odsud se vybírá do vyúčtování a výkazů práce
export default function LawyerPriceList() {
    const { userId, access } = useLawyer();
    const [items, setItems] = useState<PriceItem[] | null>(null);
    const [form, setForm] = useState<Form>({ ...EMPTY, vat: access.vat_payer ? 21 : 0 });
    const [editing, setEditing] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        loadPriceItems().then((list) => { if (!cancelled) setItems(list); }).catch((e) => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Ceník se nepodařilo načíst.'); setItems([]); } });
        return () => { cancelled = true; };
    }, []);

    const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

    async function save(e: React.FormEvent) {
        e.preventDefault();
        const price = parseAmount(form.price);
        if (!form.name.trim()) { setError('Vyplňte název.'); return; }
        if (price === null || price < 0) { setError('Zadejte cenu, např. 2000 nebo 1 500,50.'); return; }
        setError('');
        const row = { name: form.name.trim().slice(0, 200), description: form.description.trim().slice(0, 500), kind: form.kind, unit: form.unit.trim().slice(0, 20) || 'ks', unit_price: price, vat_rate: form.vat };
        if (editing) {
            const { data, error: err } = await supabase.from('price_items').update(row).eq('id', editing).select('*').single();
            if (err) { setError(err.message); return; }
            setItems((l) => (l ?? []).map((x) => (x.id === editing ? (data as PriceItem) : x)));
        } else {
            const { data, error: err } = await supabase.from('price_items').insert({ ...row, user_id: userId }).select('*').single();
            if (err) { setError(err.message); return; }
            setItems((l) => [...(l ?? []), data as PriceItem].sort((a, b) => a.name.localeCompare(b.name, 'cs')));
        }
        setEditing(null); setForm({ ...EMPTY, vat: form.vat });
    }

    function edit(p: PriceItem) {
        setEditing(p.id);
        setForm({ name: p.name, description: p.description, kind: p.kind, unit: p.unit, price: String(p.unit_price).replace('.', ','), vat: p.vat_rate });
    }

    async function toggle(p: PriceItem) {
        const { error: err } = await supabase.from('price_items').update({ active: !p.active }).eq('id', p.id);
        if (err) setError(err.message); else setItems((l) => (l ?? []).map((x) => (x.id === p.id ? { ...x, active: !p.active } : x)));
    }

    async function remove(p: PriceItem) {
        if (!await confirmAction(`Smazat položku „${p.name}“? Už vystavená vyúčtování zůstanou beze změny.`)) return;
        const { error: err } = await supabase.from('price_items').delete().eq('id', p.id);
        if (err) setError(err.message); else setItems((l) => (l ?? []).filter((x) => x.id !== p.id));
    }

    return (
        <div className="space-y-5">
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold text-slate-900">{editing ? 'Upravit položku' : 'Nová položka ceníku'}</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-6">
                    <label className="block text-xs font-semibold text-slate-600 sm:col-span-3">Název<input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={200} className={`${inputCls} mt-1 font-normal`} placeholder="např. Hodinová sazba, Sepsání smlouvy" /></label>
                    <label className="block text-xs font-semibold text-slate-600">Druh<select value={form.kind} onChange={(e) => set('kind', e.target.value as PriceKind)} className={`${inputCls} mt-1 font-normal`}>{(Object.keys(KIND_LABELS) as PriceKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select></label>
                    <label className="block text-xs font-semibold text-slate-600">Jednotka<input value={form.unit} onChange={(e) => set('unit', e.target.value)} list="units" maxLength={20} className={`${inputCls} mt-1 font-normal`} /><datalist id="units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist></label>
                    <label className="block text-xs font-semibold text-slate-600">Cena (Kč)<input value={form.price} onChange={(e) => set('price', e.target.value)} inputMode="decimal" className={`${inputCls} mt-1 font-normal`} placeholder="2000" /></label>
                    <label className="block text-xs font-semibold text-slate-600 sm:col-span-5">Popis (nepovinné, přidá se do položky vyúčtování)<input value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={500} className={`${inputCls} mt-1 font-normal`} /></label>
                    <label className="block text-xs font-semibold text-slate-600">DPH<select value={form.vat} onChange={(e) => set('vat', Number(e.target.value))} className={`${inputCls} mt-1 font-normal`}>{VAT_RATES.map((r) => <option key={r} value={r}>{r} %</option>)}</select></label>
                </div>
                <div className="mt-4 flex gap-2">
                    <button type="submit" className={primaryBtn}>{editing ? <Check size={16} /> : <Plus size={16} />} {editing ? 'Uložit změny' : 'Přidat do ceníku'}</button>
                    {editing && <button type="button" onClick={() => { setEditing(null); setForm({ ...EMPTY, vat: form.vat }); }} className={ghostBtn}><X size={15} /> Zrušit</button>}
                </div>
                {!access.vat_payer && <p className="mt-3 text-xs text-slate-500">Nejste plátce DPH (nastavení v Nastavení, Fakturační údaje), takže se DPH ve vyúčtování nepočítá, ať je tu zvolená sazba jakákoli.</p>}
            </form>

            {items === null ? <p className="text-sm text-slate-500" role="status">Načítám…</p> : items.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">Zatím žádné položky. Přidejte třeba svou hodinovou sazbu.</p> : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Položka</th><th className="px-3 py-2.5">Druh</th><th className="px-3 py-2.5 text-right">Cena</th><th className="px-3 py-2.5">DPH</th><th className="px-2 py-2.5"><span className="sr-only">Akce</span></th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((p) => (
                                <tr key={p.id} className={p.active ? '' : 'opacity-50'}>
                                    <td className="px-4 py-2.5"><span className="font-semibold text-slate-900">{p.name}</span>{p.description && <span className="block text-xs text-slate-500">{p.description}</span>}</td>
                                    <td className="px-3 py-2.5 text-slate-700">{KIND_LABELS[p.kind]}</td>
                                    <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{money(p.unit_price)}<span className="block text-xs font-normal text-slate-500">za {p.unit}</span></td>
                                    <td className="px-3 py-2.5 text-slate-700">{p.vat_rate} %</td>
                                    <td className="px-2 py-2.5 text-right whitespace-nowrap">
                                        <button type="button" onClick={() => void toggle(p)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100">{p.active ? 'Skrýt' : 'Zobrazit'}</button>
                                        <button type="button" onClick={() => edit(p)} aria-label={`Upravit ${p.name}`} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"><Pencil size={15} /></button>
                                        <button type="button" onClick={() => void remove(p)} aria-label={`Smazat ${p.name}`} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50"><Trash2 size={15} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
