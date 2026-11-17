'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { getLockReason, getMaster, restoreMaster, subscribeMaster, type LockReason } from './e2ee';

// Odemčený hlavní klíč advokáta (null = zamčeno); po obnovení stránky se znovu zadává heslo.
export function useMasterKey(): CryptoKey | null {
    const key = useSyncExternalStore(subscribeMaster, getMaster, () => null);
    useEffect(() => { void restoreMaster(); }, []);
    return key;
}

// Důvod zamčení (nečinnost, obnovení stránky, odhlášení), aby aplikace mohla vysvětlit, proč šifrovaný obsah není vidět
export function useLockReason(): LockReason {
    return useSyncExternalStore(subscribeMaster, getLockReason, () => null);
}
