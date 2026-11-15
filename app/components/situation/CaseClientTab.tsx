'use client';

import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Check, Copy, Eye, EyeOff, Link2, Lock, Mail, Paperclip, Phone, Plus, Send, Trash2, UserCheck, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { deleteRow, formatSize, insertRow, safeFileName, updateRow, type CaseFile } from '@/lib/caseFile';
import { SECURITY_TEXT_LAWYER, STATUS_TEMPLATES, generateToken, isAllowedUpload, isLinkActive, portalUrl } from '@/lib/portal';
import { decryptText, encryptFile, encryptText, exportKey, generateKey, isEncrypted, linkWithKey, unwrapKey, wrapKey } from '@/lib/e2ee';
import { useMasterKey } from '@/lib/useE2ee';
import type { LawyerAccess } from '@/lib/lawyer';
import E2eeBox from './E2eeBox';
import { ghostBtn, inputCls, primaryBtn, shortDate, type TabProps } from './caseUi';

type Link = { id: string; token: string; label: string; status_text: string; expires_at: string | null; revoked: boolean; opens: number; last_opened_at: string | null; client_name?: string; client_email?: string; client_phone?: string; client_address?: string; consent_at?: string | null; onboarded_at?: string | null; e2ee?: boolean; wrapped_key?: string | null; client_verified_at?: string | null };
type Request = { id: string; title: string; done: boolean };
type Message = { id: string; from_client: boolean; body: string; read: boolean; created_at: string };

const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); };

