'use client';

import DigestSettings from './DigestSettings';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { startComgatePayment } from '@/lib/payStart';
import { primaryBtn, ghostBtn, inputCls } from '../situation/caseUi';
import { intakeUrl, isValidIntakeCode, SECURITY_TEXT_LAWYER } from '@/lib/portal';
import { czk } from '@/lib/lawyer';
import { ROLE_LABELS } from '@/lib/firm';
import { PLANS, planName, type PlanId, type Prices } from '@/lib/plans';
import { useLawyer } from './LawyerGate';
import ProfileForm from './ProfileForm';
import GoogleCalendarCard from './GoogleCalendarCard';
import CalendarFeedCard from './CalendarFeedCard';
import MfaCard from './MfaCard';
import PortalBrandingCard from './PortalBrandingCard';
import FirmSettings from './FirmSettings';
import { useAuth } from '../site/AuthContext';

import AresPicker from './AresPicker';
import { formatIban, toIban } from '@/lib/qrPayment';

const STATUS: Record<string, string> = { trial: 'Zkušební přístup', active: 'Aktivní předplatné', requested: 'Čeká na potvrzení', expired: 'Vypršelo' };

export default function LawyerSettings() {
    const { access } = useLawyer();
    const { account } = useAuth();
    const [tab, setTab] = useState<'profil' | 'kancelar'>('profil');
    const [firmInfo, setFirmInfo] = useState<{ name: string; role: 'owner' | 'admin' | 'member' } | null>(null);
    useEffect(() => {
        let cancelled = false;
        supabase.rpc('firm_overview').then(({ data }) => { const f = (data as { firm?: { name: string; role: 'owner' | 'admin' | 'member' } } | null)?.firm; if (!cancelled && f) setFirmInfo({ name: f.name, role: f.role }); });
        return () => { cancelled = true; };
    }, []);
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
    const [firm, setFirm] = useState(access.firm_name);
    const [rate, setRate] = useState(String(access.default_rate || ''));
    const [msg, setMsg] = useState('');
    const [bill, setBill] = useState({ ico: access.ico ?? '', dic: access.dic ?? '', vat: !!access.vat_payer, bank: access.bank_account ?? '', due: String(access.due_days ?? 14), note: access.invoice_note ?? '' });
    const [billMsg, setBillMsg] = useState('');
    const complete = access.verification_status === 'verified';
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
        const pay = await startComgatePayment(String(data));
        if (pay.redirected) return;
        if (pay.error) { setPayMsg(pay.error); return; }
        if (paymentUrl) { window.open(`${paymentUrl}${paymentUrl.includes('?') ? '&' : '?'}order=${data}`, '_self'); return; }
        setPayMsg(`Objednávka ${String(data).slice(0, 8)} je vytvořena. Platební brána se připravuje, po jejím spuštění tu uvidíte tlačítko Zaplatit a přístup se po zaplacení aktivuje automaticky.`);
        const o = await supabase.from('lawyer_orders').select('id, plan, price_czk, status, period_end').order('created_at', { ascending: false }).limit(5);
        if (!o.error) setOrders((o.data ?? []) as typeof orders);
    }

    async function saveBilling() {
        const due = Number(bill.due);
        const { error } = await supabase.rpc('save_billing_settings', { p_ico: bill.ico, p_dic: bill.dic, p_vat: bill.vat, p_bank: bill.bank, p_due_days: Number.isFinite(due) ? Math.round(due) : 14, p_note: bill.note });
        setBillMsg(error ? (/function|schema cache/i.test(error.message) ? 'Fakturace zatím není v databázi zapnutá (chybí spuštění souboru fakturace.sql).' : error.message) : 'Uloženo. Údaje se použijí na nově vystavených vyúčtováních.');
    }

    async function saveCode() {
        const value = code.trim().toLowerCase();
        if (value && !isValidIntakeCode(value)) { setCodeMsg('Použijte 4 až 40 znaků: malá písmena bez diakritiky, číslice a pomlčky.'); return; }
        const { error } = await supabase.rpc('set_intake_code', { p_code: value });
        setCodeMsg(error ? (error.code === '23505' ? 'Tento název je obsazený, zkuste jiný.' : 'Uložení se nepovedlo. Zkontrolujte, že je spuštěné SQL client-portal.sql.') : value ? 'Odkaz je aktivní.' : 'Odkaz je vypnutý.');
    }

    const link = code.trim() && isValidIntakeCode(code.trim().toLowerCase()) && typeof window !== 'undefined' ? intakeUrl(window.location.origin, code.trim().toLowerCase()) : '';

    return (
        <div className="max-w-3xl space-y-5">
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Přihlášený uživatel">
                <div><p className="text-lg font-bold text-slate-900">{access.display_name || account?.email}</p><p className="text-sm text-slate-500">{firmInfo ? `${firmInfo.name} · ${ROLE_LABELS[firmInfo.role]}` : 'Bez kanceláře'}</p></div>
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="tablist" aria-label="Nastavení">
                    {([['profil', 'Můj profil'], ['kancelar', 'Kancelář']] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${tab === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}>{label}</button>)}
                </div>
            </section>
            {tab === 'kancelar' ? <FirmSettings /> : (<>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold text-slate-900">Údaje na dokladech</h2>
                <p className="mt-1 text-sm text-slate-600">Osobní nastavení: co se uvede na vašich vyúčtováních a klientské stránce a vaše výchozí sazba. Nastavení kanceláře je v záložce Kancelář.</p>
                <label className="mt-3 block text-sm font-semibold text-slate-700">Název kanceláře na dokladech
                    <input value={firm} onChange={(e) => setFirm(e.target.value)} maxLength={120} className={`${inputCls} mt-1 font-normal`} placeholder="např. Advokátní kancelář Novák" />
                </label>
                <label className="mt-3 block text-sm font-semibold text-slate-700">Výchozí hodinová sazba (Kč)
                    <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className={`${inputCls} mt-1 max-w-40 font-normal`} placeholder="např. 2000" />
                </label>
                <button type="button" onClick={() => void save()} className={`${primaryBtn} mt-4`}><Check size={16} /> Uložit</button>
                {msg && <p role="status" className="mt-2 text-sm text-slate-600">{msg}</p>}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Fakturační údaje">
                <h2 className="text-lg font-bold text-slate-900">Fakturační údaje</h2>
                <p className="mt-1 text-sm text-slate-600">Uvádějí se na vašich vyúčtováních a fakturách (spolu s jménem a adresou z profilu).</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2"><AresPicker compact onPick={(c) => setBill((b) => ({ ...b, ico: c.ico, dic: c.dic || b.dic }))} label="Doplnit IČO a DIČ z ARES" /></div>
                    <label className="block text-xs font-semibold text-slate-600">IČO<input value={bill.ico} onChange={(e) => setBill((b) => ({ ...b, ico: e.target.value }))} maxLength={20} className={`${inputCls} mt-1 font-normal`} /></label>
                    <label className="block text-xs font-semibold text-slate-600">DIČ<input value={bill.dic} onChange={(e) => setBill((b) => ({ ...b, dic: e.target.value }))} maxLength={20} className={`${inputCls} mt-1 font-normal`} placeholder="CZ…" /></label>
                    <label className="block text-xs font-semibold text-slate-600">Číslo účtu / IBAN<input value={bill.bank} onChange={(e) => setBill((b) => ({ ...b, bank: e.target.value }))} maxLength={60} className={`${inputCls} mt-1 font-normal`} placeholder="123456789/0100" />{bill.bank.trim() && <span className={`mt-1 block text-[11px] font-normal ${toIban(bill.bank) ? 'text-emerald-800' : 'text-rose-800'}`}>{toIban(bill.bank) ? `IBAN ${formatIban(toIban(bill.bank) ?? '')}: na fakturách bude QR platba.` : 'Neplatné číslo účtu, QR platba se nevytvoří. Zadejte např. 123456789/0100 nebo IBAN.'}</span>}</label>
                    <label className="block text-xs font-semibold text-slate-600">Výchozí splatnost (dny)<input value={bill.due} onChange={(e) => setBill((b) => ({ ...b, due: e.target.value }))} inputMode="numeric" className={`${inputCls} mt-1 max-w-32 font-normal`} /></label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:col-span-2"><input type="checkbox" checked={bill.vat} onChange={(e) => setBill((b) => ({ ...b, vat: e.target.checked }))} className="h-4 w-4 accent-indigo-700" /> Jsem plátce DPH</label>
                    <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">Text pod fakturou (nepovinné)<input value={bill.note} onChange={(e) => setBill((b) => ({ ...b, note: e.target.value }))} maxLength={500} className={`${inputCls} mt-1 font-normal`} placeholder="např. Zapsán v seznamu advokátů ČAK pod ev. č. 12345." /></label>
                </div>
                <button type="button" onClick={() => void saveBilling()} className={`${primaryBtn} mt-4`}><Check size={16} /> Uložit fakturační údaje</button>
                {billMsg && <p role="status" className="mt-2 text-sm text-slate-600">{billMsg}</p>}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Profil">
                <h2 className="text-lg font-bold text-slate-900">Váš profil</h2>
                <p className="mt-1 text-sm text-slate-600">Povinné údaje o vás. Vidí je provozovatel služby a klient na své stránce. Jakmile je uložíte, zapnou se klientské odkazy a poptávky.</p>
                <div className="mt-4"><ProfileForm access={access} onSaved={() => window.location.reload()} /></div>
            </section>
            <PortalBrandingCard />
            <MfaCard />
            <Link href="/kancelar/audit" className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm hover:border-indigo-300"><span><strong className="block text-base text-slate-900">Auditní záznam</strong><span className="text-slate-600">Kdo kdy co ve věcech otevřel nebo změnil, s exportem do CSV.</span></span><span className="font-semibold text-indigo-800">Otevřít →</span></Link>
            <GoogleCalendarCard />
            <CalendarFeedCard />
            <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Předplatné">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><CreditCard size={18} className="text-indigo-800" /> Předplatné</h2>
                <p className="mt-1 text-sm text-slate-700">{access.status === 'active' && access.until ? <>Aktivní do <strong>{new Date(`${access.until}T12:00:00`).toLocaleDateString('cs-CZ')}</strong>. Kancelář a klientské odkazy fungují po dobu předplatného.</> : access.status === 'trial' ? 'Máte zkušební přístup. Klientské odkazy fungují s vyplněným profilem a aktivním přístupem.' : 'Přístup momentálně není aktivní.'}</p>
                {!prices || (!prices.month && !prices.year) ? (
                    <p className="mt-3 text-sm text-slate-600">Ceny budou brzy zveřejněny.</p>
                ) : (
                    <>
                        <div className="mt-3 flex flex-wrap gap-3">
                            {PLANS.filter((pl) => prices[pl.id] > 0).map((pl, i) => <button key={pl.id} type="button" onClick={() => void buy(pl.id)} disabled={!complete} className={i === 0 ? primaryBtn : ghostBtn}>{pl.name} · {czk(prices[pl.id])}</button>)}
                        </div>
                        {!complete && <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-950">Předplatné si můžete koupit až po vyplnění profilu výše.</p>}
                    </>
                )}
                {payMsg && <p role="status" className="mt-3 text-sm text-slate-700">{payMsg}</p>}
                {orders.length > 0 && <ul className="mt-3 divide-y divide-slate-100 text-xs text-slate-600">{orders.map((o) => <li key={o.id} className="flex justify-between py-1.5"><span>{planName(o.plan)} · {czk(o.price_czk)}</span><span>{o.status === 'paid' ? `zaplaceno${o.period_end ? `, platí do ${new Date(`${o.period_end}T12:00:00`).toLocaleDateString('cs-CZ')}` : ''}` : o.status === 'pending' ? 'čeká na platbu' : o.status === 'refund_due' ? 'bude vráceno' : 'zrušeno'}</span></li>)}</ul>}
            </section>
            <DigestSettings />
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
            </>)}
        </div>
    );
}
