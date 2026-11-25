'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { getLockReason, getMaster, isRemembered, restoreMaster, subscribeMaster, type LockReason } from './e2ee';

// Odemčený hlavní klíč advokáta (null = zamčeno); přežije obnovení stránky, zamkne se po 30 min nečinnosti.
export function useMasterKey(): CryptoKey | null {
    const key = useSyncExternalStore(subscribeMaster, getMaster, () => null);
    useEffect(() => { void restoreMaster(); }, []);
    return key;
}

// Důvod zamčení (nečinnost, obnovení stránky, odhlášení), aby aplikace mohla vysvětlit, proč šifrovaný obsah není vidět
export function useLockReason(): LockReason {
    return useSyncExternalStore(subscribeMaster, getLockReason, () => null);
}

// Je klíč zapamatovaný na tomto zařízení (odemyká se sám)?
export function useRemembered(): boolean {
    return useSyncExternalStore(subscribeMaster, isRemembered, () => false);
}
