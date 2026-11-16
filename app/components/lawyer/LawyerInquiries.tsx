'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Copy, Lock, Mail, MessageSquare, Phone, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { createCase, BLANK_CASE, loadCases, type LegalCase } from '@/lib/cases';
import type { LawyerClient } from '@/lib/lawyer';
import { generateKey, wrapKey, linkWithKey, exportKey } from '@/lib/e2ee';
import { generateToken, portalUrl } from '@/lib/portal';
import { useMasterKey } from '@/lib/useE2ee';
import { ghostBtn, primaryBtn, shortDate } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

type Inquiry = { id: string; name: string; email: string; phone: string; message: string; status: 'new' | 'accepted' | 'declined'; created_at: string; case_id?: string | null };
type Invite = { caseId: string; url: string; secure: boolean };

export default function LawyerInquiries() {
    const { userId } = useLawyer();
    const [items, setItems] = useState<Inquiry[]>([]);
    const [clients, setClients] = useState<LawyerClient[]>([]);
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [error, setError] = useState('');
    const [accepted, setAccepted] = useState<Record<string, Invite>>({});
    const [copied, setCopied] = useState('');
    const master = useMasterKey();

    useEffect(() => {
        let cancelled = false;
        Promise.all([supabase.from('lawyer_inquiries').select('*').order('created_at', { ascending: false }), supabase.from('lawyer_clients').select('*'), loadCases()])
            .then(([i, c, all]) => { if (cancelled) return; if (i.error) throw new Error(i.error.message); setItems((i.data ?? []) as Inquiry[]); setClients((c.data ?? []) as LawyerClient[]); setCases(all); })
            .catch(() => { if (!cancelled) setError('Poptávky se nepodařilo načíst. Zkontrolujte, že je spuštěné SQL client-portal.sql.'); });
        return () => { cancelled = true; };
    }, []);

    // Střet zájmů: stejný klient nebo e-mail už v kanceláři existuje
    const conflicts = (q: Inquiry) => [
        ...clients.filter((c) => c.name.toLowerCase() === q.name.toLowerCase() || (q.email && c.email.toLowerCase() === q.email.toLowerCase())).map((c) => `klient ${c.name}`),
        ...cases.filter((c) => (c.client_name ?? '').toLowerCase() === q.name.toLowerCase()).map((c) => `věc „${c.title}“`),
    ];

    // Přijetí: věc se založí rovnou s kontaktem klienta (klient se najde nebo založí a doplní se mu e-mail a telefon),
    // původní zpráva zájemce je popis věci a vznikne zabezpečený odkaz, přes který si s klientem můžete psát a posílat dokumenty.
    async function accept(q: Inquiry) {
        setError('');
        try {
            const created = await createCase(userId, { ...BLANK_CASE, title: `Věc: ${q.name}`, situation: q.message });
            const { error: caseErr } = await supabase.from('cases').update({ client_name: q.name, client_email: q.email, client_phone: q.phone }).eq('id', created.id);
            if (caseErr) throw new Error(caseErr.message);
            const { error: stErr } = await supabase.from('lawyer_inquiries').update({ status: 'accepted' }).eq('id', q.id);
            if (stErr) throw new Error(stErr.message);
            await supabase.from('lawyer_inquiries').update({ case_id: created.id }).eq('id', q.id); // vyžaduje poptavky-propojeni.sql
            setItems((list) => list.map((x) => (x.id === q.id ? { ...x, status: 'accepted', case_id: created.id } : x)));
            const { data: fresh } = await supabase.from('lawyer_clients').select('*');
            if (fresh) setClients(fresh as LawyerClient[]);

            // Zabezpečený odkaz pro klienta; šifrovaný je jen s odemčeným šifrovacím heslem
            const k = master ? await generateKey() : null;
            const token = generateToken();
            const exp = new Date(); exp.setDate(exp.getDate() + 90);
            const { error: linkErr } = await supabase.from('client_links').insert({ case_id: created.id, user_id: userId, token, label: created.title, expires_at: exp.toISOString(), e2ee: !!k, wrapped_key: k && master ? await wrapKey(master, k) : null });
            if (linkErr) return;
            const base = portalUrl(window.location.origin, token);
            const url = k ? linkWithKey(base, await exportKey(k)) : base;
            setAccepted((a) => ({ ...a, [q.id]: { caseId: created.id, url, secure: !!k } }));
        } catch (err) { setError(err instanceof Error ? `Poptávku se nepodařilo přijmout: ${err.message}` : 'Poptávku se nepodařilo přijmout.'); }
    }

    const inviteText = (q: Inquiry, url: string) => `Dobrý den, ${q.name},\n\nděkuji za vaši poptávku. Věc jsem převzal(a). Na tomto zabezpečeném odkazu mi můžete psát, posílat dokumenty a uvidíte stav věci:\n\n${url}\n\nOdkaz je osobní, nikomu ho prosím nepředávejte.`;
    async function copy(id: string, text: string) { await navigator.clipboard?.writeText(text); setCopied(id); window.setTimeout(() => setCopied(''), 1500); }

    async function decline(q: Inquiry) {
        const { error: err } = await supabase.from('lawyer_inquiries').update({ status: 'declined' }).eq('id', q.id);
        if (err) setError(err.message); else setItems((list) => list.map((x) => (x.id === q.id ? { ...x, status: 'declined' } : x)));
    }

    const fresh = items.filter((i) => i.status === 'new');
    const rest = items.filter((i) => i.status !== 'new');

    return (
        <div className="space-y-5">
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            {items.length === 0 && !error && <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-600">Zatím žádné poptávky. Odkaz pro zájemce najdete v Nastavení, můžete ho vložit na web nebo do podpisu e-mailu.</p>}
            <ul className="space-y-3">
                {fresh.map((q) => {
                    const clash = conflicts(q);
                    return (
                        <li key={q.id} className="rounded-2xl border border-indigo-200 bg-white p-5">
                            <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-lg font-bold text-slate-900">{q.name}</p><span className="text-xs text-slate-500">{shortDate(new Date(q.created_at))}</span></div>
                            <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-indigo-900">{q.email && <a href={`mailto:${q.email}`} className="inline-flex items-center gap-1.5 hover:underline"><Mail size={14} />{q.email}</a>}{q.phone && <a href={`tel:${q.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone size={14} />{q.phone}</a>}</p>
                            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{q.message}</p>
                            {clash.length > 0 && <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-900"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Možný střet zájmů nebo stávající klient: {clash.join(', ')}.</p>}
                            <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void accept(q)} className={primaryBtn}><Check size={16} /> Přijmout jako věc</button><button type="button" onClick={() => void decline(q)} className={ghostBtn}><X size={15} /> Odmítnout</button></div>
                        </li>
                    );
                })}
            </ul>
            {Object.entries(accepted).map(([id, inv]) => {
                const q = items.find((x) => x.id === id);
                if (!q) return null;
                return (
                    <section key={id} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5" aria-label={`Přijato: ${q.name}`}>
                        <p className="flex items-center gap-2 font-bold text-emerald-900"><Check size={16} /> Věc „{q.name}“ je založená</p>
                        <p className="mt-1 text-sm text-slate-700">Klient i jeho kontakt ({[q.phone, q.email].filter(Boolean).join(', ')}) jsou uložené u věci a v seznamu klientů, původní zpráva zájemce je v popisu věci.</p>
                        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><MessageSquare size={15} /> Zabezpečený chat a dokumenty s klientem</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">Pošlete klientovi tento odkaz. Otevře si svou stránku věci, kde vám může psát a nahrávat dokumenty. {inv.secure ? <><Lock size={11} className="mb-0.5 inline" /> Zprávy a soubory jsou šifrované end-to-end, klíč je součástí odkazu.</> : 'Odemkněte šifrovací heslo (Nastavení) a odkaz si ve věci vytvořte znovu, ať jsou zprávy šifrované end-to-end.'}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => void copy(id, inviteText(q, inv.url))} className={primaryBtn}><Copy size={15} /> {copied === id ? 'Zkopírováno' : 'Zkopírovat zprávu s odkazem'}</button>
                            {q.email && <a href={`mailto:${q.email}?subject=${encodeURIComponent('Vaše věc – zabezpečený odkaz')}&body=${encodeURIComponent(inviteText(q, inv.url))}`} className={ghostBtn}><Mail size={15} /> Otevřít e-mail</a>}
                            <Link href={`/kancelar/veci/${inv.caseId}`} className={ghostBtn}>Otevřít věc</Link>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">Odkaz zůstává i ve věci v záložce Klient. Tady se ukazuje jen teď, protože klíč se po opuštění stránky už nezobrazí.</p>
                    </section>
                );
            })}
            {rest.length > 0 && (
                <div>
                    <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Vyřízené</h2>
                    <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                        {rest.map((q) => <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><span className="font-semibold text-slate-800">{q.name}</span><span className="text-xs text-slate-500">{q.status === 'accepted' ? <>přijato{(q.case_id ?? accepted[q.id]?.caseId) && <> · <Link href={`/kancelar/veci/${q.case_id ?? accepted[q.id]?.caseId}`} className="font-semibold text-indigo-900 underline">otevřít věc</Link></>}</> : 'odmítnuto'} · {shortDate(new Date(q.created_at))}</span></li>)}
                    </ul>
                </div>
            )}
        </div>
    );
}
