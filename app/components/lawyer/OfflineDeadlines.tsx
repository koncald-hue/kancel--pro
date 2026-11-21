'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { CloudOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadCases } from '@/lib/cases';
import { OFFLINE_DAYS, clearOffline, isOfflineEnabled, pickUpcoming, saveOffline, setOfflineEnabled } from '@/lib/offlineDeadlines';

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); window.addEventListener('storage', cb); return () => { listeners.delete(cb); window.removeEventListener('storage', cb); }; };
const useEnabled = () => useSyncExternalStore(subscribe, isOfflineEnabled, () => false);
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Když je to zapnuté, při každém otevření (a po návratu do aplikace) se uloží lhůty na nejbližších 14 dní pro čtení bez připojení
export function OfflineSync() {
    const enabled = useEnabled();
    useEffect(() => {
        if (!enabled) return;
        let alive = true;
        const sync = async () => {
            if (document.visibilityState !== 'visible' || !navigator.onLine) return;
            const [d, cases] = await Promise.all([supabase.from('case_deadlines').select('case_id, title, due_date, done').eq('done', false), loadCases().catch(() => [])]);
            if (alive && !d.error) saveOffline(pickUpcoming(d.data ?? [], cases, todayIso()));
        };
        void sync(); document.addEventListener('visibilitychange', sync);
        return () => { alive = false; document.removeEventListener('visibilitychange', sync); };
    }, [enabled]);
    return null;
}

export function OfflineCard() {
    const enabled = useEnabled();
    const toggle = (on: boolean) => { setOfflineEnabled(on); listeners.forEach((l) => l()); };
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="off-h">
            <h2 id="off-h" className="flex items-center gap-2 text-lg font-bold text-slate-900"><CloudOff size={18} className="text-indigo-700" aria-hidden="true" /> Lhůty bez připojení</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Když zapnete, uloží se do tohoto zařízení nesplněné lhůty na nejbližších {OFFLINE_DAYS} dní (jen název lhůty, datum a název spisu) a uvidíte je i bez internetu. Nikdy se neukládá obsah spisů ani údaje klientů. Po odhlášení se uložené lhůty smažou.</p>
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)} /> Ukládat lhůty do tohoto zařízení</label>
            <p className="mt-2 text-xs text-slate-500">Zapínejte jen na zařízení, které používáte jen vy a které má zámek obrazovky. Je to nastavení pro každé zařízení zvlášť.</p>
        </section>
    );
}

export { clearOffline };
