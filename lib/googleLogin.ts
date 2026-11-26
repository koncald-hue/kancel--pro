'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { TERMS_VERSION } from './company';
import { GOOGLE_SCOPE, type GoogleTokens } from './googleCal';

// Přihlášení a registrace přes Google (Supabase OAuth). Volitelně se tím rovnou připojí Google Kalendář:
// Google vrátí přístup ke kalendáři spolu s přihlášením, my ho podržíme jen v této záložce a uložíme zašifrovaný,
// jakmile advokát odemkne šifrovací heslo (bez něj se přihlášení ke kalendáři uložit nesmí).
// Pozor: aby šel přístup ke kalendáři obnovovat, musí mít Supabase u Googlu stejného klienta jako GOOGLE_CLIENT_ID.

const PENDING = 'kp-google-login';
const CAL_TOKENS = 'kp-google-login-calendar';
type Pending = { calendar: boolean };

let enabled: Promise<boolean> | null = null;
export function useGoogleLoginEnabled(): boolean {
    const [on, setOn] = useState(false);
    useEffect(() => {
        let live = true;
        enabled ??= (async () => {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            if (!url || !key) return false;
            try { const j = await (await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })).json() as { external?: Record<string, boolean> }; return j.external?.google === true; } catch { return false; }
        })();
        void enabled.then((v) => { if (live) setOn(v); });
        return () => { live = false; };
    }, []);
    return on;
}

export async function signInWithGoogle(withCalendar: boolean): Promise<string | null> {
    try { sessionStorage.setItem(PENDING, JSON.stringify({ calendar: withCalendar } satisfies Pending)); } catch { /* bez úložiště jen bez kalendáře */ }
    const back = window.location.pathname.startsWith('/pozvanka/') ? window.location.href.split('#')[0] : `${window.location.origin}/kancelar`;
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: withCalendar
            ? { redirectTo: back, scopes: GOOGLE_SCOPE, queryParams: { access_type: 'offline', prompt: 'consent' } }
            : { redirectTo: back },
    });
    return error ? error.message : null;
}

// Po návratu z Googlu (volá AuthProvider u každé relace; jedná jen, když přihlášení přes Google právě proběhlo)
export function handleGoogleReturn(session: Session | null) {
    if (!session) return;
    let pending: Pending | null = null;
    try { pending = JSON.parse(sessionStorage.getItem(PENDING) ?? 'null') as Pending | null; sessionStorage.removeItem(PENDING); } catch { return; }
    if (!pending) return;
    // Souhlas s podmínkami dal advokát u tlačítka „Pokračovat přes Google“; zapíše se k účtu jako u registrace e-mailem
    if (!session.user.user_metadata?.terms_version) {
        setTimeout(() => { void supabase.auth.updateUser({ data: { terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString(), professional_use: true } }); }, 0);
    }
    if (pending.calendar && session.provider_token && session.provider_refresh_token) {
        const tokens: GoogleTokens = { access_token: session.provider_token, refresh_token: session.provider_refresh_token, expires_at: Date.now() + 50 * 60_000 };
        try { sessionStorage.setItem(CAL_TOKENS, JSON.stringify(tokens)); } catch { /* bez úložiště se kalendář připojí ručně v Nastavení */ }
    }
}

export const peekLoginCalendarTokens = (): GoogleTokens | null => { try { return JSON.parse(sessionStorage.getItem(CAL_TOKENS) ?? 'null') as GoogleTokens | null; } catch { return null; } };
export const clearLoginCalendarTokens = () => { try { sessionStorage.removeItem(CAL_TOKENS); } catch { /* nic */ } };
