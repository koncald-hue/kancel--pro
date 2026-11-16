'use client';

import { useState } from 'react';
import { Briefcase, Check, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cleanIco, isValidIco } from '@/lib/ares';
import { toIban } from '@/lib/qrPayment';
import { onboardingSteps } from '@/lib/onboarding';
import type { LawyerAccess } from '@/lib/lawyer';
import { inputCls, primaryBtn } from '../situation/caseUi';
import ProfileForm from './ProfileForm';
import AresPicker from './AresPicker';

// První krok po koupi: dokud advokát nevyplní profil, údaje kanceláře a nenastaví šifrování, nic jiného se neotevře
export default function Onboarding({ access, onChanged }: { access: LawyerAccess; onChanged: () => void }) {
    const steps = onboardingSteps(access);
    const current = steps.find((s) => !s.done);
    const [form, setForm] = useState({ firm: access.firm_name ?? '', ico: access.ico ?? '', dic: access.dic ?? '', vat: !!access.vat_payer, bank: access.bank_account ?? '', due: String(access.due_days ?? 14), rate: String(access.default_rate || '') });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function saveFirm(e: React.FormEvent) {
        e.preventDefault(); setError('');
        if (form.firm.trim().length < 2) { setError('Vyplňte název kanceláře na dokladech (u samostatného advokáta stačí jméno).'); return; }
        if (!isValidIco(cleanIco(form.ico))) { setError('IČO nevypadá správně. Zkontrolujte ho, nebo ho doplňte z ARES.'); return; }
        if (!toIban(form.bank)) { setError('Číslo účtu nevypadá správně. Zadejte ho ve tvaru 123456789/0100 nebo jako IBAN.'); return; }
        setBusy(true);
        const rate = form.rate.trim() ? Number(form.rate.replace(',', '.')) : 0;
        const due = Number(form.due);
        const a = await supabase.rpc('update_lawyer_profile', { p_firm: form.firm.trim(), p_rate: Number.isFinite(rate) ? rate : 0 });
        const b = a.error ? a : await supabase.rpc('save_billing_settings', { p_ico: cleanIco(form.ico), p_dic: form.dic, p_vat: form.vat, p_bank: form.bank, p_due_days: Number.isFinite(due) ? Math.round(due) : 14, p_note: access.invoice_note ?? '' });
        setBusy(false);
        if (b.error) { setError(/function|schema cache/i.test(b.error.message) ? 'Fakturace zatím není v databázi zapnutá (chybí spuštění souboru fakturace.sql).' : b.error.message); return; }
        onChanged();
    }

    return (
        <div className="mx-auto max-w-2xl px-4 py-12">
            <Briefcase size={30} className="text-indigo-700" aria-hidden="true" />
            <h1 className="mt-3 text-3xl font-bold text-slate-900">První krok: nastavte svůj účet</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Než začnete Kancelář používat, vyplňte prosím údaje níže. Klientům se zobrazují na jejich stránce a objevují se na vašich vyúčtováních. Zabere to pár minut a děláte to jen jednou. Šifrovací heslo nastavíte až ve chvíli, kdy poprvé vytvoříte klientskou stránku.</p>
            <ol className="mt-5 space-y-2" aria-label="Postup">
                {steps.map((s, i) => (
                    <li key={s.id} className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${s.done ? 'border-emerald-200 bg-emerald-50' : s.id === current?.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                        {s.done ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" /> : <Circle size={18} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />}
                        <span><strong className="text-slate-900">{i + 1}. {s.label}</strong><span className="block text-xs text-slate-600">{s.hint}</span></span>
                    </li>
                ))}
            </ol>

            {current?.id === 'profil' && <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"><ProfileForm access={access} submitLabel="Uložit a pokračovat" onSaved={onChanged} /></div>}

            {current?.id === 'kancelar' && (
                <form onSubmit={saveFirm} className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
                    <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">Název kanceláře na dokladech *<input value={form.firm} onChange={(e) => setForm({ ...form, firm: e.target.value })} maxLength={120} className={`${inputCls} mt-1 font-normal`} placeholder="např. Advokátní kancelář Novák" /></label>
                    <div className="sm:col-span-2"><AresPicker compact onPick={(c) => setForm((f) => ({ ...f, ico: c.ico, dic: c.dic || f.dic }))} label="Doplnit IČO a DIČ z ARES" /></div>
                    <label className="block text-xs font-semibold text-slate-600">IČO *<input value={form.ico} onChange={(e) => setForm({ ...form, ico: e.target.value })} maxLength={20} inputMode="numeric" className={`${inputCls} mt-1 font-normal`} /></label>
                    <label className="block text-xs font-semibold text-slate-600">DIČ (je-li)<input value={form.dic} onChange={(e) => setForm({ ...form, dic: e.target.value })} maxLength={20} className={`${inputCls} mt-1 font-normal`} placeholder="CZ…" /></label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:col-span-2"><input type="checkbox" checked={form.vat} onChange={(e) => setForm({ ...form, vat: e.target.checked })} className="h-4 w-4 accent-indigo-700" /> Jsem plátce DPH</label>
                    <label className="block text-xs font-semibold text-slate-600">Číslo účtu nebo IBAN *<input value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} maxLength={60} className={`${inputCls} mt-1 font-normal`} placeholder="123456789/0100" /></label>
                    <label className="block text-xs font-semibold text-slate-600">Splatnost (dny)<input value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} inputMode="numeric" className={`${inputCls} mt-1 max-w-32 font-normal`} /></label>
                    <label className="block text-xs font-semibold text-slate-600">Výchozí hodinová sazba, Kč (nepovinné)<input value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} inputMode="decimal" className={`${inputCls} mt-1 max-w-40 font-normal`} placeholder="např. 2000" /></label>
                    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900 sm:col-span-2">{error}</p>}
                    <div className="sm:col-span-2"><button type="submit" disabled={busy} className={primaryBtn}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Uložit a pokračovat</button></div>
                </form>
            )}

        </div>
    );
}
