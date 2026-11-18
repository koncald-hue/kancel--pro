'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Clock3, Copy, Eye, FileText, Link2, ListTodo, Lock, Mail, MessageSquare, Paperclip, Phone, X } from 'lucide-react';
import DeadlineDialog, { type DeadlineTarget } from '../situation/DeadlineDialog';
import { supabase } from '@/lib/supabase';
import { createCase, BLANK_CASE, loadCases, type LegalCase } from '@/lib/cases';
import { applyDefaultTo } from '@/lib/templateApply';
import type { LawyerClient } from '@/lib/lawyer';
import { generateKey, wrapKey, linkWithKey, exportKey } from '@/lib/e2ee';
import { generateToken, portalUrl } from '@/lib/portal';
import { useMasterKey } from '@/lib/useE2ee';
import { formatSize, insertRow, safeFileName } from '@/lib/caseFile';
import { inputCls } from '../situation/caseUi';
import { ghostBtn, primaryBtn, shortDate } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

type Inquiry = { id: string; name: string; email: string; phone: string; message: string; status: 'new' | 'accepted' | 'declined'; created_at: string; case_id?: string | null };
type InquiryFile = { id: string; inquiry_id: string; name: string; path: string; size: number; mime: string };
type Invite = { caseId: string; url: string; secure: boolean };

// Další kroky po přijetí poptávky: podklady od klienta, úkol, čas. Vede do existujících funkcí věci.
function NextSteps({ caseId, onTask, taskCreated }: { caseId: string; onTask: () => void; taskCreated: boolean }) {
    return (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Další krok</p>
            <div className="mt-2 flex flex-wrap gap-2">
                <Link href={`/kancelar/veci/${caseId}?tab=klient&from=dnes`} className={ghostBtn}><Link2 size={15} /> Požádat klienta o podklady</Link>
                <button type="button" onClick={onTask} className={ghostBtn}><ListTodo size={15} /> {taskCreated ? 'Úkol vytvořen · další' : 'Vytvořit úkol nebo lhůtu'}</button>
                <Link href={`/kancelar/vykazy?case=${caseId}&popis=${encodeURIComponent('Posouzení poptávky')}`} className={ghostBtn}><Clock3 size={15} /> Zapsat čas</Link>
                <Link href={`/kancelar/veci/${caseId}?from=dnes`} className={ghostBtn}>Otevřít věc</Link>
            </div>
        </div>
    );
}

