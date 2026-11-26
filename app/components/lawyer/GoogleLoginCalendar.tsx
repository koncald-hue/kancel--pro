'use client';

import { useEffect, useRef } from 'react';
import { useMasterKey } from '@/lib/useE2ee';
import { clearLoginCalendarTokens, peekLoginCalendarTokens } from '@/lib/googleLogin';
import { saveGoogleTokens, syncGoogle } from '@/lib/googleSync';
import { useLawyer } from './LawyerGate';

// Dokončí připojení Google Kalendáře z přihlášení přes Google: přístup čeká v této záložce, dokud advokát
// neodemkne (nebo nenastaví) šifrovací heslo, pak se uloží zašifrovaný a proběhne první synchronizace lhůt.
export default function GoogleLoginCalendar() {
    const { userId } = useLawyer();
    const master = useMasterKey();
    const busy = useRef(false);
    useEffect(() => {
        if (!master || !userId || busy.current) return;
        const tokens = peekLoginCalendarTokens();
        if (!tokens) return;
        busy.current = true;
        (async () => {
            try {
                await saveGoogleTokens(master, userId, tokens);
                clearLoginCalendarTokens();
                const r = await syncGoogle(master, userId).catch(() => null);
                window.dispatchEvent(new CustomEvent('google-sync', { detail: { message: `Google Kalendář je připojený.${r ? ` ${r.message}` : ''}` } }));
            } catch {
                // Nepovedlo se (např. vypršel přístup): necháme advokáta připojit kalendář ručně v Nastavení
                clearLoginCalendarTokens();
            } finally { busy.current = false; }
        })();
    }, [master, userId]);
    return null;
}
