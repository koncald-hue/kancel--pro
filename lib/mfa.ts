'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Dvoufázové přihlášení (TOTP) přes Supabase Auth. Úroveň aal1 = jen heslo, aal2 = heslo + kód z aplikace.
export type TotpFactor = { id: string; friendly_name?: string | null; status: string };

export async function listTotp(): Promise<TotpFactor[]> {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw new Error(error.message);
    return (data.totp ?? []) as TotpFactor[]; // jen ověřené faktory
}

export async function enrollTotp(name: string): Promise<{ id: string; qr: string; secret: string }> {
    // Nedokončené předchozí pokusy se uklidí, jinak by Supabase hlásil duplicitní název
    const all = await supabase.auth.getUser();
    for (const f of (all.data.user?.factors ?? []) as TotpFactor[]) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `${name} ${new Date().toISOString().slice(0, 16)}` });
    if (error) throw new Error(error.message);
    return { id: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyCode(factorId: string, code: string): Promise<void> {
    const ch = await supabase.auth.mfa.challenge({ factorId });
    if (ch.error) throw new Error(ch.error.message);
    const v = await supabase.auth.mfa.verify({ factorId, challengeId: ch.data.id, code: code.replace(/\s/g, '') });
    if (v.error) throw new Error(/invalid/i.test(v.error.message) ? 'Kód nesouhlasí. Zkontrolujte čas v telefonu a zkuste další kód.' : v.error.message);
}

export async function removeTotp(factorId: string): Promise<void> {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw new Error(error.message);
}

export type MfaState = { loading: boolean; needed: boolean; factorId: string };
// Po přihlášení heslem: je u účtu zapnutý druhý faktor, který ještě v této relaci nebyl potvrzen?
export function useMfaState(userId: string | undefined, version = 0): MfaState {
    const [s, setS] = useState<{ key: string; needed: boolean; factorId: string }>({ key: '', needed: false, factorId: '' });
    const key = userId ? `${userId}:${version}` : '';
    useEffect(() => {
        if (!userId) return;
        let alive = true;
        (async () => {
            try {
                const lvl = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
                const needed = lvl.data?.nextLevel === 'aal2' && lvl.data.currentLevel !== 'aal2';
                const f = needed ? await listTotp() : [];
                if (alive) setS({ key, needed: needed && f.length > 0, factorId: f[0]?.id ?? '' });
            } catch { if (alive) setS({ key, needed: false, factorId: '' }); }
        })();
        return () => { alive = false; };
    }, [userId, key]);
    const ready = !!userId && s.key === key;
    return { loading: !!userId && !ready, needed: ready && s.needed, factorId: ready ? s.factorId : '' };
}
