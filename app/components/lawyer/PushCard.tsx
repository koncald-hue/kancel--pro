'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ghostBtn, primaryBtn } from '../situation/caseUi';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const toKey = (b64: string) => { const pad = '='.repeat((4 - (b64.length % 4)) % 4); const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };

type State = 'checking' | 'unsupported' | 'blocked' | 'off' | 'on';

async function call(method: 'POST' | 'DELETE', body: unknown) {
    const { data } = await supabase.auth.getSession();
    const res = await fetch('/api/push', { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: '' }))).error || 'failed');
}

// Upozornění na lhůty na tomto zařízení: každé ráno krátká zpráva s počty lhůt (po termínu, dnes, do 3 dnů), bez názvů věcí
export default function PushCard() {
    const [state, setState] = useState<State>('checking');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const check = useCallback(async () => {
        if (!PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) { setState('unsupported'); return; }
        if (Notification.permission === 'denied') { setState('blocked'); return; }
        const reg = await navigator.serviceWorker.getRegistration('/');
        setState((await reg?.pushManager.getSubscription()) ? 'on' : 'off');
    }, []);
    useEffect(() => { const t = window.setTimeout(() => { void check(); }, 0); return () => window.clearTimeout(t); }, [check]);

    async function enable() {
        setBusy(true); setError('');
        try {
            const reg = await navigator.serviceWorker.ready;
            if ((await Notification.requestPermission()) !== 'granted') { setState('blocked'); return; }
            const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(PUBLIC_KEY) });
            await call('POST', sub.toJSON());
            setState('on');
        } catch (e) { setError(e instanceof Error && e.message === 'not_migrated' ? 'Chybí databázová migrace 20261119_24.' : 'Zapnutí se nepovedlo. Zkuste to znovu.'); }
        setBusy(false);
    }
    async function disable() {
        setBusy(true); setError('');
        try {
            const reg = await navigator.serviceWorker.getRegistration('/'); const sub = await reg?.pushManager.getSubscription();
            if (sub) { await call('DELETE', { endpoint: sub.endpoint }).catch(() => undefined); await sub.unsubscribe(); }
            setState('off');
        } catch { setError('Vypnutí se nepovedlo.'); }
        setBusy(false);
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="push-h">
            <h2 id="push-h" className="flex items-center gap-2 text-lg font-bold text-slate-900"><BellRing size={18} className="text-indigo-700" aria-hidden="true" /> Upozornění na lhůty</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Každé ráno vám na tomto zařízení přijde krátká zpráva, když máte lhůty po termínu, dnes nebo do tří dnů. Upozornění obsahuje jen počty (třeba „Dnes končí: 2 lhůty“), nikdy názvy spisů ani klientů, protože se zobrazí i na zamčené obrazovce. Nenahrazuje kontrolu lhůt v aplikaci a v kalendáři.</p>
            {state === 'unsupported' && <p className="mt-3 text-sm text-slate-500">Toto zařízení nebo prohlížeč upozornění nepodporuje, nebo je aplikace spuštěná bez instalace. Na iPhonu fungují jen u aplikace přidané na plochu (iOS 16.4 a novější).</p>}
            {state === 'blocked' && <p className="mt-3 text-sm text-amber-800">Upozornění jsou v prohlížeči zakázaná. Povolíte je v nastavení webu (ikona zámku vedle adresy).</p>}
            {state === 'off' && <button type="button" onClick={() => void enable()} disabled={busy} className={`${primaryBtn} mt-3`}>{busy ? 'Zapínám…' : 'Zapnout upozornění na tomto zařízení'}</button>}
            {state === 'on' && <div className="mt-3 flex flex-wrap items-center gap-3"><p className="text-sm font-semibold text-emerald-800">Upozornění jsou na tomto zařízení zapnutá.</p><button type="button" onClick={() => void disable()} disabled={busy} className={ghostBtn}>Vypnout</button></div>}
            {error && <p role="alert" className="mt-2 text-sm text-rose-800">{error}</p>}
        </section>
    );
}
