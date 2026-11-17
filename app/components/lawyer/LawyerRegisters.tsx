'use client';

import { useEffect, useState } from 'react';
import { Building2, Check, ChevronDown, ExternalLink, Loader2, Scale, UserPlus, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadCases, type LegalCase } from '@/lib/cases';
import type { AresCompany } from '@/lib/ares';
import { FORMS, aresUrl, dmy, orUrl, type RegisterRzp, type RegisterVr } from '@/lib/registers';
import { ghostBtn, inputCls } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';
import AresPicker from './AresPicker';

type Detail = { company: AresCompany | null; form: string; formName?: string; founded: string; vr: RegisterVr | null; rzp: RegisterRzp | null };
const czk = (n: number) => `${Math.round(n).toLocaleString('cs-CZ')} Kč`;

function Card({ title, icon: Icon, children, link }: { title: string; icon: typeof Scale; children: React.ReactNode; link?: { href: string; label: string } }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Icon size={18} className="text-indigo-700" aria-hidden="true" /> {title}</h2>{link && <a href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-800 hover:underline">{link.label} <ExternalLink size={12} aria-hidden="true" /></a>}</div>
            <div className="mt-3">{children}</div>
        </section>
    );
}
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => v ? <div className="flex flex-wrap gap-x-3 py-1.5 text-sm"><dt className="w-40 shrink-0 text-slate-500">{k}</dt><dd className="min-w-0 flex-1 text-slate-900">{v}</dd></div> : null;

