'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { decryptText, unwrapKey } from '@/lib/e2ee';
import type { CaseFile } from '@/lib/caseFile';
import { useMasterKey } from '@/lib/useE2ee';

// Klíč šifrované komunikace s klientem u věci: odemkne se hlavním klíčem advokáta
export function useChannelKey(caseId: string): { key: CryptoKey | null; hasEncrypted: boolean; locked: boolean } {
    const master = useMasterKey();
    const [wrapped, setWrapped] = useState<string | null>(null);
    const [unwrapped, setUnwrapped] = useState<{ wrapped: string; key: CryptoKey } | null>(null);

    useEffect(() => {
        let cancelled = false;
        supabase.from('client_links').select('wrapped_key, e2ee').eq('case_id', caseId).eq('e2ee', true).order('created_at', { ascending: false }).limit(1)
            .then(({ data }) => { if (!cancelled) setWrapped(((data ?? [])[0]?.wrapped_key as string | undefined) ?? null); });
        return () => { cancelled = true; };
    }, [caseId]);

    useEffect(() => {
        if (!master || !wrapped) return;
        let cancelled = false;
        unwrapKey(master, wrapped).then((key) => { if (!cancelled) setUnwrapped({ wrapped, key }); }).catch(() => { if (!cancelled) setUnwrapped(null); });
        return () => { cancelled = true; };
    }, [master, wrapped]);

    const key = unwrapped && unwrapped.wrapped === wrapped && master ? unwrapped.key : null;
    return { key, hasEncrypted: !!wrapped, locked: !!wrapped && !key };
}

// Dešifrované názvy šifrovaných souborů (id souboru → název)
export function useDecryptedNames(files: CaseFile[], key: CryptoKey | null): Record<string, string> {
    const [names, setNames] = useState<Record<string, string>>({});
    useEffect(() => {
        if (!key) return;
        let cancelled = false;
        (async () => {
            const out: Record<string, string> = {};
            for (const f of files) if (f.enc) { try { out[f.id] = await decryptText(key, f.name); } catch { out[f.id] = 'šifrovaný soubor'; } }
            if (!cancelled) setNames(out);
        })();
        return () => { cancelled = true; };
    }, [files, key]);
    return key ? names : {};
}