// Klientská stránka věci: odkaz, šifrování, identita klienta, stav, podklady, viditelnost a zprávy
export default function CaseClientTab({ item, bundle, userId, setBundle, fail, verified, access, refreshAccess }: TabProps & { verified: boolean; access: LawyerAccess | null; refreshAccess: () => void }) {
    const master = useMasterKey();
    const [link, setLink] = useState<Link | null>(null);
    const [requests, setRequests] = useState<Request[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [ready, setReady] = useState(false);
    const [enabled, setEnabled] = useState(true);
    const [status, setStatus] = useState('');
    const [newRequest, setNewRequest] = useState('');
    const [reply, setReply] = useState('');
    const [copied, setCopied] = useState(false);
    const [linkKey, setLinkKey] = useState<{ wrapped: string; key: CryptoKey; b64: string } | null>(null);
    const [plainAll, setPlain] = useState<Record<string, string>>({});
    const [namesAll, setNames] = useState<Record<string, string>>({});
    const [sending, setSending] = useState(false);
    const picker = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [l, r, m] = await Promise.all([
                supabase.from('client_links').select('*').eq('case_id', item.id).order('created_at', { ascending: false }).limit(1),
                supabase.from('client_requests').select('*').eq('case_id', item.id).order('created_at'),
                supabase.from('client_messages').select('*').eq('case_id', item.id).order('created_at'),
            ]);
            if (cancelled) return;
            if (l.error || r.error || m.error) { setEnabled(false); setReady(true); return; }
            const current = ((l.data ?? [])[0] as Link | undefined) ?? null;
            setLink(current);
            setStatus(current?.status_text ?? '');
            setRequests((r.data ?? []) as Request[]);
            setMessages((m.data ?? []) as Message[]);
            setReady(true);
            await supabase.from('client_messages').update({ read: true }).eq('case_id', item.id).eq('from_client', true).eq('read', false);
        })().catch(() => { if (!cancelled) { setEnabled(false); setReady(true); } });
        return () => { cancelled = true; };
    }, [item.id]);

    // Klíč odkazu: odemkne se hlavním klíčem advokáta
    const wrapped = link?.e2ee ? link.wrapped_key ?? null : null;
    useEffect(() => {
        if (!master || !wrapped) return;
        let cancelled = false;
        (async () => {
            const key = await unwrapKey(master, wrapped);
            const b64 = await exportKey(key);
            if (!cancelled) setLinkKey({ wrapped, key, b64 });
        })().catch(() => { if (!cancelled) setLinkKey(null); });
        return () => { cancelled = true; };
    }, [master, wrapped]);
    const key = linkKey && linkKey.wrapped === wrapped && master ? linkKey : null;
    // Po zamknutí šifrování se dešifrovaný text hned přestane zobrazovat
    const plain = key ? plainAll : {};
    const names = key ? namesAll : {};

    // Dešifrování zpráv a názvů souborů pro zobrazení
    useEffect(() => {
        if (!key) return;
        let cancelled = false;
        (async () => {
            const out: Record<string, string> = {};
            for (const m of messages) if (isEncrypted(m.body)) { try { out[m.id] = await decryptText(key.key, m.body); } catch { out[m.id] = '[nelze dešifrovat]'; } }
            const n: Record<string, string> = {};
            for (const f of bundle.files) if (f.enc) { try { n[f.id] = await decryptText(key.key, f.name); } catch { n[f.id] = '[nelze dešifrovat]'; } }
            if (!cancelled) { setPlain(out); setNames(n); }
        })();
        return () => { cancelled = true; };
    }, [key, messages, bundle.files]);

    if (!ready) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (!enabled) return <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">Klientská stránka ještě není v databázi zapnutá (chybí spuštění SQL client-portal.sql).</p>;

    const active = link && isLinkActive(link);
    const baseUrl = link ? portalUrl(window.location.origin, link.token) : '';
    const url = link?.e2ee ? (key ? linkWithKey(baseUrl, key.b64) : '') : baseUrl;
    const mustUnlock = !!link?.e2ee && !key;

    async function createLink() {
        try {
            const e2ee = !!master;
            const k = e2ee ? await generateKey() : null;
            const row = await insertRow<Link>('client_links', { case_id: item.id, user_id: userId, token: generateToken(), label: item.title, expires_at: plusDays(90), e2ee, wrapped_key: k && master ? await wrapKey(master, k) : null });
            setLink(row); setStatus(row.status_text);
        } catch (err) { fail(err); }
    }

    async function enableE2ee() {
        if (!link || !master) return;
        try {
            const k = await generateKey();
            const wrappedKey = await wrapKey(master, k);
            await updateRow('client_links', link.id, { e2ee: true, wrapped_key: wrappedKey });
            setLink({ ...link, e2ee: true, wrapped_key: wrappedKey });
        } catch (err) { fail(err); }
    }

    async function patchLink(change: Partial<Link>) {
        if (!link) return;
        try { await updateRow('client_links', link.id, change); setLink({ ...link, ...change }); } catch (err) { fail(err); }
    }

    async function copy() { if (!url) return; await navigator.clipboard?.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }

    async function addRequest() {
        const title = newRequest.trim();
        if (!title) return;
        try { const row = await insertRow<Request>('client_requests', { case_id: item.id, user_id: userId, title: title.slice(0, 140) }); setRequests((r) => [...r, row]); setNewRequest(''); } catch (err) { fail(err); }
    }
    async function toggleRequest(r: Request) {
        try { await updateRow('client_requests', r.id, { done: !r.done }); setRequests((list) => list.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x))); } catch (err) { fail(err); }
    }
    async function removeRequest(r: Request) {
        try { await deleteRow('client_requests', r.id); setRequests((list) => list.filter((x) => x.id !== r.id)); } catch (err) { fail(err); }
    }

    async function setVisible(table: 'case_files' | 'case_entries' | 'case_deadlines', id: string, visible: boolean) {
        try {
            await updateRow(table, id, { client_visible: visible });
            setBundle((b) => ({
                ...b,
                files: table === 'case_files' ? b.files.map((f) => (f.id === id ? { ...f, client_visible: visible } : f)) : b.files,
                entries: table === 'case_entries' ? b.entries.map((e) => (e.id === id ? { ...e, client_visible: visible } : e)) : b.entries,
                deadlines: table === 'case_deadlines' ? b.deadlines.map((d) => (d.id === id ? { ...d, client_visible: visible } : d)) : b.deadlines,
            }));
        } catch (err) { fail(err); }
    }

    async function setAllVisible(visible: boolean) {
        if (visible && !window.confirm('Zpřístupnit klientovi všechny dokumenty, události a termíny ve spisu? Zkontrolujte, že tam nejsou interní poznámky.')) return;
        for (const f of bundle.files.filter((x) => x.source !== 'client' && !x.enc && Boolean(x.client_visible) !== visible)) await setVisible('case_files', f.id, visible);
        for (const e of bundle.entries.filter((x) => x.kind === 'event' && Boolean(x.client_visible) !== visible)) await setVisible('case_entries', e.id, visible);
        for (const d of bundle.deadlines.filter((x) => Boolean(x.client_visible) !== visible)) await setVisible('case_deadlines', d.id, visible);
    }

    async function sendReply() {
        const body = reply.trim();
        if (!body) return;
        if (link?.e2ee && !key) { fail(new Error('Nejdřív odemkněte šifrování.')); return; }
        try {
            const stored = link?.e2ee && key ? await encryptText(key.key, body.slice(0, 2000)) : body.slice(0, 2000);
            const row = await insertRow<Message>('client_messages', { case_id: item.id, user_id: userId, from_client: false, body: stored, read: false });
            setMessages((m) => [...m, row]); setReply('');
        } catch (err) { fail(err); }
    }

    // Soubor pro klienta se šifruje v prohlížeči; do úložiště se dostane jen zašifrovaný
    async function sendFile(files: FileList) {
        if (!key || !link?.e2ee) { fail(new Error('Nejdřív zapněte a odemkněte šifrování.')); return; }
        setSending(true);
        for (const file of [...files]) {
            const problem = isAllowedUpload(file.name, file.size);
            if (problem) { fail(new Error(problem)); continue; }
            try {
                const { blob, encName } = await encryptFile(key.key, file);
                const path = `${userId}/${item.id}/${crypto.randomUUID()}-${safeFileName('sifrovano')}.bin`;
                const { error } = await supabase.storage.from('case-files').upload(path, blob, { contentType: 'application/octet-stream' });
                if (error) throw new Error(error.message);
                const row = await insertRow<CaseFile>('case_files', { case_id: item.id, user_id: userId, name: encName, path, size: blob.size, mime: '', source: 'lawyer', client_visible: true, enc: true });
                setBundle((b) => ({ ...b, files: [row, ...b.files] }));
            } catch (err) { fail(err); }
        }
        setSending(false);
    }

    const mailto = `mailto:?subject=${encodeURIComponent(`Vaše věc: ${item.title}`)}&body=${encodeURIComponent(`Dobrý den,\n\nna tomto soukromém odkazu uvidíte stav vaší věci, můžete nahrát podklady a napsat mi zprávu:\n${url}\n\nOdkaz otevřete celý, včetně části za znakem #, a nikomu ho nepředávejte.`)}`;
    const ownFiles = bundle.files;
    const visibleEvents = bundle.entries.filter((e) => e.kind === 'event');
    const sharedEnc = ownFiles.filter((f) => f.enc && f.source !== 'client');

    return (
        <div className="space-y-6">
            {verified && <E2eeBox access={access} onChanged={refreshAccess} />}

            <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5">
                <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-indigo-100 p-2.5 text-indigo-900"><Link2 size={20} aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold text-slate-900">Klientská stránka</h2>
                        <p className="mt-1 text-sm text-slate-600">Soukromý odkaz, přes který klient bez registrace vidí stav věci, nahrává podklady a píše zprávy.</p>
                        {!verified ? (
                            <p className="mt-3 rounded-xl border border-indigo-300 bg-white p-3 text-sm text-indigo-950">Klientský odkaz se zapne po ověření vaší totožnosti. <a href="/kancelar/nastaveni" className="font-semibold underline">Požádat o ověření</a></p>
                        ) : !link || !active ? (
                            <div className="mt-3">
                                {link && !active && <p className="mb-2 text-sm font-semibold text-rose-800">{link.revoked ? 'Odkaz je zrušený.' : 'Platnost odkazu vypršela.'}</p>}
                                <button type="button" onClick={() => void createLink()} className={primaryBtn}><Plus size={16} /> Vytvořit odkaz pro klienta</button>
                                {!master && <p className="mt-2 text-xs text-slate-500">Tip: nejdřív odemkněte šifrování, ať je komunikace end-to-end šifrovaná hned od začátku.</p>}
                            </div>
                        ) : (
                            <div className="mt-3 space-y-3">
                                {mustUnlock ? (
                                    <p className="rounded-xl border border-indigo-300 bg-white p-3 text-sm text-indigo-950">Odkaz je šifrovaný. Odemkněte šifrování heslem kanceláře nahoře, jinak odkaz s klíčem nelze zobrazit.</p>
                                ) : (
                                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 pl-3">
                                        <code className="min-w-0 flex-1 truncate text-xs text-slate-700">{url}</code>
                                        <button type="button" onClick={() => void copy()} className={ghostBtn}>{copied ? <><Check size={14} /> Zkopírováno</> : <><Copy size={14} /> Kopírovat</>}</button>
                                        <a href={mailto} className={ghostBtn}><Mail size={14} /> E-mailem</a>
                                    </div>
                                )}
                                {link.e2ee ? <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800"><Lock size={13} aria-hidden="true" /> End-to-end šifrováno: klíč je jen v odkazu za znakem #. Poslat musíte odkaz celý.</p> : master ? <button type="button" onClick={() => void enableE2ee()} className="text-xs font-semibold text-indigo-900 underline cursor-pointer">Zapnout end-to-end šifrování pro tuto věc (pošlete klientovi nový odkaz)</button> : null}
                                <p className="text-xs text-slate-500">Otevřen {link.opens}× {link.last_opened_at && <>· naposledy {shortDate(new Date(link.last_opened_at))}</>} · platí {link.expires_at ? `do ${shortDate(new Date(link.expires_at))}` : 'bez omezení'}</p>
                                <div className="flex flex-wrap gap-3 text-xs">
                                    <button type="button" onClick={() => void patchLink({ expires_at: plusDays(90) })} className="font-semibold text-indigo-900 underline cursor-pointer">Prodloužit o 90 dní</button>
                                    <button type="button" onClick={() => { if (window.confirm('Zrušit odkaz? Klient přestane mít přístup.')) void patchLink({ revoked: true }); }} className="font-semibold text-rose-700 underline cursor-pointer">Zrušit odkaz</button>
                                </div>
                            </div>
                        )}
                        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500"><Lock size={13} className="mt-0.5 shrink-0 text-indigo-800" aria-hidden="true" />{SECURITY_TEXT_LAWYER}</p>
                    </div>
                </div>
            </section>

            {link && active && (
                <section className={`rounded-2xl border p-5 ${link.onboarded_at ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'}`} aria-label="Klient">
                    <div className="flex items-start gap-3">
                        <span className={`rounded-xl p-2.5 ${link.onboarded_at ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{link.onboarded_at ? <UserCheck size={20} aria-hidden="true" /> : <UserRound size={20} aria-hidden="true" />}</span>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold text-slate-900">Klient</h3>
                            {link.onboarded_at ? (
                                <div className="mt-1 text-sm text-slate-700">
                                    <p className="text-lg font-bold text-slate-900">{link.client_name} {link.client_verified_at && <span className="ml-1 inline-flex items-center gap-1 align-middle text-xs font-semibold text-emerald-700"><BadgeCheck size={14} /> totožnost potvrzena</span>}</p>
                                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-indigo-900">
                                        {link.client_email && <a href={`mailto:${link.client_email}`} className="inline-flex items-center gap-1.5 hover:underline"><Mail size={14} />{link.client_email}</a>}
                                        {link.client_phone && <a href={`tel:${link.client_phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone size={14} />{link.client_phone}</a>}
                                    </p>
                                    {link.client_address && <p className="mt-1 text-xs text-slate-600">{link.client_address}</p>}
                                    <p className="mt-2 text-xs text-slate-500">Údaje vyplnil {link.onboarded_at && shortDate(new Date(link.onboarded_at))} a potvrdil souhlas se zpracováním{link.consent_at ? ` (${shortDate(new Date(link.consent_at))})` : ''}. Údaje o klientovi nejsou end-to-end šifrované (potřebuje je adresář klientů).</p>
                                    {!link.client_verified_at && <button type="button" onClick={() => { if (window.confirm('Potvrdit, že jste totožnost klienta ověřili (např. při osobním setkání nebo hovoru)? Klient uvidí potvrzení na své stránce.')) void patchLink({ client_verified_at: new Date().toISOString() }); }} className={`${ghostBtn} mt-3`}><BadgeCheck size={15} /> Potvrdit totožnost klienta</button>}
                                </div>
                            ) : (
                                <p className="mt-1 text-sm text-slate-600">Klient zatím nevyplnil své údaje. Po otevření odkazu se nejdřív představí a potvrdí souhlas, teprve potom uvidí věc.</p>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {link && active && (
                <>
                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h3 className="text-sm font-semibold text-slate-900">Aktuální stav pro klienta</h3>
                        <textarea value={status} onChange={(e) => setStatus(e.target.value)} onBlur={() => { if (status !== link.status_text) void patchLink({ status_text: status.trim().slice(0, 400) }); }} rows={2} maxLength={400} placeholder="Jednou větou: co se s věcí děje" className={`${inputCls} mt-2`} aria-label="Aktuální stav pro klienta" />
                        <div className="mt-2 flex flex-wrap gap-2">{STATUS_TEMPLATES.map((t) => <button key={t} type="button" onClick={() => { setStatus(t); void patchLink({ status_text: t }); }} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:border-indigo-400 cursor-pointer">{t}</button>)}</div>
                        {link.e2ee && <p className="mt-2 text-xs text-slate-500">Stav věci není end-to-end šifrovaný. Nepište do něj důvěrné podrobnosti, ty patří do zpráv.</p>}
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h3 className="text-sm font-semibold text-slate-900">Co potřebujeme od klienta</h3>
                        <ul className="mt-3 space-y-2">
                            {requests.map((r) => {
                                const got = ownFiles.filter((f) => f.request_id === r.id);
                                return (
                                    <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                                        <input type="checkbox" checked={r.done} onChange={() => void toggleRequest(r)} aria-label={`Hotovo: ${r.title}`} className="h-4 w-4 accent-indigo-800" />
                                        <span className={`min-w-0 flex-1 ${r.done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{r.title}</span>
                                        {got.length > 0 && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">nahráno {got.length}×</span>}
                                        <button type="button" onClick={() => void removeRequest(r)} aria-label={`Smazat ${r.title}`} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={14} /></button>
                                    </li>
                                );
                            })}
                        </ul>
                        <form onSubmit={(e) => { e.preventDefault(); void addRequest(); }} className="mt-3 flex gap-2">
                            <input value={newRequest} onChange={(e) => setNewRequest(e.target.value)} placeholder="Např. Kopie smlouvy, fotky poškození, výpis z účtu" maxLength={140} className={inputCls} aria-label="Nový požadavek na klienta" />
                            <button type="submit" disabled={!newRequest.trim()} className={ghostBtn}><Plus size={15} /> Přidat</button>
                        </form>
                        <p className="mt-2 text-xs text-slate-500">Nahrané soubory se objeví v záložce Soubory s označením „od klienta“.</p>
                    </section>

                    {link.e2ee && (
                        <section className="rounded-2xl border border-slate-200 bg-white p-5">
                            <h3 className="text-sm font-semibold text-slate-900">Šifrované dokumenty pro klienta</h3>
                            <p className="text-xs text-slate-500">Soubor se zašifruje ve vašem prohlížeči a klient ho dešifruje u sebe. Nikdo další ho nepřečte.</p>
                            <input ref={picker} type="file" multiple className="hidden" aria-label="Vybrat soubory pro klienta" onChange={(e) => { if (e.target.files?.length) void sendFile(e.target.files); e.target.value = ''; }} />
                            <button type="button" onClick={() => picker.current?.click()} disabled={!key || sending} className={`${ghostBtn} mt-3`}><Paperclip size={15} /> {sending ? 'Šifruji a nahrávám…' : 'Poslat dokument klientovi'}</button>
                            {sharedEnc.length > 0 && <ul className="mt-3 divide-y divide-slate-100 text-sm">{sharedEnc.map((f) => <li key={f.id} className="flex items-center justify-between gap-3 py-2"><span className="min-w-0 truncate text-slate-800"><Lock size={12} className="mr-1.5 inline text-indigo-800" />{names[f.id] ?? 'Šifrovaný soubor'}</span><span className="shrink-0 text-xs text-slate-500">{formatSize(f.size)}</span></li>)}</ul>}
                        </section>
                    )}

                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h3 className="text-sm font-semibold text-slate-900">Co klient vidí</h3>
                        <p className="text-xs text-slate-500">Ve výchozím stavu nic. Klient uvidí jen to, co zde odemknete.</p>
                        <div className="mt-2 flex gap-3 text-xs">
                            <button type="button" onClick={() => void setAllVisible(true)} className="font-semibold text-indigo-900 underline cursor-pointer">Zpřístupnit vše</button>
                            <button type="button" onClick={() => void setAllVisible(false)} className="font-semibold text-slate-600 underline cursor-pointer">Skrýt vše</button>
                        </div>
                        {[
                            ['Dokumenty', ownFiles.filter((f) => f.source !== 'client' && !f.enc).map((f) => ({ id: f.id, label: `${f.name} (${formatSize(f.size)})`, on: Boolean(f.client_visible), table: 'case_files' as const }))],
                            ['Chronologie', visibleEvents.map((e) => ({ id: e.id, label: e.title, on: Boolean(e.client_visible), table: 'case_entries' as const }))],
                            ['Termíny', bundle.deadlines.map((d) => ({ id: d.id, label: `${d.title} · ${shortDate(new Date(`${d.due_date}T12:00:00`))}`, on: Boolean(d.client_visible), table: 'case_deadlines' as const }))],
                        ].map(([title, rows]) => (
                            (rows as { id: string; label: string; on: boolean; table: 'case_files' | 'case_entries' | 'case_deadlines' }[]).length > 0 && (
                                <div key={title as string} className="mt-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title as string}</p>
                                    <ul className="mt-1 divide-y divide-slate-100">
                                        {(rows as { id: string; label: string; on: boolean; table: 'case_files' | 'case_entries' | 'case_deadlines' }[]).map((r) => (
                                            <li key={r.id}><button type="button" onClick={() => void setVisible(r.table, r.id, !r.on)} aria-pressed={r.on} className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm cursor-pointer"><span className={r.on ? 'text-slate-900' : 'text-slate-500'}>{r.label}</span><span className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${r.on ? 'text-emerald-700' : 'text-slate-400'}`}>{r.on ? <><Eye size={14} /> vidí</> : <><EyeOff size={14} /> skryto</>}</span></button></li>
                                        ))}
                                    </ul>
                                </div>
                            )
                        ))}
                    </section>
                </>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">Zprávy s klientem {link?.e2ee && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Lock size={12} /> end-to-end</span>}</h3>
                {messages.length === 0 ? <p className="mt-2 text-sm text-slate-500">Zatím žádné zprávy.</p> : (
                    <ul className="mt-3 space-y-2">{messages.map((m) => <li key={m.id} className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.from_client ? 'bg-slate-100 text-slate-900' : 'ml-auto bg-indigo-800 text-white'}`}><p className="whitespace-pre-line">{isEncrypted(m.body) ? (plain[m.id] ?? '🔒 Zašifrovaná zpráva. Odemkněte šifrování.') : m.body}</p><p className={`mt-0.5 text-[11px] ${m.from_client ? 'text-slate-500' : 'text-indigo-100'}`}>{m.from_client ? (link?.client_name || 'Klient') : 'Vy'} · {shortDate(new Date(m.created_at))}</p></li>)}</ul>
                )}
                <form onSubmit={(e) => { e.preventDefault(); void sendReply(); }} className="mt-3 flex gap-2">
                    <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} maxLength={2000} placeholder="Odpovědět klientovi…" aria-label="Odpověď klientovi" className={inputCls} />
                    <button type="submit" disabled={!reply.trim()} aria-label="Odeslat odpověď" className={`${primaryBtn} self-end`}><Send size={16} /></button>
                </form>
                {!link && <p className="mt-2 text-xs text-slate-500">Klient zprávu uvidí, až mu pošlete odkaz.</p>}
            </section>
        </div>
    );
}
