'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, CreditCard, FileLock2, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { primaryBtn, ghostBtn, inputCls } from '../situation/caseUi';
import { intakeUrl, isValidIntakeCode, SECURITY_TEXT_LAWYER } from '@/lib/portal';
import { PROFESSION_LABELS, czk } from '@/lib/lawyer';
import { PLANS, planName, type PlanId, type Prices } from '@/lib/plans';
import { encryptForAdmin } from '@/lib/e2ee';
import { useLawyer } from './LawyerGate';

const STATUS: Record<string, string> = { trial: 'Zkušební přístup', active: 'Aktivní předplatné', requested: 'Čeká na potvrzení', expired: 'Vypršelo' };

export default function LawyerSettings() {
    const { access, userId } = useLawyer();
    const [prices, setPrices] = useState<Prices | null>(null);
    const [orders, setOrders] = useState<{ id: string; plan: PlanId; price_czk: number; status: string; period_end: string | null }[]>([]);
    const [payMsg, setPayMsg] = useState('');
    const paymentUrl = process.env.NEXT_PUBLIC_LAWYER_PAYMENT_URL ?? '';
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [p, o] = await Promise.all([supabase.rpc('lawyer_prices'), supabase.from('lawyer_orders').select('id, plan, price_czk, status, period_end').order('created_at', { ascending: false }).limit(5)]);
            if (cancelled) return;
            if (!p.error && p.data) setPrices(p.data as Prices);
            if (!o.error) setOrders((o.data ?? []) as typeof orders);
        })();
        return () => { cancelled = true; };
    }, []);
    const [idFile, setIdFile] = useState<File | null>(null);
    const [verifyBusy, setVerifyBusy] = useState(false);
    const [firm, setFirm] = useState(access.firm_name);
    const [rate, setRate] = useState(String(access.default_rate || ''));
    const [msg, setMsg] = useState('');
    const [profile, setProfile] = useState({ name: access.display_name ?? '', phone: access.phone ?? '', office: access.office ?? '', website: access.website ?? '', bar: access.bar_number ?? '', email: access.contact_email ?? '' });
    const [profileMsg, setProfileMsg] = useState('');
    const [verify, setVerify] = useState({ profession: (access.profession ?? 'advokat') as 'advokat' | 'jiny', name: access.register_name ?? '', bar: access.bar_number ?? '' });
    const [verifyMsg, setVerifyMsg] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const status = submitted ? 'pending' : (access.verification_status ?? 'none');
    const [code, setCode] = useState(access.intake_code ?? '');
    const [codeMsg, setCodeMsg] = useState('');

    async function save() {
        const value = rate.trim() ? Number(rate.replace(',', '.')) : 0;
        const { error } = await supabase.rpc('update_lawyer_profile', { p_firm: firm.trim(), p_rate: Number.isFinite(value) ? value : 0 });
        setMsg(error ? 'Uložení se nepovedlo.' : 'Uloženo. Změna se projeví po obnovení stránky.');
    }

    async function buy(plan: PlanId) {
        setPayMsg('');
        const { data, error } = await supabase.rpc('create_lawyer_order', { p_plan: plan });
        if (error) { setPayMsg(error.message); return; }
        if (paymentUrl) { window.open(`${paymentUrl}${paymentUrl.includes('?') ? '&' : '?'}order=${data}`, '_self'); return; }
        setPayMsg(`Objednávka ${String(data).slice(0, 8)} je vytvořena. Platební brána se připravuje, po jejím spuštění tu uvidíte tlačítko Zaplatit a přístup se po zaplacení aktivuje automaticky.`);
        const o = await supabase.from('lawyer_orders').select('id, plan, price_czk, status, period_end').order('created_at', { ascending: false }).limit(5);
        if (!o.error) setOrders((o.data ?? []) as typeof orders);
    }

    async function requestVerification() {
        if (verify.name.trim().length < 3 || (verify.profession === 'advokat' && !verify.bar.trim())) { setVerifyMsg('Vyplňte celé jméno přesně jako v seznamu a evidenční číslo ČAK.'); return; }
        if (!idFile) { setVerifyMsg('Přiložte fotografii nebo sken průkazu.'); return; }
        if (idFile.size > 6 * 1024 * 1024) { setVerifyMsg('Soubor je větší než 6 MB.'); return; }
        if (!/\.(jpe?g|png|webp|pdf)$/i.test(idFile.name)) { setVerifyMsg('Povolené jsou obrázky (JPG, PNG, WebP) a PDF.'); return; }
        setVerifyBusy(true); setVerifyMsg('');
        try {
            const { data: keyRow } = await supabase.from('admin_keys').select('public_key').maybeSingle();
            if (!keyRow) throw new Error('Ověřování ještě není připravené. Správce webu musí nejdřív vytvořit šifrovací klíč. Zkuste to prosím později.');
            // Průkaz se zašifruje tady v prohlížeči klíčem správce; přečte ho jen správce a po rozhodnutí se smaže
            const { blob, wrappedKey } = await encryptForAdmin(keyRow.public_key as string, idFile);
            const path = `${userId}/${crypto.randomUUID()}.bin`;
            const old = await supabase.from('verification_docs').select('path').eq('user_id', userId).maybeSingle();
            if (old.data) { await supabase.storage.from('verification-docs').remove([old.data.path as string]); await supabase.from('verification_docs').delete().eq('user_id', userId); }
            const up = await supabase.storage.from('verification-docs').upload(path, blob, { contentType: 'application/octet-stream' });
            if (up.error) throw new Error('Průkaz se nepodařilo nahrát.');
            const ins = await supabase.from('verification_docs').insert({ user_id: userId, path, wrapped_key: wrappedKey });
            if (ins.error) { await supabase.storage.from('verification-docs').remove([path]); throw new Error('Průkaz se nepodařilo uložit.'); }
            const { error } = await supabase.rpc('request_lawyer_verification', { p_profession: verify.profession, p_register_name: verify.name.trim(), p_bar: verify.bar.trim() });
            if (error) throw new Error(error.message);
            setVerifyMsg('Žádost je odeslaná. Ověření provádí náš tým ručně, obvykle do 2 pracovních dnů. Po rozhodnutí se váš průkaz nenávratně smaže.');
            setIdFile(null);
            setSubmitted(true);
        } catch (e) { setVerifyMsg(e instanceof Error ? e.message : 'Žádost se nepodařilo odeslat.'); } finally { setVerifyBusy(false); }
    }

    async function saveProfile() {
        const { error } = await supabase.rpc('update_lawyer_public_profile', { p_name: profile.name.trim(), p_phone: profile.phone.trim(), p_office: profile.office.trim(), p_web: profile.website.trim(), p_bar: profile.bar.trim(), p_email: profile.email.trim() });
        setProfileMsg(error ? 'Uložení se nepovedlo. Zkontrolujte, že je spuštěné SQL client-identity.sql.' : 'Uloženo. Klienti uvidí tyto údaje na své stránce.');
    }

    async function saveCode() {
        const value = code.trim().toLowerCase();
        if (value && !isValidIntakeCode(value)) { setCodeMsg('Použijte 4 až 40 znaků: malá písmena bez diakritiky, číslice a pomlčky.'); return; }
        const { error } = await supabase.rpc('set_intake_code', { p_code: value });
        setCodeMsg(error ? (error.code === '23505' ? 'Tento název je obsazený, zkuste jiný.' : 'Uložení se nepovedlo. Zkontrolujte, že je spuštěné SQL client-portal.sql.') : value ? 'Odkaz je aktivní.' : 'Odkaz je vypnutý.');
    }

    const link = code.trim() && isValidIntakeCode(code.trim().toLowerCase()) && typeof window !== 'undefined' ? intakeUrl(window.location.origin, code.trim().toLowerCase()) : '';

    return (
        <div className="max-w-xl space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold text-slate-900">Kancelář</h2>
                <label className="mt-3 block text-sm font-semibold text-slate-700">Název kanceláře
                    <input value={firm} onChange={(e) => setFirm(e.target.value)} maxLength={120} className={`${inputCls} mt-1 font-normal`} placeholder="např. Advokátní kancelář Novák" />
                </label>
                <label className="mt-3 block text-sm font-semibold text-slate-700">Výchozí hodinová sazba (Kč)
                    <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className={`${inputCls} mt-1 max-w-40 font-normal`} placeholder="např. 2000" />
                </label>
                <button type="button" onClick={() => void save()} className={`${primaryBtn} mt-4`}><Check size={16} /> Uložit</button>
                {msg && <p role="status" className="mt-2 text-sm text-slate-600">{msg}</p>}
            </section>
            <section className={`rounded-2xl border p-5 ${status === 'verified' ? 'border-emerald-200 bg-emerald-50/50' : 'border-indigo-300 bg-indigo-50/60'}`}>
                <h2 className="text-lg font-bold text-slate-900">Ověření totožnosti</h2>
                {status === 'verified' ? (
                    <p className="mt-2 text-sm text-emerald-900"><strong>Ověřeno.</strong> {PROFESSION_LABELS[access.profession ?? 'advokat']}{access.verified_at ? `, ${new Date(access.verified_at).toLocaleDateString('cs-CZ')}` : ''}. Klienti u vás uvidí označení „Ověřený“.</p>
                ) : (
                    <>
                        <p className="mt-1 text-sm text-slate-700">Aby se za advokáty nemohl vydávat nikdo jiný, klientské odkazy a poptávkový formulář se zapnou až po ověření. Ověřujeme podle veřejného seznamu advokátů České advokátní komory.</p>
                        {status === 'pending' && <p className="mt-2 rounded-lg bg-white p-3 text-sm font-semibold text-indigo-950">Žádost čeká na posouzení týmem.</p>}
                        {status === 'rejected' && <p className="mt-2 rounded-lg bg-white p-3 text-sm font-semibold text-rose-900">Ověření se nepodařilo{access.verification_note ? `: ${access.verification_note}` : '.'} Opravte údaje, nahrajte průkaz znovu a odešlete žádost.</p>}
                        {status !== 'pending' && (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">Jsem
                                    <select value={verify.profession} onChange={(e) => setVerify((v) => ({ ...v, profession: e.target.value as 'advokat' | 'jiny' }))} className={`${inputCls} mt-1 font-normal`}><option value="advokat">Advokát zapsaný v ČAK</option><option value="jiny">Jiný právník (koncipient, interní právník…)</option></select>
                                </label>
                                <label className="block text-xs font-semibold text-slate-600">Celé jméno přesně jako v seznamu<input value={verify.name} onChange={(e) => setVerify((v) => ({ ...v, name: e.target.value }))} maxLength={160} className={`${inputCls} mt-1 font-normal`} placeholder="např. JUDr. Jan Novák" /></label>
                                <label className="block text-xs font-semibold text-slate-600">Evidenční číslo ČAK<input value={verify.bar} onChange={(e) => setVerify((v) => ({ ...v, bar: e.target.value }))} maxLength={40} className={`${inputCls} mt-1 font-normal`} placeholder={verify.profession === 'advokat' ? 'např. 12345' : 'nepovinné'} /></label>
                                <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">Průkaz advokáta (fotografie nebo sken)
                                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setIdFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm font-normal file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold" />
                                </label>
                                <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-600 sm:col-span-2"><FileLock2 size={14} className="mt-0.5 shrink-0 text-indigo-800" aria-hidden="true" />Průkaz se zašifruje přímo ve vašem prohlížeči klíčem správce webu. Nikdo jiný ho neuvidí a po schválení i po zamítnutí se nenávratně smaže. Zakryjte na něm údaje, které nejsou potřeba (např. rodné číslo).</p>
                                <button type="button" onClick={() => void requestVerification()} disabled={verifyBusy} className={`${primaryBtn} sm:col-span-2 justify-center`}><Lock size={16} /> {verifyBusy ? 'Šifruji a odesílám…' : 'Odeslat žádost o ověření'}</button>
                            </div>
                        )}
                        {verifyMsg && <p role="status" className="mt-2 text-sm text-slate-700">{verifyMsg}</p>}
                    </>
                )}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Předplatné">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><CreditCard size={18} className="text-indigo-800" /> Předplatné</h2>
                <p className="mt-1 text-sm text-slate-700">{access.status === 'active' && access.until ? <>Aktivní do <strong>{new Date(`${access.until}T12:00:00`).toLocaleDateString('cs-CZ')}</strong>. Kancelář a klientské odkazy fungují po dobu předplatného.</> : access.status === 'trial' ? 'Máte zkušební přístup. Klientské odkazy fungují jen s ověřenou totožností a aktivním přístupem.' : 'Přístup momentálně není aktivní.'}</p>
                {!prices || (!prices.month && !prices.year) ? (
                    <p className="mt-3 text-sm text-slate-600">Ceny budou brzy zveřejněny.</p>
                ) : (
                    <>
                        <div className="mt-3 flex flex-wrap gap-3">
                            {PLANS.filter((pl) => prices[pl.id] > 0).map((pl, i) => <button key={pl.id} type="button" onClick={() => void buy(pl.id)} disabled={status !== 'verified'} className={i === 0 ? primaryBtn : ghostBtn}>{pl.name} · {czk(prices[pl.id])}</button>)}
                        </div>
                        {status !== 'verified' && <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-950">Balíčky si můžete koupit, jakmile projdete ověřením totožnosti. Tím předcházíme tomu, aby někdo zaplatil dřív, než ho ověříme.</p>}
                    </>
                )}
                {payMsg && <p role="status" className="mt-3 text-sm text-slate-700">{payMsg}</p>}
                {orders.length > 0 && <ul className="mt-3 divide-y divide-slate-100 text-xs text-slate-600">{orders.map((o) => <li key={o.id} className="flex justify-between py-1.5"><span>{planName(o.plan)} · {czk(o.price_czk)}</span><span>{o.status === 'paid' ? `zaplaceno${o.period_end ? `, platí do ${new Date(`${o.period_end}T12:00:00`).toLocaleDateString('cs-CZ')}` : ''}` : o.status === 'pending' ? 'čeká na platbu' : o.status === 'refund_due' ? 'bude vráceno' : 'zrušeno'}</span></li>)}</ul>}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold text-slate-900">Vizitka pro klienty</h2>
                <p className="mt-1 text-sm text-slate-600">Tyto údaje uvidí klient na své stránce, aby věděl, s kým komunikuje. Ukáže se jen to, co vyplníte.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {([['name', 'Jméno a titul', 'např. JUDr. Jan Novák'], ['bar', 'Evidenční číslo ČAK', 'nepovinné'], ['phone', 'Telefon', '+420 …'], ['email', 'E-mail pro klienty', 'např. novak@kancelar.cz'], ['office', 'Adresa kanceláře', 'ulice, město'], ['website', 'Web', 'www.kancelar.cz']] as const).map(([key, label, placeholder]) => (
                        <label key={key} className="block text-xs font-semibold text-slate-600">{label}
                            <input value={profile[key]} onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} maxLength={200} className={`${inputCls} mt-1 font-normal`} />
                        </label>
                    ))}
                </div>
                <button type="button" onClick={() => void saveProfile()} className={`${primaryBtn} mt-4`}><Check size={16} /> Uložit vizitku</button>
                {profileMsg && <p role="status" className="mt-2 text-sm text-slate-600">{profileMsg}</p>}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold text-slate-900">Poptávkový odkaz</h2>
                <p className="mt-1 text-sm text-slate-600">Veřejný formulář, přes který vám zájemce popíše věc. Odkaz vložte na web nebo do podpisu e-mailu. Poptávky najdete v záložce Poptávky.</p>
                <label className="mt-3 block text-sm font-semibold text-slate-700">Název v odkazu
                    <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="např. ak-novak" maxLength={40} className={`${inputCls} mt-1 font-normal`} />
                </label>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => void saveCode()} className={primaryBtn}><Check size={16} /> Uložit a zapnout</button>
                    {link && <button type="button" onClick={() => void navigator.clipboard?.writeText(link)} className={ghostBtn}><Copy size={14} /> Kopírovat odkaz</button>}
                </div>
                {link && <p className="mt-2 break-all text-xs text-slate-500">{link}</p>}
                {codeMsg && <p role="status" className="mt-2 text-sm text-slate-600">{codeMsg}</p>}
                <p className="mt-3 text-xs text-slate-500">Prázdný název odkaz vypne.</p>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
                <h2 className="text-lg font-bold text-slate-900">Zabezpečení</h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{SECURITY_TEXT_LAWYER}</p>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
                <h2 className="text-lg font-bold text-slate-900">Přístup</h2>
                <p className="mt-2"><strong>{STATUS[access.status] ?? access.status}</strong>{access.until && <> do {new Date(`${access.until}T12:00:00`).toLocaleDateString('cs-CZ')}</>}</p>
                <p className="mt-1 text-xs text-slate-500">Prodloužení nebo změnu tarifu vám potvrdíme e-mailem na adrese {access.email || 'vašeho účtu'}.</p>
            </section>
        </div>
    );
}
