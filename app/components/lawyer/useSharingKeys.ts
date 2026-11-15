'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMasterKey } from '@/lib/useE2ee';
import { createMemberKeys, fingerprint, unlockMemberKey } from '@/lib/e2eeShare';
import { useLawyer } from './LawyerGate';

export type Colleague = { user_id: string; name: string; email: string; has_keys: boolean };
export type KeyRow = { user_id: string; public_key: string; wrapped_private: string };

// Klíče člena kanceláře pro šifrovaný chat a sdílení: kolegové, jejich veřejné klíče, odemčený soukromý klíč
export function useSharingKeys() {
    const { userId } = useLawyer();
    const master = useMasterKey();
    const [colleagues, setColleagues] = useState<Colleague[] | null | undefined>(undefined);
    const [keys, setKeys] = useState<Record<string, KeyRow>>({});
    const [prints, setPrints] = useState<Record<string, string>>({});
    const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
    const [keyProblem, setKeyProblem] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const reload = useCallback(async () => {
        const col = await supabase.rpc('firm_colleagues');
        if (col.error) { setError(/firm_colleagues|does not exist|find the function/i.test(col.error.message) ? 'Sdílení zatím není v databázi zapnuté (chybí spuštění souboru sdileni.sql).' : col.error.message); setColleagues(null); return; }
        const list = (col.data as Colleague[] | null) ?? null;
        setColleagues(list);
        if (!list) return;
        const k = await supabase.from('member_keys').select('user_id, public_key, wrapped_private').in('user_id', [userId, ...list.map((c) => c.user_id)]);
        const map: Record<string, KeyRow> = {};
        for (const r of (k.data ?? []) as KeyRow[]) map[r.user_id] = r;
        setKeys(map);
        const printMap: Record<string, string> = {};
        for (const r of Object.values(map)) printMap[r.user_id] = await fingerprint(r.public_key).catch(() => '');
        setPrints(printMap);
    }, [userId]);

    useEffect(() => {
        let cancelled = false;
        void (async () => { await Promise.resolve(); if (!cancelled) await reload(); })();
        return () => { cancelled = true; };
    }, [reload]);

    const myRow = keys[userId];
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            if (!master || !myRow) { if (!cancelled) { setPrivateKey(null); setKeyProblem(false); } return; }
            try { const k = await unlockMemberKey(master, myRow.wrapped_private); if (!cancelled) { setPrivateKey(k); setKeyProblem(false); } } catch { if (!cancelled) { setPrivateKey(null); setKeyProblem(true); } }
        })();
        return () => { cancelled = true; };
    }, [master, myRow]);

    const enable = useCallback(async () => {
        if (!master) return;
        setBusy(true); setError('');
        try {
            const created = await createMemberKeys(master);
            const { error: err } = await supabase.from('member_keys').upsert({ user_id: userId, public_key: created.publicKey, wrapped_private: created.wrappedPrivate });
            if (err) throw new Error(err.message);
            await reload();
        } catch (e) { setError(e instanceof Error ? e.message : 'Klíče se nepodařilo vytvořit.'); } finally { setBusy(false); }
    }, [master, userId, reload]);

    return { userId, master, colleagues, keys, prints, privateKey, keyProblem, myRow, error, busy, enable, reload };
}
