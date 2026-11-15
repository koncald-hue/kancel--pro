'use client';

import { useState } from 'react';
import { Check, KeyRound, Lock, LockOpen, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { masterFromRecovery, setMaster, setupMaster, unlockMaster } from '@/lib/e2ee';
import { useMasterKey } from '@/lib/useE2ee';
import type { LawyerAccess } from '@/lib/lawyer';
import { ghostBtn, inputCls, primaryBtn } from './caseUi';

// Nastavení a odemykání end-to-end šifrování advokáta. Heslo ani klíč nikdy neopustí prohlížeč.
export default function E2eeBox({ access, onChanged }: { access: LawyerAccess | null; onChanged: () => void }) {
    const master = useMasterKey();
    const configured = !!(access?.e2ee_salt && access?.e2ee_wrapped_master);
    const [pass, setPass] = useState('');
    const [pass2, setPass2] = useState('');
    const [recovery, setRecovery] = useState('');
    const [useRecovery, setUseRecovery] = useState(false);
    const [shown, setShown] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function setup() {
        if (pass.length < 10) { setError('Heslo kanceláře musí mít aspoň 10 znaků.'); return; }
        if (pass !== pass2) { setError('Hesla se neshodují.'); return; }
        setBusy(true); setError('');
        try {
            const out = await setupMaster(pass);
            const { error: err } = await supabase.rpc('set_e2ee_keys', { p_salt: out.salt, p_wrapped: out.wrapped });
            if (err) throw new Error('Uložení klíčů se nepovedlo. Zkontrolujte, že je spuštěné SQL verification-e2ee.sql.');
            await setMaster(out.master);
            setShown(out.recovery);
            setPass(''); setPass2('');
        } catch (e) { setError(e instanceof Error ? e.message : 'Něco se nepovedlo.'); } finally { setBusy(false); }
    }

    async function unlock() {
        setBusy(true); setError('');
        try {
            const key = useRecovery ? await masterFromRecovery(recovery) : await unlockMaster(pass, access!.e2ee_salt!, access!.e2ee_wrapped_master!);
            await setMaster(key);
            setPass(''); setRecovery('');
        } catch { setError(useRecovery ? 'Záchranný kód nesedí.' : 'Heslo nesedí. Zkuste to znovu, nebo použijte záchranný kód.'); } finally { setBusy(false); }
    }

    // Po nastavení se jednou ukáže záchranný kód; bez jeho potvrzení se dál nejde
    if (shown) {
        return (
            <section className="rounded-2xl border border-indigo-300 bg-indigo-50 p-5" aria-label="Záchranný kód">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><KeyRound size={18} /> Uložte si záchranný kód</h3>
                <p className="mt-1 text-sm text-slate-700">Kdybyste zapomněli heslo, jen tímto kódem obnovíte přístup k šifrovaným zprávám a souborům. <strong>Nikdo jiný vám ho nevydá.</strong> Bez hesla i kódu jsou data nenávratně ztracená.</p>
                <p className="mt-3 break-all rounded-xl bg-white p-3 font-mono text-sm text-slate-900 select-all">{shown}</p>
                <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-slate-800"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-800" /> Kód jsem si uložil na bezpečné místo (správce hesel nebo vytištěný papír).</label>
                <button type="button" disabled={!saved} onClick={() => { setShown(null); setSaved(false); onChanged(); }} className={`${primaryBtn} mt-3`}><Check size={16} /> Pokračovat</button>
            </section>
        );
    }

    if (master) {
        return (
            <p className="flex flex-wrap items-center gap-2 text-sm text-emerald-800"><LockOpen size={15} aria-hidden="true" /> Šifrování je odemčené na tomto zařízení.
                <button type="button" onClick={() => void setMaster(null)} className="text-xs font-semibold text-slate-600 underline cursor-pointer">Zamknout</button></p>
        );
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="End-to-end šifrování">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ShieldCheck size={18} className="text-indigo-800" /> End-to-end šifrování</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Zprávy a soubory mezi vámi a klientem se zašifrují ve vašem prohlížeči. Server, správce webu ani poskytovatel databáze je nepřečtou. Klíč se vám ukládá jen v zašifrované podobě a odemyká se heslem kanceláře.</p>
            {!configured ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Heslo kanceláře (min. 10 znaků)" autoComplete="new-password" className={inputCls} aria-label="Heslo kanceláře" />
                    <input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="Heslo znovu" autoComplete="new-password" className={inputCls} aria-label="Heslo znovu" />
                    <p className="text-xs text-slate-500 sm:col-span-2">Toto heslo je jiné než heslo k účtu a nelze ho obnovit. Dostanete záchranný kód.</p>
                    <button type="button" onClick={() => void setup()} disabled={busy} className={`${primaryBtn} sm:col-span-2 justify-center`}><Lock size={16} /> Nastavit šifrování</button>
                </div>
            ) : (
                <div className="mt-3 space-y-2">
                    {useRecovery ? <input value={recovery} onChange={(e) => setRecovery(e.target.value)} placeholder="Záchranný kód" className={inputCls} aria-label="Záchranný kód" /> : <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Heslo kanceláře" autoComplete="current-password" className={inputCls} aria-label="Heslo kanceláře" onKeyDown={(e) => { if (e.key === 'Enter') void unlock(); }} />}
                    <div className="flex flex-wrap items-center gap-3">
                        <button type="button" onClick={() => void unlock()} disabled={busy} className={primaryBtn}><LockOpen size={16} /> Odemknout</button>
                        <button type="button" onClick={() => { setUseRecovery((v) => !v); setError(''); }} className={ghostBtn}>{useRecovery ? 'Použít heslo' : 'Zapomněl jsem heslo'}</button>
                    </div>
                </div>
            )}
            {error && <p role="alert" className="mt-2 text-sm text-rose-800">{error}</p>}
        </section>
    );
}
