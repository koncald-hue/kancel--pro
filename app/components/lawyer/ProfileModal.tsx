'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Globe, Mail, MapPin, Phone, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS, type FirmRole } from '@/lib/firm';
import Avatar from './Avatar';

type Profile = { user_id: string; name: string; role: FirmRole | null; firm: string | null; profession: string; bar_number: string; office: string; phone: string; email: string; website: string; photo: string };

// Profil kolegy z kanceláře: jen veřejná vizitka (jméno, role, kontakty, fotka), nic z fakturace ani nastavení.
export default function ProfileModal({ userId, onClose }: { userId: string; onClose: () => void }) {
    const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
    const [error, setError] = useState('');
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        let alive = true;
        supabase.rpc('colleague_profile', { p_user: userId }).then(({ data, error: err }) => {
            if (!alive) return;
            if (err) { setError(/colleague_profile|find the function/i.test(err.message) ? 'Profily zatím nejsou v databázi zapnuté (chybí spuštění souboru profil-foto.sql).' : err.message); setProfile(null); return; }
            setProfile(data as Profile | null);
        });
        return () => { alive = false; };
    }, [userId]);

    useEffect(() => {
        closeRef.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const row = 'flex items-start gap-2.5 text-sm text-slate-700';
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-label="Profil kolegy" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex justify-end"><button ref={closeRef} type="button" onClick={onClose} aria-label="Zavřít" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
                {profile === undefined && <p className="py-8 text-center text-sm text-slate-500" role="status">Načítám…</p>}
                {profile === null && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error || 'Profil se nepodařilo načíst.'}</p>}
                {profile && (
                    <div>
                        <div className="flex flex-col items-center text-center">
                            <Avatar name={profile.name} src={profile.photo} size={112} className="text-3xl" />
                            <h2 className="mt-3 text-lg font-bold text-slate-900">{profile.name}</h2>
                            <p className="text-sm text-slate-600">{profile.role ? ROLE_LABELS[profile.role] : ''}{profile.role && profile.profession ? ' · ' : ''}{profile.profession === 'advokat' ? 'advokát' : profile.profession ? 'právník' : ''}</p>
                            {profile.bar_number && <p className="text-xs text-slate-500">Ev. č. ČAK {profile.bar_number}</p>}
                        </div>
                        <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4">
                            {profile.firm && <p className={row}><Building2 size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />{profile.firm}</p>}
                            {profile.office && <p className={row}><MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />{profile.office}</p>}
                            {profile.phone && <p className={row}><Phone size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" /><a href={`tel:${profile.phone.replace(/\s+/g, '')}`} className="hover:underline">{profile.phone}</a></p>}
                            {profile.email && <p className={row}><Mail size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" /><a href={`mailto:${profile.email}`} className="break-all hover:underline">{profile.email}</a></p>}
                            {profile.website && <p className={row}><Globe size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" /><a href={/^https?:\/\//.test(profile.website) ? profile.website : `https://${profile.website}`} target="_blank" rel="noreferrer noopener" className="break-all hover:underline">{profile.website}</a></p>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
