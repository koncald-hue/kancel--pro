'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, CreditCard, Loader2, Mail, Trash2, UserPlus, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { czk } from '@/lib/lawyer';
import { PLANS, type PlanId } from '@/lib/plans';
import { EMPTY_FIRM_PRICES, FIRM_SIZES, VERIFICATION_LABEL, inviteUrl, type FirmOverview, type FirmPrices, type FirmSize } from '@/lib/firm';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

const dateCz = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ') : '–');

// Kancelář a tým: vedoucí zakládá kancelář, pořizuje balíček a zve advokáty. Každý člen má vlastní účet a vlastní data.
export default function LawyerTeam() {
    const { userId } = useLawyer();
    const [overview, setOverview] = useState<FirmOverview | null | undefined>(undefined);
    const [prices, setPrices] = useState<FirmPrices>(EMPTY_FIRM_PRICES);
    const [error, setError] = useState('');
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [size, setSize] = useState<FirmSize>(3);
    const [copied, setCopied] = useState('');
    const paymentUrl = process.env.NEXT_PUBLIC_LAWYER_PAYMENT_URL ?? '';

    const load = useCallback(async () => {
        const [o, p] = await Promise.all([supabase.rpc('firm_overview'), supabase.rpc('firm_prices')]);
        if (o.error) { setError(/firm_overview|does not exist|find the function/i.test(o.error.message) ? 'Kanceláře ještě nejsou v databázi zapnuté (chybí spuštění souboru firms.sql).' : o.error.message); setOverview(null); return; }
        setError('');
        setOverview((o.data as FirmOverview | null) ?? null);
        if (!p.error && p.data) setPrices(p.data as FirmPrices);
    }, []);

    useEffect(() => {
        let cancelled = false;
        void (async () => { await Promise.resolve(); if (!cancelled) await load(); })();
        return () => { cancelled = true; };
    }, [load]);

    async function run(fn: () => PromiseLike<{ error: { message: string } | null; data?: unknown }>, done?: string) {
        setBusy(true); setMsg('');
        const { error: err } = await fn();
        setBusy(false);
        if (err) { setMsg(err.message); return false; }
        if (done) setMsg(done);
        await load();
        return true;
    }

    async function createFirm() { if (await run(() => supabase.rpc('create_firm', { p_name: name }))) setName(''); }
    async function invite() { if (await run(() => supabase.rpc('invite_firm_member', { p_email: email }), 'Pozvánka je vytvořena. Pošlete členovi odkaz níže.')) setEmail(''); }

    async function buy(plan: PlanId) {
        setBusy(true); setMsg('');
        const { data, error: err } = await supabase.rpc('create_firm_order', { p_plan: plan, p_seats: size });
        setBusy(false);
        if (err) { setMsg(err.message); return; }
        if (paymentUrl) { window.open(`${paymentUrl}${paymentUrl.includes('?') ? '&' : '?'}order=${data}`, '_self'); return; }
        setMsg(`Objednávka ${String(data).slice(0, 8)} je vytvořena. Platební brána se připravuje, po jejím spuštění tu uvidíte tlačítko Zaplatit a přístup se po zaplacení aktivuje všem členům automaticky.`);
    }

    async function copy(token: string) {
        try { await navigator.clipboard.writeText(inviteUrl(token)); setCopied(token); setTimeout(() => setCopied(''), 2000); } catch { setMsg('Odkaz se nepodařilo zkopírovat, označte ho a zkopírujte ručně.'); }
    }

    if (overview === undefined) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    const f = overview?.firm;
    const isOwner = f?.role === 'owner';
    const active = !!f && f.seats > 0 && !!f.until && f.until >= new Date().toISOString().slice(0, 10);
    const used = (overview?.members?.length ?? 0) + (overview?.invites?.length ?? 0);

    return (
        <div className="space-y-5">
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</p>}
            {msg && <p role="status" className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950">{msg}</p>}

            {!error && !f && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Users size={18} className="text-indigo-700" /> Založit kancelář</h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">Chcete, aby Kancelář používalo více advokátů najednou? Založte kancelář, pořiďte balíček pro 3, 5 nebo 10 advokátů a pozvěte kolegy. <strong>Každý advokát má vlastní účet, heslo a vlastní data.</strong> Vedoucí kanceláře jeho věci, klienty ani zprávy nevidí.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Název kanceláře" maxLength={120} className={`${inputCls} max-w-sm`} aria-label="Název kanceláře" />
                        <button type="button" onClick={() => void createFirm()} disabled={busy || name.trim().length < 2} className={primaryBtn}>Založit kancelář</button>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Pokud vás kolega už pozval, otevřete odkaz z pozvánky, který vám poslal.</p>
                </section>
            )}

            {f && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">{f.name}</h2>
                            <p className="mt-1 text-sm text-slate-600">{isOwner ? 'Jste vedoucí kanceláře.' : 'Jste členem kanceláře. Vaše věci a klienty vidíte jen vy.'}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${active ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-700'}`}>{active ? `Balíček pro ${f.seats} do ${dateCz(f.until)}` : 'Bez aktivního balíčku'}</span>
                    </div>
                    {!isOwner && <button type="button" onClick={() => { if (window.confirm('Opravdu opustit kancelář? Ztratíte přístup z jejího balíčku. Vaše data zůstanou vaše.')) void run(() => supabase.rpc('leave_firm')); }} disabled={busy} className={`${ghostBtn} mt-4`}>Opustit kancelář</button>}
                </section>
            )}

            {isOwner && (
                <>
                    <section className="rounded-2xl border border-slate-200 bg-white p-6">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><CreditCard size={18} className="text-indigo-700" /> Balíček pro kancelář</h2>
                        <p className="mt-1 text-sm text-slate-600">Platí za celou kancelář. Po zaplacení se přístup aktivuje všem členům. Objednat může vedoucí s vyplněným profilem.</p>
                        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Počet advokátů">
                            {FIRM_SIZES.map((n) => <button key={n} type="button" aria-pressed={size === n} onClick={() => setSize(n)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${size === n ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-300 text-slate-700'}`}>Do {n} advokátů</button>)}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                            {PLANS.filter((pl) => prices[size][pl.id] > 0).map((pl, i) => <button key={pl.id} type="button" onClick={() => void buy(pl.id)} disabled={busy} className={i === 0 ? primaryBtn : ghostBtn}>{pl.name} · {czk(prices[size][pl.id])}</button>)}
                            {PLANS.every((pl) => !(prices[size][pl.id] > 0)) && <p className="text-sm text-slate-600">Ceny balíčků budou brzy zveřejněny.</p>}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-6">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><UserPlus size={18} className="text-indigo-700" /> Členové ({overview?.members?.length ?? 0} z {f?.seats || 0})</h2>
                        <p className="mt-1 text-xs text-slate-500">Vidíte jen jméno, e-mail, stav profilu a stav přístupu. Věci, klienty, soubory ani zprávy členů nevidíte.</p>
                        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                            {(overview?.members ?? []).map((m) => (
                                <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                                    <span><strong className="text-slate-900">{m.name || m.email || 'Člen'}</strong>{m.role === 'owner' && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-900">Vedoucí</span>}<span className="block text-xs text-slate-500">{m.email} · {VERIFICATION_LABEL[m.verification]}{m.until ? ` · přístup do ${dateCz(m.until)}` : ''}</span></span>
                                    {m.user_id !== userId && <button type="button" onClick={() => { if (window.confirm('Odebrat člena? Ztratí přístup z balíčku kanceláře, jeho data zůstanou jeho.')) void run(() => supabase.rpc('remove_firm_member', { p_user: m.user_id })); }} disabled={busy} aria-label={`Odebrat ${m.email}`} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50"><Trash2 size={15} /></button>}
                                </li>
                            ))}
                        </ul>

                        {active ? (
                            <div className="mt-5">
                                <p className="text-sm font-semibold text-slate-900">Pozvat advokáta {used >= (f?.seats ?? 0) && <span className="font-normal text-slate-500">(všechna místa jsou obsazená)</span>}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="e-mail kolegy" className={`${inputCls} max-w-xs`} aria-label="E-mail kolegy" />
                                    <button type="button" onClick={() => void invite()} disabled={busy || !email.includes('@') || used >= (f?.seats ?? 0)} className={primaryBtn}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} Vytvořit pozvánku</button>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">Pozvánka je odkaz, který kolegovi pošlete sami (e-mailem nebo zprávou). Platí 14 dní, jen pro tento e-mail a jen jednou. Kolega si pod ním vytvoří vlastní účet a heslo.</p>
                            </div>
                        ) : <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Pozvánky půjde vytvářet po zaplacení balíčku.</p>}

                        {(overview?.invites ?? []).length > 0 && (
                            <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                                {(overview?.invites ?? []).map((i) => (
                                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                                        <span><strong className="text-slate-900">{i.email}</strong><span className="block text-xs text-slate-500">Čeká na přijetí · platí do {new Date(i.expires_at).toLocaleDateString('cs-CZ')}</span></span>
                                        <span className="flex gap-2">
                                            <button type="button" onClick={() => void copy(i.token)} className={ghostBtn}>{copied === i.token ? <><Check size={14} /> Zkopírováno</> : <><Copy size={14} /> Kopírovat odkaz</>}</button>
                                            <button type="button" onClick={() => void run(() => supabase.rpc('revoke_firm_invite', { p_invite: i.id }), 'Pozvánka byla zrušena.')} disabled={busy} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50" aria-label={`Zrušit pozvánku ${i.email}`}><Trash2 size={15} /></button>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
