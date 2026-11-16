'use client';

import { useRef, useState } from 'react';
import { Camera, Check, Loader2, Trash2 } from 'lucide-react';
import { prepareAvatar } from '@/lib/avatar';
import Avatar from './Avatar';
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
    const [photo, setPhoto] = useState(access.avatar_large ?? '');
    const [photoBusy, setPhotoBusy] = useState(false);
    const [photoError, setPhotoError] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setPhotoBusy(true); setPhotoError('');
        try {
            const { small, large } = await prepareAvatar(file);
            const { error: err } = await supabase.rpc('save_avatar', { p_small: small, p_large: large });
            if (err) throw new Error(/save_avatar|find the function/i.test(err.message) ? 'Fotky zatím nejsou v databázi zapnuté (chybí spuštění souboru profil-foto.sql).' : err.message);
            setPhoto(large); onSaved();
        } catch (ex) { setPhotoError(ex instanceof Error ? ex.message : 'Fotku se nepodařilo uložit.'); }
        setPhotoBusy(false);
    }
    async function removePhoto() {
        setPhotoBusy(true); setPhotoError('');
        const { error: err } = await supabase.rpc('remove_avatar');
        setPhotoBusy(false);
        if (err) { setPhotoError(err.message); return; }
        setPhoto(''); onSaved();
    }
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
            <div className="flex items-center gap-4 sm:col-span-2">
                <Avatar name={form.name || access.email} src={photo} size={72} className="text-xl" />
                <div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => fileRef.current?.click()} disabled={photoBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 cursor-pointer">{photoBusy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} {photo ? 'Změnit fotku' : 'Přidat fotku'}</button>
                        {photo && <button type="button" onClick={() => void removePhoto()} disabled={photoBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"><Trash2 size={14} /> Odstranit</button>}
                    </div>
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void pickPhoto(e)} className="sr-only" aria-label="Soubor s fotkou" />
                    <p className="mt-1.5 text-xs text-slate-500">Nepovinné. Fotku vidí kolegové z kanceláře a klienti na své stránce (v chatu jen jako miniaturu). Uloží se hned, zmenšená na čtverec.</p>
                    {photoError && <p role="alert" className="mt-1 text-xs text-rose-800">{photoError}</p>}
                </div>
            </div>
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
            <p className="text-xs leading-relaxed text-slate-500 sm:col-span-2">Údaje musí být pravdivé. Vidí je provozovatel služby (přehled uživatelů), kolegové z kanceláře a klient na své stránce, aby věděl, s kým komunikuje. Pole označená * jsou povinná.</p>
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900 sm:col-span-2">{error}</p>}
            <div className="flex items-center gap-3 sm:col-span-2">
                <button type="submit" disabled={busy} className={primaryBtn}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {submitLabel}</button>
                {saved && <span role="status" className="text-sm font-semibold text-emerald-800">Uloženo.</span>}
            </div>
        </form>
    );
}
