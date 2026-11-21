'use client';

import { confirmAction } from '@/lib/confirm';
import { useEffect, useState } from 'react';
import { ListChecks, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { addStarterTemplates, loadTemplates } from '@/lib/templateApply';
import { MAX_ITEMS, cleanItems, type CaseTemplate, type TemplateItem } from '@/lib/taskTemplates';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

const blank = (): TemplateItem => ({ title: '', offset: 1, base: 'start', workdays: true });

// Šablony úkolů: při založení věci (nebo kdykoli v existující věci) se podle nich vytvoří úkoly s vypočtenými termíny
export default function LawyerTemplates() {
    const { userId } = useLawyer();
    const [list, setList] = useState<CaseTemplate[] | null>(null);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState<{ id: string | null; name: string; items: TemplateItem[]; isDefault: boolean } | null>(null);
    const reload = () => loadTemplates().then(setList).catch(() => setError('Šablony se nepodařilo načíst. Zkontrolujte, že je spuštěná migrace 20261118_11.'));
    useEffect(() => { void reload(); }, []);

    async function save() {
        if (!editing) return; setError('');
        const items = cleanItems(editing.items); const name = editing.name.trim().slice(0, 120);
        if (!name || !items.length) { setError('Doplňte název šablony a alespoň jeden úkol s názvem.'); return; }
        // Výchozí je nejvýš jedna: nejdřív se zruší u ostatních
        if (editing.isDefault) await supabase.from('case_templates').update({ is_default: false }).eq('user_id', userId).eq('is_default', true).neq('id', editing.id ?? '00000000-0000-0000-0000-000000000000');
        const base = { name, items, is_default: editing.isDefault };
        let res = editing.id ? await supabase.from('case_templates').update(base).eq('id', editing.id) : await supabase.from('case_templates').insert({ user_id: userId, ...base });
        if (res.error) res = editing.id ? await supabase.from('case_templates').update({ name, items }).eq('id', editing.id) : await supabase.from('case_templates').insert({ user_id: userId, name, items }); // bez migrace 12
        const err = res.error;
        if (err) { setError('Šablonu se nepodařilo uložit.'); return; }
        setEditing(null); await reload();
    }
    async function remove(id: string) { if (!(await confirmAction('Smazat šablonu úkolů? Úkoly, které už z ní vznikly ve spisech, zůstanou.'))) return; await supabase.from('case_templates').delete().eq('id', id); await reload(); }
    async function addStarters() {
        try { setList(await addStarterTemplates(userId)); } catch { setError('Vzorové šablony se nepodařilo přidat.'); }
    }
    const patch = (i: number, p: Partial<TemplateItem>) => setEditing((e) => e && { ...e, items: e.items.map((it, k) => (k === i ? { ...it, ...p } : it)) });

    return (
        <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ListChecks size={18} className="text-indigo-700" aria-hidden="true" /> Šablony úkolů</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Šablonu vyberete při založení spisu nebo ji použijete v kartě Lhůty existující spisu. Úkoly dostanou termín podle posunu ode dne založení nebo od data události (např. jednání), případně jen v pracovních dnech. Jde o interní úkoly, ne o zákonné lhůty: ty zadávejte zvlášť a potvrzujte.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setEditing({ id: null, name: '', items: [blank()], isDefault: !list?.some((t) => t.isDefault) })} className={primaryBtn}><Plus size={15} /> Nová šablona</button>
                    {list?.length === 0 && <button type="button" onClick={() => void addStarters()} className={ghostBtn}>Přidat dvě vzorové šablony</button>}
                </div>
            </section>
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}

            {editing && (
                <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5">
                    <label className="block text-sm font-semibold text-slate-800">Název šablony
                        <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={120} className={`${inputCls} mt-1 max-w-md`} />
                    </label>
                    <p className="mt-4 hidden gap-2 px-3 text-xs font-semibold text-slate-500 sm:grid sm:grid-cols-[1fr_90px_150px_auto_auto]"><span>Úkol</span><span>Za kolik dní</span><span>Od čeho</span><span>Dny</span><span className="w-4" /></p>
                    <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><input type="checkbox" checked={editing.isDefault} onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })} /> Použít automaticky u každé nové spisy</label>
                    <ul className="mt-1 space-y-2">
                        {editing.items.map((it, i) => (
                            <li key={i} className="grid gap-2 rounded-xl bg-white p-3 sm:grid-cols-[1fr_90px_150px_auto_auto] sm:items-center">
                                <input value={it.title} onChange={(e) => patch(i, { title: e.target.value })} placeholder="Úkol, např. Poslat klientovi shrnutí" maxLength={120} aria-label="Název úkolu" className={inputCls} />
                                <input type="number" value={it.offset} onChange={(e) => patch(i, { offset: Math.trunc(Number(e.target.value)) || 0 })} aria-label="Posun ve dnech (záporný je před)" className={inputCls} />
                                <select value={it.base} onChange={(e) => patch(i, { base: e.target.value === 'event' ? 'event' : 'start' })} aria-label="Od čeho se počítá" className={inputCls}><option value="start">od založení spisu</option><option value="event">od data události</option></select>
                                <label className="flex items-center gap-1.5 text-xs text-slate-700"><input type="checkbox" checked={it.workdays} onChange={(e) => patch(i, { workdays: e.target.checked })} /> jen pracovní</label>
                                <button type="button" onClick={() => setEditing({ ...editing, items: editing.items.filter((_, k) => k !== i) })} aria-label="Odebrat úkol" className="cursor-pointer text-slate-400 hover:text-rose-700"><Trash2 size={16} /></button>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {editing.items.length < MAX_ITEMS && <button type="button" onClick={() => setEditing({ ...editing, items: [...editing.items, blank()] })} className={ghostBtn}><Plus size={14} /> Další úkol</button>}
                        <button type="button" onClick={() => void save()} className={primaryBtn}>Uložit šablonu</button>
                        <button type="button" onClick={() => setEditing(null)} className={ghostBtn}>Zrušit</button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Záporný posun je před datem (např. −3 dny před jednáním). Úkoly navázané na datum události se při založení spisu přeskočí, dokud ho spis nemá, a pak je doplníte tlačítkem v kartě Lhůty.</p>
                </section>
            )}

            {list === null && !error && <p className="text-sm text-slate-500" role="status">Načítám šablony…</p>}
            {list?.map((t) => (
                <section key={t.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-bold text-slate-900">{t.name} <span className="text-sm font-normal text-slate-500">({t.items.length} úkolů)</span>{t.isDefault && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-900">výchozí</span>}</h3>
                        <span className="flex gap-2"><button type="button" onClick={() => setEditing({ id: t.id, name: t.name, items: t.items, isDefault: !!t.isDefault })} className={ghostBtn}>Upravit</button><button type="button" onClick={() => void remove(t.id)} className={ghostBtn}>Smazat</button></span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">{t.items.map((it, i) => <li key={i}>{it.title} <span className="text-slate-400">· {it.offset > 0 ? '+' : ''}{it.offset} {it.workdays ? 'pracovních dnů' : 'dní'} {it.base === 'event' ? 'od události' : 'od založení'}</span></li>)}</ul>
                </section>
            ))}
        </div>
    );
}
