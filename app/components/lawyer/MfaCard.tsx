'use client';

import { confirmAction } from '@/lib/confirm';
import { useEffect, useState } from 'react';
import { ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { enrollTotp, listTotp, removeTotp, verifyCode, type TotpFactor } from '@/lib/mfa';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';

// Nastavení dvoufázového přihlášení: zapnutí (QR kód), přidání druhého zařízení, vypnutí
export default function MfaCard() {
    const [factors, setFactors] = useState<TotpFactor[] | null>(null);
    const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [note, setNote] = useState('');
    const load = () => listTotp().then(setFactors).catch(() => setFactors([]));
    useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, []);

    async function start() {
        setBusy(true); setError(''); setNote('');
        try { setSetup(await enrollTotp('Kancelář Pro')); setCode(''); }
        catch (e) { setError(/disabled|not enabled|mfa/i.test(String(e)) ? 'Dvoufázové přihlášení není na straně Supabase zapnuté (Authentication → Multi-Factor → TOTP).' : e instanceof Error ? e.message : 'Nepodařilo se zahájit.'); }
        finally { setBusy(false); }
    }
    async function confirm() {
        if (!setup) return;
        setBusy(true); setError('');
        try { await verifyCode(setup.id, code); setSetup(null); setNote('Zapnuto. Od příštího přihlášení budete zadávat kód z aplikace.'); await load(); }
        catch (e) { setError(e instanceof Error ? e.message : 'Ověření se nepodařilo.'); }
        finally { setBusy(false); }
    }
    async function remove(f: TotpFactor) {
        if ((factors ?? []).length === 1 && !await confirmAction('Vypnout dvoufázové přihlášení? Účet pak bude chráněný jen heslem.')) return;
        setBusy(true); setError('');
        try { await removeTotp(f.id); await load(); setNote('Zařízení odebráno.'); }
        catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se odebrat.'); }
        finally { setBusy(false); }
    }

    const on = (factors ?? []).length > 0;
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="mfa-title">
            <h3 id="mfa-title" className="flex items-center gap-2 text-lg font-bold text-slate-900"><ShieldCheck size={18} className="text-indigo-800" aria-hidden="true" /> Dvoufázové přihlášení</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Kromě hesla se při přihlášení zadává kód z aplikace v telefonu. Chrání spisy klientů, i když někdo heslo zjistí. {on ? <strong className="text-emerald-800">Je zapnuté.</strong> : <strong className="text-amber-800">Zatím je vypnuté.</strong>}</p>

            {factors === null ? <p className="mt-3 text-sm text-slate-500" role="status">Načítám…</p> : (
                <>
                    {on && <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">{factors.map((f) => <li key={f.id} className="flex items-center gap-3 px-3 py-2.5 text-sm"><Smartphone size={15} className="text-slate-400" aria-hidden="true" /><span className="min-w-0 flex-1 truncate text-slate-800">{f.friendly_name || 'Ověřovací aplikace'}</span><button type="button" onClick={() => void remove(f)} disabled={busy} aria-label="Odebrat zařízení" className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={15} /></button></li>)}</ul>}
                    {!setup && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void start()} disabled={busy} className={on ? ghostBtn : primaryBtn}>{on ? 'Přidat další zařízení' : 'Zapnout dvoufázové přihlášení'}</button></div>}
                    {on && factors.length === 1 && <p className="mt-2 text-xs text-amber-800">Doporučujeme přidat druhé zařízení (třeba tablet). Když přijdete o telefon bez záložního zařízení, dostanete se do účtu až po vypnutí druhého faktoru provozovatelem.</p>}
                </>
            )}

            {setup && (
                <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                    <p className="text-sm font-semibold text-slate-900">1. V ověřovací aplikaci naskenujte QR kód</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={setup.qr} alt="QR kód pro ověřovací aplikaci" className="mt-2 h-40 w-40 rounded-lg bg-white p-1" />
                    <p className="mt-2 text-xs text-slate-600">Nejde naskenovat? Zadejte ručně klíč: <code className="select-all break-all rounded bg-white px-1.5 py-0.5 font-mono text-xs">{setup.secret}</code>. Klíč nikde nesdílejte.</p>
                    <p className="mt-3 text-sm font-semibold text-slate-900">2. Opište šestimístný kód z aplikace</p>
                    <form onSubmit={(e) => { e.preventDefault(); void confirm(); }} className="mt-2 flex flex-wrap items-center gap-2">
                        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" aria-label="Kód z aplikace" className={`${inputCls} w-36 text-lg tracking-[0.25em]`} />
                        <button type="submit" disabled={busy || code.length !== 6} className={primaryBtn}>{busy ? 'Ověřuji…' : 'Zapnout'}</button>
                        <button type="button" onClick={() => setSetup(null)} className={ghostBtn}>Zrušit</button>
                    </form>
                </div>
            )}
            {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-900">{error}</p>}
            {note && <p role="status" className="mt-3 text-sm font-semibold text-emerald-800">{note}</p>}
        </section>
    );
}
