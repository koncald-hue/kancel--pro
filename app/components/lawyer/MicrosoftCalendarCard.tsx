'use client';

import { confirmAction } from '@/lib/confirm';
import { useCallback, useEffect, useState } from 'react';
import { CalendarSync, Check, KeyRound, Link2, Loader2, RefreshCw } from 'lucide-react';
import { useMasterKey } from '@/lib/useE2ee';
import { DETAIL_LABELS, type Detail } from '@/lib/googleCal';
import { disconnectMicrosoft, microsoftConfig, loadMicrosoftConnection, saveMicrosoftOptions, startMicrosoftConnect, syncMicrosoft, type Loaded } from '@/lib/microsoftSync';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

// Karta v Nastavení: propojení lhůt s kalendářem Microsoft 365 (vlastní kalendář „Kancelář – lhůty“, ostatní kalendáře aplikace nečte)
export default function MicrosoftCalendarCard() {
    const { userId } = useLawyer();
    const master = useMasterKey();
    const [cfg, setCfg] = useState<{ configured: boolean } | null>(null);
    const [conn, setConn] = useState<Loaded | null | 'broken' | undefined>(undefined);
    const [busy, setBusy] = useState('');
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');

    useEffect(() => { let alive = true; microsoftConfig().then((c) => { if (alive) setCfg(c); }).catch(() => { if (alive) setCfg({ configured: false }); }); return () => { alive = false; }; }, []);
    const load = useCallback(async () => {
        if (!master) return;
        try { setConn(await loadMicrosoftConnection(master)); }
        catch (e) { setConn(null); setError(/ms_connections|schema cache|does not exist/i.test(String((e as Error)?.message)) ? 'Kalendář Microsoft 365 zatím není v databázi zapnutý (chybí spuštění souboru 20261119_25_microsoft-kalendar.sql).' : String((e as Error)?.message ?? 'Chyba.')); }
    }, [master]);
    useEffect(() => { let alive = true; Promise.resolve().then(() => { if (alive) void load(); }); return () => { alive = false; }; }, [load]);
    useEffect(() => { const on = (e: Event) => { setMsg((e as CustomEvent).detail?.message ?? ''); void load(); }; window.addEventListener('microsoft-sync', on); return () => window.removeEventListener('microsoft-sync', on); }, [load]);

    async function connect() { setError(''); try { window.location.href = await startMicrosoftConnect('/kancelar/nastaveni'); } catch (e) { setError(e instanceof Error ? e.message : 'Připojení se nepodařilo.'); } }
    async function sync() { if (!master) return; setBusy('sync'); setError(''); try { const r = await syncMicrosoft(master, userId); setMsg(r.message); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Synchronizace se nepodařila.'); } setBusy(''); }
    async function options(detail: Detail, internal: boolean) { try { await saveMicrosoftOptions(detail, internal); await load(); await sync(); } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se uložit.'); } }
    async function off(del: boolean) {
        if (!master || !await confirmAction(del ? 'Odpojit Kalendář Microsoft 365 a smazat kalendář „Kancelář – lhůty“ ve vašem Outlooku?' : 'Odpojit Kalendář Microsoft 365? Kalendář v Outlooku zůstane, jen se přestane aktualizovat.')) return;
        setBusy('off'); try { await disconnectMicrosoft(master, del); setConn(null); setMsg('Odpojeno.'); } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se.'); } setBusy('');
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Kalendář Microsoft 365">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><CalendarSync size={18} className="text-indigo-700" /> Kalendář Microsoft 365</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Lhůty ze všech spisů se zapíšou do samostatného kalendáře „Kancelář – lhůty“ ve vašem Outlooku, včetně připomínky (3 dny předem v 9:00, u interního termínu den předem) a interního termínu pro podání. Aplikace zapisuje jen do tohoto kalendáře. Změny lhůt se propíšou samy.</p>
            {cfg && !cfg.configured && <p role="status" className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Propojení zatím není na serveru nastavené. Správce musí doplnit klíče Microsoftu (MICROSOFT_CLIENT_ID a MICROSOFT_CLIENT_SECRET).</p>}
            {!master ? <p className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600"><KeyRound size={15} aria-hidden="true" /> Nejdřív odemkněte šifrovací heslo (výše). Přihlášení k Microsoftu se ukládá zašifrované jím.</p> : conn === undefined ? <p className="mt-3 text-sm text-slate-500" role="status">Načítám…</p> : (conn === null || conn === 'broken') ? (
                <div className="mt-3">
                    {conn === 'broken' && <p role="alert" className="mb-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">Uložené přihlášení se nepodařilo dešifrovat. Odemkněte správné šifrovací heslo, nebo se připojte znovu.</p>}
                    <button type="button" onClick={() => void connect()} disabled={cfg?.configured === false} className={primaryBtn}><Link2 size={15} /> Připojit Kalendář Microsoft 365</button>
                    <p className="mt-2 text-xs text-slate-500">Přesměrujeme vás na přihlášení k Microsoftu. Microsoft neumí oprávnění omezit na jediný kalendář, proto v souhlasu uvidíte „čtení a zápis do kalendářů“. Aplikace ale zapisuje výhradně do vlastního kalendáře „Kancelář – lhůty“ a ostatní kalendáře nečte.</p>
                </div>
            ) : (
                <div className="mt-3 space-y-3">
                    <p className="flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950"><Check size={15} aria-hidden="true" /> <span className="flex-1">Připojeno. {conn.row.last_sync_at ? `Naposledy synchronizováno ${new Date(conn.row.last_sync_at).toLocaleString('cs-CZ')}.` : 'Zatím nesynchronizováno.'}</span><button type="button" onClick={() => void sync()} disabled={busy === 'sync'} className={ghostBtn}>{busy === 'sync' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Synchronizovat teď</button></p>
                    <label className="block text-xs font-semibold text-slate-600">Co se zapisuje do událostí
                        <select value={conn.row.detail} onChange={(e) => void options(e.target.value as Detail, conn.row.internal)} className={`${inputCls} mt-1 max-w-md font-normal`}>{(Object.keys(DETAIL_LABELS) as Detail[]).map((d) => <option key={d} value={d}>{DETAIL_LABELS[d]}</option>)}</select>
                        <span className="mt-1 block text-xs font-normal text-slate-500">Události se ukládají u Microsoftu. Názvy spisů a jména klientů jsou důvěrné, proto je výchozí volba jen název lhůty.</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={conn.row.internal} onChange={(e) => void options(conn.row.detail, e.target.checked)} className="h-4 w-4 accent-indigo-800" /> Přidat i interní termín „Podat nejpozději“ (poslední pracovní den před koncem lhůty)</label>
                    <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void off(false)} disabled={busy === 'off'} className={ghostBtn}>Odpojit</button><button type="button" onClick={() => void off(true)} disabled={busy === 'off'} className={`${ghostBtn} text-rose-800`}>Odpojit a smazat kalendář</button></div>
                    <p className="text-xs leading-relaxed text-slate-500">Kalendář je jen pomůcka. Konec lhůty vždy ověřte v dokumentu. Ruční úpravy událostí v tomto kalendáři se při další synchronizaci přepíšou.</p>
                </div>
            )}
            {msg && <p role="status" className="mt-3 text-sm text-slate-700">{msg}</p>}
            {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
        </section>
    );
}
