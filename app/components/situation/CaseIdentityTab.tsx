'use client';

import { confirmAction } from '@/lib/confirm';
import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { METHOD_LABEL, STATUS_LABEL, missingForConfirm, suggestReview, type Ident } from '@/lib/aml';
import { ghostBtn, inputCls, primaryBtn, type TabProps } from './caseUi';

type Row = Ident & { id: string; nationality: string; identified_at: string | null; next_review: string | null; funds_origin: string; note: string; created_at: string };
const today = () => new Date().toISOString().slice(0, 10);
const lab = 'block text-xs font-semibold text-slate-600';

// Identifikace klienta pro zákon o některých opatřeních proti legalizaci výnosů z trestné činnosti (č. 253/2008 Sb.)
export default function CaseIdentityTab({ item, userId, fail }: TabProps) {
    const [rows, setRows] = useState<Row[]>([]);
    const [enabled, setEnabled] = useState(true);
    const [busy, setBusy] = useState('');
    const [hasLink, setHasLink] = useState(false);

    const load = useCallback(async () => {
        const [r, l] = await Promise.all([supabase.from('client_identifications').select('*').eq('case_id', item.id).order('created_at', { ascending: false }), supabase.from('client_links').select('id').eq('case_id', item.id).eq('revoked', false).limit(1)]);
        if (r.error) { setEnabled(false); return; }
        setRows((r.data ?? []) as Row[]); setHasLink((l.data ?? []).length > 0);
    }, [item.id]);
    useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

    async function add(method: 'bankid' | 'osobne') {
        setBusy(`add-${method}`);
        const { error } = await supabase.from('client_identifications').insert({ user_id: userId, case_id: item.id, client_id: item.client_id ?? null, method, status: method === 'bankid' ? 'requested' : 'draft', full_name: item.client_name ?? '', address: '' });
        if (error) fail(new Error(error.message));
        await load(); setBusy('');
    }
    async function patch(id: string, change: Partial<Row>) {
        setRows((all) => all.map((r) => (r.id === id ? { ...r, ...change } : r)));
        const { error } = await supabase.from('client_identifications').update(change).eq('id', id);
        if (error) { fail(new Error(error.message)); await load(); }
    }
    async function confirm(r: Row) {
        const missing = missingForConfirm(r);
        if (missing.length) { fail(new Error(`Před potvrzením doplňte: ${missing.join(', ')}.`)); return; }
        await patch(r.id, { status: 'confirmed', identified_at: today(), next_review: r.next_review || suggestReview(r.risk) });
    }
    async function remove(id: string) { if (!await confirmAction('Smazat tuto identifikaci?')) return; await supabase.from('client_identifications').delete().eq('id', id); await load(); }

    if (!enabled) return <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">Identifikace zatím není v databázi zapnutá (chybí spuštění souboru podpisy-a-aml.sql).</p>;
    return (
        <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ShieldCheck size={18} className="text-indigo-700" aria-hidden="true" /> Identifikace klienta</h2>
                <p className="mt-1 text-sm text-slate-600">Záznam o ověření totožnosti klienta, posouzení politicky exponované osoby a rizika. Zákon č. 253/2008 Sb. se na advokáta vztahuje jen při některých činnostech, zda se týká této věci, posuďte sami.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void add('bankid')} disabled={!hasLink || busy === 'add-bankid'} className={primaryBtn} title={hasLink ? '' : 'Nejdřív vytvořte klientskou stránku v záložce Klient'}>{busy === 'add-bankid' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Požádat klienta o online ověření</button>
                    <button type="button" onClick={() => void add('osobne')} disabled={busy === 'add-osobne'} className={ghostBtn}><Plus size={14} /> Zapsat osobní identifikaci</button>
                </div>
                {!hasLink && <p className="mt-2 text-xs text-slate-500">Pro online ověření je potřeba klientská stránka (záložka Klient).</p>}
            </section>
            {rows.map((r) => {
                const missing = missingForConfirm(r); const done = r.status === 'confirmed'; const waiting = r.status === 'requested';
                return (
                    <section key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
                        <div className="flex flex-wrap items-center gap-2"><strong className="flex-1 text-slate-900">{METHOD_LABEL[r.method]}</strong><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${done ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>{STATUS_LABEL[r.status]}</span>
                            <button type="button" onClick={() => void remove(r.id)} aria-label="Smazat" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"><Trash2 size={14} /></button></div>
                        {waiting ? <p className="mt-2 text-slate-600">Klient uvidí výzvu ve svém portálu na Přehledu. Po ověření se údaje doplní samy.</p> : (
                            <fieldset disabled={done} className="mt-3 space-y-3">
                                {r.online_result ? <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-900"><BadgeCheck size={14} aria-hidden="true" /> Totožnost ověřena online, údaje o jménu, datu narození a adrese převzaty z ověření.</p> : null}
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <label className={lab}>Jméno a příjmení / název<input value={r.full_name} onChange={(e) => void patch(r.id, { full_name: e.target.value })} className={`${inputCls} mt-1 font-normal`} /></label>
                                    <label className={lab}>Datum narození<input type="date" value={r.birth_date ?? ''} onChange={(e) => void patch(r.id, { birth_date: e.target.value || null })} className={`${inputCls} mt-1 font-normal`} /></label>
                                    <label className={`${lab} sm:col-span-2`}>Adresa<input value={r.address} onChange={(e) => void patch(r.id, { address: e.target.value })} className={`${inputCls} mt-1 font-normal`} /></label>
                                    {r.method !== 'bankid' && <>
                                        <label className={lab}>Druh dokladu<input value={r.doc_type} onChange={(e) => void patch(r.id, { doc_type: e.target.value })} placeholder="občanský průkaz, pas" className={`${inputCls} mt-1 font-normal`} /></label>
                                        <label className={lab}>Číslo dokladu<input value={r.doc_number} onChange={(e) => void patch(r.id, { doc_number: e.target.value })} className={`${inputCls} mt-1 font-normal`} /></label>
                                        <label className={lab}>Platnost dokladu do<input type="date" value={r.doc_expires ?? ''} onChange={(e) => void patch(r.id, { doc_expires: e.target.value || null })} className={`${inputCls} mt-1 font-normal`} /></label>
                                        <label className={lab}>Státní občanství<input value={r.nationality} onChange={(e) => void patch(r.id, { nationality: e.target.value })} className={`${inputCls} mt-1 font-normal`} /></label></>}
                                </div>
                                <label className="flex items-center gap-2 text-slate-700"><input type="checkbox" checked={r.is_company} onChange={(e) => void patch(r.id, { is_company: e.target.checked })} className="accent-indigo-800" /> Klient je právnická osoba</label>
                                {r.is_company && <div className="grid gap-3 sm:grid-cols-2"><label className={lab}>IČO<input value={r.company_ico} onChange={(e) => void patch(r.id, { company_ico: e.target.value })} className={`${inputCls} mt-1 font-normal`} /></label><label className={lab}>Skutečný majitel<input value={r.beneficial_owner} onChange={(e) => void patch(r.id, { beneficial_owner: e.target.value })} placeholder="jméno, podíl, způsob ověření" className={`${inputCls} mt-1 font-normal`} /></label></div>}
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <label className={lab}>Politicky exponovaná osoba<select value={r.pep} onChange={(e) => void patch(r.id, { pep: e.target.value as Row['pep'] })} className={`${inputCls} mt-1 font-normal`}><option value="nevim">Nevím, ještě neposouzeno</option><option value="ne">Ne</option><option value="ano">Ano</option></select></label>
                                    <label className={lab}>Riziko<select value={r.risk} onChange={(e) => void patch(r.id, { risk: e.target.value as Row['risk'] })} className={`${inputCls} mt-1 font-normal`}><option value="nizke">Nízké</option><option value="standardni">Standardní</option><option value="vysoke">Vysoké</option></select></label>
                                    <label className={lab}>Další posouzení do<input type="date" value={r.next_review ?? ''} onChange={(e) => void patch(r.id, { next_review: e.target.value || null })} className={`${inputCls} mt-1 font-normal`} /></label>
                                </div>
                                {r.pep === 'ano' && <label className={lab}>K politicky exponované osobě<input value={r.pep_note} onChange={(e) => void patch(r.id, { pep_note: e.target.value })} className={`${inputCls} mt-1 font-normal`} /></label>}
                                <label className={lab}>Účel a povaha obchodního vztahu<input value={r.purpose} onChange={(e) => void patch(r.id, { purpose: e.target.value })} placeholder="např. zastupování ve sporu, koupě nemovitosti" className={`${inputCls} mt-1 font-normal`} /></label>
                                <label className={lab}>Původ finančních prostředků (je-li relevantní)<input value={r.funds_origin} onChange={(e) => void patch(r.id, { funds_origin: e.target.value })} className={`${inputCls} mt-1 font-normal`} /></label>
                                <label className={lab}>Poznámka<textarea value={r.note} onChange={(e) => void patch(r.id, { note: e.target.value })} rows={2} className={`${inputCls} mt-1 font-normal`} /></label>
                            </fieldset>)}
                        {!waiting && !done && <div className="mt-3">{missing.length > 0 && <p className="mb-2 text-xs text-amber-900">Před potvrzením chybí: {missing.join(', ')}.</p>}<button type="button" onClick={() => void confirm(r)} className={primaryBtn}><BadgeCheck size={15} /> Potvrdit identifikaci</button></div>}
                        {done && <p className="mt-3 text-xs text-slate-500">Potvrzeno {r.identified_at ? new Date(r.identified_at).toLocaleDateString('cs-CZ') : ''}{r.next_review ? ` · další posouzení do ${new Date(r.next_review).toLocaleDateString('cs-CZ')}` : ''}. <button type="button" onClick={() => void patch(r.id, { status: 'draft' })} className="font-semibold text-indigo-800 hover:underline">Upravit</button></p>}
                    </section>);
            })}
        </div>
    );
}
