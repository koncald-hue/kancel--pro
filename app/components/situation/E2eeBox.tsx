'use client';

import { useState } from 'react';
import { Check, KeyRound, Lock, LockOpen, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { masterFromRecovery, recoveryCodeOf, setMaster, setRemembered, setupMaster, unlockMaster } from '@/lib/e2ee';
import { useMasterKey, useRemembered } from '@/lib/useE2ee';
import { useAuth } from '@/app/components/site/AuthContext';
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
    // Nový klíč se aktivuje až po potvrzení záchranného kódu: jinak by stránka, která E2eeBox ukazuje jen u zamčeného
    // šifrování, kód skryla dřív, než si ho uživatel stihl uložit
    const [pending, setPending] = useState<CryptoKey | null>(null);
    const [reveal, setReveal] = useState(false);
    const { account } = useAuth();
    const remembered = useRemembered();
    // Na vlastním počítači stačí heslo zadat jednou; na cizím se zaškrtnutí zruší
    const [remember, setRemember] = useState(true);
    const rememberBox = (
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-800">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-800" />
            <span><strong>Zapamatovat toto zařízení.</strong> Heslo už tu nebudete zadávat, šifrování se po přihlášení odemkne samo. Na cizím nebo sdíleném počítači nezaškrtávejte.</span>
        </label>
    );
    const activate = async (key: CryptoKey) => { await setMaster(key); if (remember && account) await setRemembered(true, account.id); };

    async function setup() {
        if (pass.length < 10) { setError('Šifrovací heslo musí mít aspoň 10 znaků.'); return; }
        if (pass !== pass2) { setError('Hesla se neshodují.'); return; }
        setBusy(true); setError('');
        try {
            const out = await setupMaster(pass);
            const { error: err } = await supabase.rpc('set_e2ee_keys', { p_salt: out.salt, p_wrapped: out.wrapped });
            if (err) throw new Error('Uložení klíčů se nepovedlo. Zkontrolujte, že je spuštěné SQL verification-e2ee.sql.');
            setPending(out.master);
            setShown(out.recovery);
            setPass(''); setPass2('');
        } catch (e) { setError(e instanceof Error ? e.message : 'Něco se nepovedlo.'); } finally { setBusy(false); }
    }

    async function unlock() {
        setBusy(true); setError('');
        try {
            const key = useRecovery ? await masterFromRecovery(recovery) : await unlockMaster(pass, access!.e2ee_salt!, access!.e2ee_wrapped_master!);
            await activate(key);
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
                <div className="mt-3">{rememberBox}</div>
                <button type="button" disabled={!saved} onClick={() => { void (async () => { if (pending) await activate(pending); setPending(null); setShown(null); setSaved(false); onChanged(); })(); }} className={`${primaryBtn} mt-3`}><Check size={16} /> Pokračovat</button>
            </section>
        );
    }

    async function showRecovery() {
        setBusy(true); setError('');
        try { await unlockMaster(pass, access!.e2ee_salt!, access!.e2ee_wrapped_master!); setShown(await recoveryCodeOf(master!)); setPass(''); setReveal(false); }
        catch { setError('Heslo nesedí.'); } finally { setBusy(false); }
    }

    if (master) {
        return (
            <div className="space-y-2">
                <p className="flex flex-wrap items-center gap-2 text-sm text-emerald-800"><LockOpen size={15} aria-hidden="true" /> {remembered ? 'Šifrování je odemčené a toto zařízení je zapamatované.' : 'Šifrování je odemčené na tomto zařízení.'}
                    {remembered
                        ? <button type="button" onClick={() => void setRemembered(false)} className="text-xs font-semibold text-slate-600 underline cursor-pointer">Zapomenout toto zařízení</button>
                        : account && <button type="button" onClick={() => void setRemembered(true, account.id)} className="text-xs font-semibold text-slate-600 underline cursor-pointer">Zapamatovat toto zařízení</button>}
                    <button type="button" onClick={() => void setMaster(null)} className="text-xs font-semibold text-slate-600 underline cursor-pointer">Zamknout</button>
                    {configured && <button type="button" onClick={() => { setReveal((v) => !v); setError(''); }} className="text-xs font-semibold text-slate-600 underline cursor-pointer">Zobrazit záchranný kód</button>}</p>
                {reveal && (
                    <form onSubmit={(e) => { e.preventDefault(); void showRecovery(); }} className="flex flex-wrap items-center gap-2">
                        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Pro jistotu zadejte šifrovací heslo" autoComplete="current-password" className={`${inputCls} max-w-xs`} aria-label="Šifrovací heslo" />
                        <button type="submit" disabled={busy || !pass} className={ghostBtn}><KeyRound size={14} /> Zobrazit</button>
                    </form>
                )}
                {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
            </div>
        );
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="End-to-end šifrování">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ShieldCheck size={18} className="text-indigo-800" /> End-to-end šifrování</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Zprávy a soubory mezi vámi a klientem se zašifrují ve vašem prohlížeči. Na zapamatovaném zařízení zadáte heslo jen jednou, jinak se klíč zamkne po 30 minutách bez práce nebo zavřením karty. Šifrování nechrání před škodlivým kódem spuštěným v této stránce.</p>
            {!configured ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Šifrovací heslo (min. 10 znaků)" autoComplete="new-password" className={inputCls} aria-label="Šifrovací heslo" />
                    <input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="Heslo znovu" autoComplete="new-password" className={inputCls} aria-label="Heslo znovu" />
                    <div role="alert" className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-sm leading-relaxed text-rose-950 sm:col-span-2">
                        <p className="font-bold">Toto heslo si musíte pamatovat. Nelze ho obnovit.</p>
                        <ul className="mt-1.5 list-disc space-y-1 pl-5">
                            <li>Šifrovací heslo si nastavuje <strong>každý uživatel sám za sebe</strong>. Nezná ho vedoucí kanceláře, provozovatel ani nikdo jiný, proto je ani nikdo nemůže resetovat.</li>
                            <li>Je jiné než heslo k účtu (to jde obnovit e-mailem).</li>
                            <li>Když ho zapomenete, pomůže jen <strong>záchranný kód</strong>, který dostanete hned po nastavení. Bez hesla i kódu budou vaše zašifrované zprávy a soubory <strong>nenávratně ztracené</strong>.</li>
                        </ul>
                    </div>
                    <button type="button" onClick={() => void setup()} disabled={busy} className={`${primaryBtn} sm:col-span-2 justify-center`}><Lock size={16} /> Nastavit šifrování</button>
                </div>
            ) : (
                <div className="mt-3 space-y-2">
                    {useRecovery ? <input value={recovery} onChange={(e) => setRecovery(e.target.value)} placeholder="Záchranný kód" className={inputCls} aria-label="Záchranný kód" /> : <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Šifrovací heslo" autoComplete="current-password" className={inputCls} aria-label="Šifrovací heslo" onKeyDown={(e) => { if (e.key === 'Enter') void unlock(); }} />}
                    {rememberBox}
                    <div className="flex flex-wrap items-center gap-3">
                        <button type="button" onClick={() => void unlock()} disabled={busy} className={primaryBtn}><LockOpen size={16} /> Odemknout</button>
                        <button type="button" onClick={() => { setUseRecovery((v) => !v); setError(''); }} className={ghostBtn}>{useRecovery ? 'Použít šifrovací heslo' : 'Zapomenuté šifrovací heslo? Použít záchranný kód'}</button>
                    </div>
                </div>
            )}
            {error && <p role="alert" className="mt-2 text-sm text-rose-800">{error}</p>}
        </section>
    );
}
