'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MailCheck, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { decryptText } from '@/lib/e2ee';
import { useMasterKey } from '@/lib/useE2ee';
import { getSession, reapExpired } from '@/lib/isdsSession';
import { isdsApi } from '@/lib/isdsClient';
import { newCount, openRequestCount, setReceived, subscribeBox } from '@/lib/dataBoxState';
import LawyerDataBox from './LawyerDataBox';

const POLL_MS = 5 * 60_000;

// Kulaté tlačítko vpravo dole: otevře datovou schránku v postranním panelu z kterékoli stránky kanceláře
export default function DataBoxLauncher() {
    const [open, setOpen] = useState(false);
    const master = useMasterKey();
    const unread = useSyncExternalStore(subscribeBox, newCount, () => 0);
    const requests = useSyncExternalStore(subscribeBox, openRequestCount, () => 0);
    const seenRequests = useRef(requests);
    // Požadavek z jiného místa (např. z hledání) otevře panel
    useEffect(() => { if (requests !== seenRequests.current) { seenRequests.current = requests; const t = window.setTimeout(() => setOpen(true), 0); return () => window.clearTimeout(t); } }, [requests]);

    // Průběžné zjišťování nových zpráv pro odznak na ikoně. Mobilní klíč se kvůli tomu NEpřihlašuje (nechodilo by oznámení v telefonu):
    // kontroluje se jen, když už je přihlášení platné. Pozadí relaci neprodlužuje, nečinná se po limitu odhlásí.
    useEffect(() => {
        if (!master) return;
        let alive = true;
        const tick = async () => {
            await reapExpired((env, value) => isdsApi({ action: 'mk_end', env, session: value }));
            const { data } = await supabase.from('isds_accounts').select('id, env, enc_cred');
            for (const a of (data ?? []) as { id: string; env: 'test' | 'prod'; enc_cred: string }[]) {
                if (!alive) return;
                let cred: { login: string; password: string; method?: string };
                try { cred = JSON.parse(await decryptText(master, a.enc_cred)); } catch { continue; }
                const from = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 19);
                let res;
                if (cred.method === 'mobile_key') { const sess = getSession(a.id); if (!sess) continue; res = await isdsApi({ action: 'list', env: a.env, session: sess.value, received: true, from }); }
                else res = await isdsApi({ action: 'list', env: a.env, login: cred.login, password: cred.password, received: true, from });
                if (res.ok && alive) setReceived(a.id, (res.json.records as never[]) ?? []);
            }
        };
        const first = window.setTimeout(() => void tick(), 1500);
        const id = window.setInterval(() => void tick(), POLL_MS);
        return () => { alive = false; window.clearTimeout(first); window.clearInterval(id); };
    }, [master]);
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    return (
        <>
            <button type="button" onClick={() => setOpen(true)} aria-label={unread > 0 ? `Otevřít datovou schránku, nových zpráv: ${unread}` : 'Otevřít datovou schránku'} title={unread > 0 ? `Datová schránka: ${unread} nových` : 'Datová schránka'} className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-700 text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-800 hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 cursor-pointer"><MailCheck size={24} aria-hidden="true" />{unread > 0 && <span className="absolute -right-1 -top-1 flex min-h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-white bg-rose-600 px-1 text-xs font-bold leading-none text-white" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}</button>
            {open && (
                <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Datová schránka">
                    <button type="button" aria-label="Zavřít datovou schránku" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-900/40" />
                    <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl">
                        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
                            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><MailCheck size={18} className="text-indigo-700" aria-hidden="true" /> Datová schránka</h2>
                            <button type="button" onClick={() => setOpen(false)} aria-label="Zavřít" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"><X size={18} /></button>
                        </header>
                        <div className="flex-1 overflow-y-auto p-5"><LawyerDataBox /></div>
                    </aside>
                </div>
            )}
        </>
    );
}