export default function LawyerInquiries() {
    const { userId } = useLawyer();
    const [items, setItems] = useState<Inquiry[]>([]);
    const [clients, setClients] = useState<LawyerClient[]>([]);
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [error, setError] = useState('');
    const [accepted, setAccepted] = useState<Record<string, Invite>>({});
    const [copied, setCopied] = useState('');
    // ?open=<id> (z přehledu Dnes) rovnou otevře poptávku
    const [openId, setOpenId] = useState<string | null>(() => { const v = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('open'); return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null; });
    const [target, setTarget] = useState('');
    const [task, setTask] = useState<DeadlineTarget | null>(null);
    const [taskDone, setTaskDone] = useState<Record<string, boolean>>({});
    const [files, setFiles] = useState<InquiryFile[]>([]);
    const master = useMasterKey();

    useEffect(() => {
        let cancelled = false;
        Promise.all([supabase.from('lawyer_inquiries').select('*').order('created_at', { ascending: false }), supabase.from('lawyer_clients').select('*'), loadCases(), supabase.from('inquiry_files').select('*')])
            .then(([i, c, all, f]) => { if (cancelled) return; if (!f.error) setFiles((f.data ?? []) as InquiryFile[]); if (i.error) throw new Error(i.error.message); setItems((i.data ?? []) as Inquiry[]); setClients((c.data ?? []) as LawyerClient[]); setCases(all); })
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
            void applyDefaultTo(created.id, userId); // výchozí šablona úkolů, pokud ji advokát má
            const { error: stErr } = await supabase.from('lawyer_inquiries').update({ status: 'accepted' }).eq('id', q.id);
            if (stErr) throw new Error(stErr.message);
            await supabase.from('lawyer_inquiries').update({ case_id: created.id }).eq('id', q.id); // vyžaduje poptavky-propojeni.sql
            setItems((list) => list.map((x) => (x.id === q.id ? { ...x, status: 'accepted', case_id: created.id } : x)));
            await moveFiles(q, created.id);
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

    // Přílohy poptávky se do spisu přenesou až po přijetí (nebo přiřazení k věci)
    async function moveFiles(q: Inquiry, caseId: string) {
        const mine = files.filter((f) => f.inquiry_id === q.id);
        const failed: string[] = [];
        for (const f of mine) {
            try {
                const { data: blob, error: dl } = await supabase.storage.from('inquiry-files').download(f.path);
                if (dl || !blob) throw new Error(dl?.message ?? 'download');
                const path = `${userId}/${caseId}/${crypto.randomUUID()}-${safeFileName(f.name)}`;
                const up = await supabase.storage.from('case-files').upload(path, blob, { contentType: f.mime || undefined });
                if (up.error) throw new Error(up.error.message);
                try { await insertRow('case_files', { case_id: caseId, user_id: userId, name: f.name, path, size: f.size, mime: f.mime, source: 'client', client_visible: false }); }
                catch (e) { await supabase.storage.from('case-files').remove([path]); throw e; }
                await supabase.from('inquiry_files').delete().eq('id', f.id);
                await supabase.storage.from('inquiry-files').remove([f.path]);
            } catch { failed.push(f.name); }
        }
        setFiles((list) => list.filter((f) => f.inquiry_id !== q.id || failed.includes(f.name)));
        if (failed.length) setError(`Do spisu se nepodařilo přenést: ${failed.join(', ')}. Zůstaly v poptávce, zkuste je stáhnout a nahrát ručně.`);
    }

    // Přiřazení k věci, kterou už v kanceláři vedete (např. další dotaz stávajícího klienta)
    async function assign(q: Inquiry, caseId: string) {
        setError('');
        const c = cases.find((x) => x.id === caseId);
        if (!c) return;
        const { error: e1 } = await supabase.from('lawyer_inquiries').update({ status: 'accepted', case_id: caseId }).eq('id', q.id);
        if (e1) { setError(`Poptávku se nepodařilo přiřadit: ${e1.message}`); return; }
        setItems((list) => list.map((x) => (x.id === q.id ? { ...x, status: 'accepted', case_id: caseId } : x)));
        // Text poptávky se uloží do chronologie věci, aby nezůstal jen v poptávkách
        try { await insertRow('case_entries', { case_id: caseId, user_id: userId, kind: 'note', title: `Poptávka: ${q.name}`.slice(0, 200), body: [q.message, [q.email, q.phone].filter(Boolean).join(', ')].filter(Boolean).join('\n\n').slice(0, 5000), happened_on: q.created_at.slice(0, 10) }); } catch { /* chronologie není kritická */ }
        await moveFiles(q, caseId);
        setTarget('');
    }

    const inviteText = (q: Inquiry, url: string) => `Dobrý den, ${q.name},\n\nděkuji za vaši poptávku. Věc jsem převzal(a). Na tomto zabezpečeném odkazu mi můžete psát, posílat dokumenty a uvidíte stav věci:\n\n${url}\n\nOdkaz je osobní, nikomu ho prosím nepředávejte.`;
    async function copy(id: string, text: string) { await navigator.clipboard?.writeText(text); setCopied(id); window.setTimeout(() => setCopied(''), 1500); }

    async function preview(f: InquiryFile) {
        const { data, error: err } = await supabase.storage.from('inquiry-files').createSignedUrl(f.path, 120);
        if (err || !data) { setError('Soubor se nepodařilo otevřít.'); return; }
        window.open(data.signedUrl, '_blank', 'noopener');
    }

    async function decline(q: Inquiry) {
        const { error: err } = await supabase.from('lawyer_inquiries').update({ status: 'declined' }).eq('id', q.id);
        if (err) { setError(err.message); return; }
        // Odmítnuté poptávce se přílohy mažou, aby u kanceláře nezůstávaly cizí dokumenty
        const mine = files.filter((f) => f.inquiry_id === q.id);
        if (mine.length) { await supabase.storage.from('inquiry-files').remove(mine.map((f) => f.path)); await supabase.from('inquiry_files').delete().eq('inquiry_id', q.id); setFiles((l) => l.filter((f) => f.inquiry_id !== q.id)); }
        setItems((list) => list.map((x) => (x.id === q.id ? { ...x, status: 'declined' } : x)));
    }

    const opened = items.find((i) => i.id === openId) ?? null;
    const fresh = items.filter((i) => i.status === 'new');
    const rest = items.filter((i) => i.status !== 'new');

    return (
        <div className="space-y-5">
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            {items.length === 0 && !error && <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-600">Zatím žádné poptávky. Odkaz pro zájemce najdete v Nastavení, můžete ho vložit na web nebo do podpisu e-mailu.</p>}
            {fresh.length > 0 && <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Nové ({fresh.length})</h2>}
            <ul className="space-y-2">
                {fresh.map((q) => {
                    const n = files.filter((f) => f.inquiry_id === q.id).length;
                    return (
                        <li key={q.id}>
                            <button type="button" onClick={() => setOpenId(q.id)} className="flex w-full items-start gap-3 rounded-2xl border border-indigo-200 bg-white p-4 text-left hover:bg-indigo-50/40 cursor-pointer">
                                <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold text-slate-900">{q.name}</span><span className="text-xs text-slate-500">{shortDate(new Date(q.created_at))}</span></span>
                                    <span className="mt-1 line-clamp-2 block text-sm text-slate-600">{q.message}</span>
                                    <span className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                        {n > 0 && <span className="inline-flex items-center gap-1"><Paperclip size={12} /> {n} {n === 1 ? 'příloha' : n < 5 ? 'přílohy' : 'příloh'}</span>}
                                        {conflicts(q).length > 0 && <span className="inline-flex items-center gap-1 font-semibold text-rose-800"><AlertTriangle size={12} /> možný střet zájmů</span>}
                                        <span className="ml-auto font-semibold text-indigo-900">Zobrazit a rozhodnout →</span>
                                    </span>
                                </span>
                            </button>
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
                        <NextSteps caseId={inv.caseId} taskCreated={!!taskDone[id]} onTask={() => setTask({ caseId: inv.caseId, caseTitle: q.name, title: `Vyřídit: ${q.name}`, inquiryId: q.id, kind: 'ukol' })} />
                        <p className="mt-2 text-[11px] text-slate-500">Odkaz zůstává i ve věci v záložce Klient. Tady se ukazuje jen teď, protože klíč se po opuštění stránky už nezobrazí.</p>
                    </section>
                );
            })}
            {rest.length > 0 && (
                <div>
                    <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Vyřízené</h2>
                    <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                        {rest.map((q) => <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><button type="button" onClick={() => setOpenId(q.id)} className="font-semibold text-slate-800 hover:underline cursor-pointer">{q.name}</button><span className="text-xs text-slate-500">{q.status === 'accepted' ? <>přijato{(q.case_id ?? accepted[q.id]?.caseId) && <> · <Link href={`/kancelar/veci/${q.case_id ?? accepted[q.id]?.caseId}`} className="font-semibold text-indigo-900 underline">otevřít věc</Link></>}</> : 'odmítnuto'} · {shortDate(new Date(q.created_at))}</span></li>)}
                    </ul>
                </div>
            )}
            {task && <DeadlineDialog target={task} userId={userId} onClose={() => setTask(null)} onSaved={() => { if (task.inquiryId) setTaskDone((t) => ({ ...t, [task.inquiryId!]: true })); setTask(null); }} />}
            {opened && (
                <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center" onClick={() => setOpenId(null)}>
                    <div role="dialog" aria-modal="true" aria-label={`Poptávka: ${opened.name}`} onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
                        <div className="flex items-start justify-between gap-3">
                            <div><p className="text-xs font-bold uppercase tracking-wide text-indigo-800">{opened.status === 'new' ? 'Nová poptávka' : opened.status === 'accepted' ? 'Přijatá poptávka' : 'Odmítnutá poptávka'}</p><h2 className="text-xl font-bold text-slate-900">{opened.name}</h2><p className="text-xs text-slate-500">{shortDate(new Date(opened.created_at))}</p></div>
                            <button type="button" onClick={() => setOpenId(null)} aria-label="Zavřít" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"><X size={18} /></button>
                        </div>
                        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-indigo-900">{opened.email && <a href={`mailto:${opened.email}`} className="inline-flex items-center gap-1.5 hover:underline"><Mail size={14} />{opened.email}</a>}{opened.phone && <a href={`tel:${opened.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone size={14} />{opened.phone}</a>}</p>
                        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Popis věci</p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-800">{opened.message}</p>
                        {files.some((f) => f.inquiry_id === opened.id) && (
                            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Přiložené dokumenty {opened.status === 'new' && '(do spisu až po přijetí)'}</p>
                                <ul className="mt-2 space-y-1.5">{files.filter((f) => f.inquiry_id === opened.id).map((f) => <li key={f.id} className="flex items-center gap-2 text-sm text-slate-800"><FileText size={14} className="shrink-0 text-slate-400" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{f.name}<span className="ml-1.5 text-xs text-slate-500">{formatSize(f.size)}</span></span><button type="button" onClick={() => void preview(f)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-800 hover:bg-white cursor-pointer"><Eye size={12} /> Náhled</button></li>)}</ul>
                            </div>
                        )}
                        {conflicts(opened).length > 0 && <p className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-900"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Možný střet zájmů nebo stávající klient: {conflicts(opened).join(', ')}.</p>}
                        {opened.status === 'new' && <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => { setOpenId(null); void accept(opened); }} className={primaryBtn}><Check size={16} /> Přijmout jako věc</button><button type="button" onClick={() => { setOpenId(null); void decline(opened); }} className={ghostBtn}><X size={15} /> Odmítnout</button></div>}
                        {opened.status === 'accepted' && (opened.case_id ?? accepted[opened.id]?.caseId) && <NextSteps caseId={(opened.case_id ?? accepted[opened.id]?.caseId)!} taskCreated={!!taskDone[opened.id]} onTask={() => setTask({ caseId: (opened.case_id ?? accepted[opened.id]?.caseId)!, caseTitle: opened.name, title: `Vyřídit: ${opened.name}`, inquiryId: opened.id, kind: 'ukol' })} />}
                        {(opened.status === 'new' || (opened.status === 'accepted' && !(opened.case_id ?? accepted[opened.id]?.caseId))) && cases.some((c) => c.status === 'open') && (
                            <form onSubmit={(e) => { e.preventDefault(); if (target) { void assign(opened, target); } }} className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <label className="min-w-0 flex-1 text-sm font-semibold text-slate-800">{opened.status === 'new' ? 'Nebo přiřadit k věci, kterou už vedete' : 'Přiřadit k věci'}
                                    <select value={target} onChange={(e) => setTarget(e.target.value)} className={`${inputCls} mt-1`}>
                                        <option value="">Vyberte věc…</option>
                                        {cases.filter((c) => c.status === 'open').map((c) => <option key={c.id} value={c.id}>{c.title}{c.client_name ? ` · ${c.client_name}` : ''}</option>)}
                                    </select>
                                </label>
                                <button type="submit" disabled={!target} className={ghostBtn}>Přiřadit</button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
