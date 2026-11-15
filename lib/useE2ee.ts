'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { getMaster, restoreMaster, subscribeMaster } from './e2ee';

// Odemčený hlavní klíč advokáta (null = zamčeno); po načtení stránky se zkusí obnovit z úložiště karty prohlížeče
export function useMasterKey(): CryptoKey | null {
    const key = useSyncExternalStore(subscribeMaster, getMaster, () => null);
    useEffect(() => { void restoreMaster(); }, []);
    return key;
}
