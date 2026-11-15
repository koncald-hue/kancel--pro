'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { inputCls, primaryBtn } from '../situation/caseUi';
import type { LawyerAccess } from '@/lib/lawyer';

type Profile = { profession: 'advokat' | 'jiny'; name: string; bar: string; office: string; phone: string; email: string; website: string };

// Povinný profil advokáta. Tyto údaje vidí provozovatel služby (přehled uživatelů) a klient na své stránce.
export default function ProfileForm({ access, onSaved, submitLabel = 'Uložit profil' }: { access: LawyerAccess; onSaved: () => void; submitLabel?: string }) {
    const [form, setForm] = useState<Profile>({
        profession: access.profession ?? 'advokat',
        name: access.display_name ?? access.register_name ?? '',
        bar: access.bar_number ?? '',
        office: access.office ?? '',
        phone: access.phone ?? '',
        email: access.contact_email ?? access.email ?? '',
        website: access.website ?? '',
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const set = <K extends keyof Profile>(key: K, value: Profile[K]) => { setForm((f) => ({ ...f, [key]: value })); setSaved(false); };

    async function save(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true); setError('');
        const { error: err } = await supabase.rpc('save_lawyer_profile', { p_name: form.name, p_profession: form.profession, p_bar: form.bar, p_office: form.office, p_phone: form.phone, p_email: form.email, p_website: form.website });
        setBusy(false);
        if (err) { setError(err.message); return; }
        setSaved(true);
        onSaved();
    }

    const field = 'block text-xs font-semibold text-slate-600';
    return (
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <label className={`${field} sm:col-span-2`}>Jsem
                <select value={form.profession} onChange={(e) => set('profession', e.target.value as Profile['profession'])} className={`${inputCls} mt-1 font-normal`}>
                    <option value="advokat">Advokát zapsaný v ČAK</option>
                    <option value="jiny">Jiný právník (koncipient, interní právník…)</option>
                </select>
            </label>
            <label className={field}>Jméno, příjmení a titul *<input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={160} required className={`${inputCls} mt-1 font-normal`} placeholder="např. JUDr. Jan Novák" /></label>
            <label className={field}>Evidenční číslo ČAK {form.profession === 'advokat' ? '*' : '(nepovinné)'}<input value={form.bar} onChange={(e) => set('bar', e.target.value)} maxLength={40} required={form.profession === 'advokat'} className={`${inputCls} mt-1 font-normal`} placeholder="např. 12345" /></label>
            <label className={`${field} sm:col-span-2`}>Adresa kanceláře *<input value={form.office} onChange={(e) => set('office', e.target.value)} maxLength={200} required className={`${inputCls} mt-1 font-normal`} placeholder="ulice, město" /></label>
            <label className={field}>Telefon *<input value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} required inputMode="tel" className={`${inputCls} mt-1 font-normal`} placeholder="+420 …" /></label>
            <label className={field}>E-mail pro klienty *<input value={form.email} onChange={(e) => set('email', e.target.value)} type="email" maxLength={200} required className={`${inputCls} mt-1 font-normal`} placeholder="např. novak@kancelar.cz" /></label>
            <label className={`${field} sm:col-span-2`}>Web (nepovinné)<input value={form.website} onChange={(e) => set('website', e.target.value)} maxLength={200} className={`${inputCls} mt-1 font-normal`} placeholder="www.kancelar.cz" /></label>
            <p className="text-xs leading-relaxed text-slate-500 sm:col-span-2">Údaje musí být pravdivé. Vidí je provozovatel služby (přehled uživatelů) a klient na své stránce, aby věděl, s kým komunikuje. Pole označená * jsou povinná.</p>
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900 sm:col-span-2">{error}</p>}
            <div className="flex items-center gap-3 sm:col-span-2">
                <button type="submit" disabled={busy} className={primaryBtn}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {submitLabel}</button>
                {saved && <span role="status" className="text-sm font-semibold text-emerald-800">Uloženo.</span>}
            </div>
        </form>
    );
}
