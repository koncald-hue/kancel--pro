'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { createDemoCase } from '@/lib/demoCase';
import { DEMO_CASE_LIKE } from '@/lib/demoMarks';
import { DEMO_REMOVED_KEY, deleteDemoData } from '@/lib/demoCleanup';
import { confirmAction } from '@/lib/confirm';
import { useLawyer } from './LawyerGate';
import { ghostBtn } from '../situation/caseUi';

// Upozornění na ukázková data s jedním tlačítkem na jejich smazání; po založení prvního vlastního spisu se ukázka smaže sama.
export default function DemoBanner({ onChange }: { onChange?: () => void }) {
    const { userId } = useLawyer();
    const [hasDemo, setHasDemo] = useState(false);
    const [removedNote, setRemovedNote] = useState(false);
    const [busy, setBusy] = useState(false);

    const [tick, setTick] = useState(0);
    const check = useCallback(async () => { setTick((n) => n + 1); }, []);
    useEffect(() => {
        let alive = true;
        void (async () => {
            const { count } = await supabase.from('cases').select('id', { count: 'exact', head: true }).eq('user_id', userId).like('title', DEMO_CASE_LIKE);
            if (!alive) return;
            setHasDemo((count ?? 0) > 0);
            try { setRemovedNote(localStorage.getItem(DEMO_REMOVED_KEY) === '1'); } catch { /* bez úložiště */ }
        })();
        return () => { alive = false; };
    }, [userId, tick]);

    async function remove() {
        if (!(await confirmAction('Smaže se ukázkový spis i s ukázkovým klientem, hodinami a vyúčtováním. Vaše vlastní data zůstanou.', { title: 'Smazat ukázková data?', confirmLabel: 'Smazat ukázku', danger: true }))) return;
        setBusy(true);
        await deleteDemoData(userId);
        await check(); setBusy(false); onChange?.();
    }
    async function restore() {
        setBusy(true);
        try { localStorage.removeItem(DEMO_REMOVED_KEY); } catch { /* bez úložiště */ }
        await createDemoCase(userId, 1500).catch(() => undefined);
        await check(); setBusy(false); onChange?.();
    }
    function dismiss() { try { localStorage.removeItem(DEMO_REMOVED_KEY); } catch { /* bez úložiště */ } setRemovedNote(false); }

    if (hasDemo) return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p><strong>Máte ukázková data.</strong> Spis „Ukázka: Novák proti Dvořákovi“ s hodinami a vyúčtováním je jen k vyzkoušení a nepočítá se do vašich čísel. Smaže se sama, jakmile založíte první vlastní spis.</p>
            <button type="button" disabled={busy} onClick={() => void remove()} className={ghostBtn}>Smazat ukázku</button>
        </div>
    );
    if (removedNote) return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p>Ukázková data jsme odstranili, aby se nepletla s vaší prací.</p>
            <span className="flex gap-2"><button type="button" disabled={busy} onClick={() => void restore()} className={ghostBtn}>Vrátit ukázku</button><button type="button" onClick={dismiss} className={ghostBtn}>Rozumím</button></span>
        </div>
    );
    return null;
}
