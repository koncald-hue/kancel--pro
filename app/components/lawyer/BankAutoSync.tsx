'use client';

import { useEffect } from 'react';
import { autoSyncBanks } from '@/lib/bankSync';
import { useMasterKey } from '@/lib/useE2ee';
import { useLawyer } from './LawyerGate';

// Neviditelná součástka: po odemčení šifrovacího hesla se tiše stáhnou nové platby z připojeného účtu a spárují
export default function BankAutoSync() {
    const { userId, access } = useLawyer();
    const master = useMasterKey();
    useEffect(() => {
        if (!master) return;
        const t = window.setTimeout(() => { void autoSyncBanks(userId, !!access.vat_payer); }, 1500);
        return () => window.clearTimeout(t);
    }, [master, userId, access.vat_payer]);
    return null;
}