// Obchodní a živnostenský rejstřík: vyhledání subjektu a přehled jeho aktuálního stavu z ARES
export default function LawyerRegisters() {
    const { userId } = useLawyer();
    const [pick, setPick] = useState<AresCompany | null>(null);
    const [detail, setDetail] = useState<Detail | null | undefined>(undefined);
    const [error, setError] = useState('');
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [caseId, setCaseId] = useState('');
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState('');
    useEffect(() => { let alive = true; loadCases().then((c) => { if (alive) setCases(c); }).catch(() => undefined); return () => { alive = false; }; }, []);

    async function open(c: AresCompany) {
        setPick(c); setDetail(undefined); setError(''); setMsg('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`/api/rejstriky?ico=${encodeURIComponent(c.ico)}`, { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } });
            if (res.status === 429) throw new Error('Příliš mnoho dotazů, zkuste to za chvíli.');
            if (!res.ok) throw new Error('Rejstříky teď neodpovídají. Zkuste to za chvíli znovu.');
            setDetail(await res.json() as Detail);
        } catch (e) { setError(e instanceof Error ? e.message : 'Načtení se nepovedlo.'); setDetail(null); }
    }
    async function addClient() {
        if (!pick) return; setBusy('client'); setMsg('');
        const { error: e } = await supabase.from('lawyer_clients').insert({ user_id: userId, name: pick.name.slice(0, 200), ico: pick.ico, dic: pick.dic ?? '', address: pick.address ?? '' });
        setMsg(e ? (e.code === '23505' ? 'Klient s tímto názvem už v adresáři je.' : e.message) : `„${pick.name}“ je přidaný mezi klienty.`); setBusy('');
    }
    async function addContact() {
        if (!pick || !caseId) return; setBusy('contact'); setMsg('');
        const { error: e } = await supabase.from('case_contacts').insert({ case_id: caseId, user_id: userId, role: 'Protistrana', name: pick.name.slice(0, 200), email: '', phone: '', note: `IČO ${pick.ico}${pick.address ? `, ${pick.address}` : ''}`.slice(0, 500) });
        setMsg(e ? e.message : `Uloženo jako kontakt do věci „${cases.find((c) => c.id === caseId)?.title ?? ''}“.`); setBusy('');
    }

    const co = detail?.company; const vr = detail?.vr; const rzp = detail?.rzp;
    return (
        <div className="max-w-5xl space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold text-slate-900">Obchodní a živnostenský rejstřík</h2>
                <p className="mt-1 text-sm text-slate-600">Zadejte IČO nebo název firmy či podnikatele. Uvidíte, kdo ji zastupuje, kdo jsou společníci, kolik je základní kapitál, kde sídlí a jaké má živnosti. Údaje jsou z veřejného rejstříku ARES (Ministerstvo financí) a nenahrazují úřední výpis.</p>
                <div className="mt-4"><AresPicker compact onPick={(c) => void open(c)} label="IČO nebo název" /></div>
            </section>

            {pick && detail === undefined && <p className="flex items-center gap-2 text-sm text-slate-500" role="status"><Loader2 size={15} className="animate-spin" /> Načítám údaje o „{pick.name}“…</p>}
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}

            {pick && detail && (
                <>
                    <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0"><h2 className="text-xl font-bold text-slate-900">{co?.name ?? pick.name}</h2><p className="mt-0.5 text-sm text-slate-600">IČO {pick.ico}{co?.dic ? ` · DIČ ${co.dic}` : ''}{co?.ended ? ` · zaniklý ${dmy(co.ended)}` : vr?.state === 'AKTIVNI' ? ' · aktivní' : ''}</p></div>
                            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void addClient()} disabled={busy === 'client'} className={ghostBtn}><UserPlus size={14} /> Přidat mezi klienty</button></div>
                        </div>
                        <dl className="mt-3 divide-y divide-slate-100/80">
                            <Row k="Sídlo" v={co?.address ?? pick.address} />
                            <Row k="Právní forma" v={detail.formName || (detail.form ? FORMS[detail.form] ?? `kód ${detail.form}` : '')} />
                            <Row k="Vznik" v={dmy(detail.founded || vr?.founded || '')} />
                        </dl>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <select value={caseId} onChange={(e) => setCaseId(e.target.value)} aria-label="Věc" className={`${inputCls} w-auto max-w-xs`}><option value="">Uložit jako kontakt do věci…</option>{cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
                            <button type="button" onClick={() => void addContact()} disabled={!caseId || busy === 'contact'} className={ghostBtn}><Check size={14} /> Uložit</button>
                        </div>
                        {msg && <p role="status" className="mt-2 text-sm text-emerald-800">{msg}</p>}
                    </section>

                    <Card title="Obchodní rejstřík" icon={Scale} link={{ href: orUrl(pick.ico), label: 'Úřední výpis' }}>
                        {!vr ? <p className="text-sm text-slate-500">Subjekt není zapsán v obchodním rejstříku (typicky živnostník nebo jiná osoba).</p> : (
                            <div className="space-y-5">
                                <dl className="divide-y divide-slate-100"><Row k="Spisová značka" v={vr.court} /><Row k="Zapsáno" v={dmy(vr.founded)} />{vr.capital && <Row k="Základní kapitál" v={`${vr.capital.amount !== null ? czk(vr.capital.amount) : ''}${vr.capital.paid ? ` (splaceno ${vr.capital.paid})` : ''}`} />}</dl>
                                {vr.organs.map((o) => (
                                    <div key={o.name}>
                                        <h3 className="text-sm font-bold text-slate-900">{o.name}</h3>
                                        {o.rules && <p className="mt-1 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700"><span className="font-semibold">Jedná: </span>{o.rules}</p>}
                                        <ul className="mt-2 divide-y divide-slate-100">{o.members.map((m, i) => <li key={`${m.name}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5 text-sm"><span className="font-semibold text-slate-900">{m.name}</span><span className="text-slate-500">{m.role}{m.since ? ` od ${dmy(m.since)}` : ''}</span></li>)}</ul>
                                    </div>
                                ))}
                                {vr.partners.length > 0 && <div><h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><Users size={14} aria-hidden="true" /> Společníci</h3><ul className="mt-2 divide-y divide-slate-100">{vr.partners.map((p, i) => <li key={`${p.name}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5 text-sm"><span className="font-semibold text-slate-900">{p.name}</span><span className="text-slate-500">{p.share}</span></li>)}</ul></div>}
                                {vr.shareholders.length > 0 && <div><h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><Users size={14} aria-hidden="true" /> Akcionáři zapsaní v rejstříku</h3><p className="mt-1 text-sm text-slate-700">{vr.shareholders.slice(0, 15).join(', ')}{vr.shareholders.length > 15 ? ` a dalších ${vr.shareholders.length - 15}` : ''}</p></div>}
                                {vr.activities.length > 0 && <details className="rounded-xl bg-slate-50 p-3"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-slate-900">Předmět podnikání nebo činnosti ({vr.activities.length})<ChevronDown size={16} className="text-slate-400" aria-hidden="true" /></summary><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{vr.activities.map((a, i) => <li key={i}>{a}</li>)}</ul></details>}
                                <p className="text-xs text-slate-400">Stav k {dmy(vr.updated)}. Zobrazuje se jen aktuální stav, historie a soukromé adresy osob jsou vynechány.</p>
                            </div>
                        )}
                    </Card>

                    <Card title="Živnostenský rejstřík" icon={Building2} link={{ href: aresUrl(pick.ico), label: 'Detail v ARES' }}>
                        {!rzp ? <p className="text-sm text-slate-500">Subjekt nemá záznam v živnostenském rejstříku.</p> : (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-700"><strong>{rzp.active}</strong> platných živností{rzp.ended ? `, ${rzp.ended} zaniklých` : ''}{rzp.suspended ? `, ${rzp.suspended} pozastavených` : ''}{rzp.offices !== null ? ` · provozoven: ${rzp.offices}` : ''}</p>
                                <p className="text-xs text-slate-500">Data přebíráme z ARES beze změny{rzp.updated ? `, záznam živnostenského rejstříku naposledy aktualizován ${dmy(rzp.updated)}` : ''}. Pokud datum nesedí, rozhoduje veřejná část Živnostenského rejstříku (rzp.gov.cz), kam vede odkaz Detail v ARES.</p>
                                <ul className="space-y-2">
                                    {rzp.trades.filter((t) => !t.ended).map((t, i) => (
                                        <li key={`${t.name}-${i}`} className="rounded-xl border border-slate-200 p-3 text-sm">
                                            <p className="font-semibold text-slate-900">{t.name}</p>
                                            <p className="mt-0.5 text-xs text-slate-500">{t.type ? `${t.type} živnost · ` : ''}oprávnění od {dmy(t.since)}{t.reps.length ? ` · odpovědný zástupce: ${t.reps.join(', ')}` : ''}</p>
                                            {t.fields.length > 0 && <details className="mt-1.5"><summary className="cursor-pointer text-xs font-semibold text-indigo-800">Obory činnosti ({t.fields.length})</summary><ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-slate-600">{t.fields.map((f, k) => <li key={k}>{f}</li>)}</ul></details>}
                                        </li>
                                    ))}
                                </ul>
                                {rzp.trades.some((t) => t.ended) && <details className="rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Zaniklé živnosti ({rzp.trades.filter((t) => t.ended).length})</summary><ul className="mt-2 space-y-1 text-xs text-slate-600">{rzp.trades.filter((t) => t.ended).map((t, i) => <li key={`${t.name}-${i}`}>{t.name} <span className="text-slate-400">({dmy(t.since)} až {dmy(t.ended)})</span></li>)}</ul></details>}
                            </div>
                        )}
                    </Card>
                </>
            )}
        </div>
    );
}
