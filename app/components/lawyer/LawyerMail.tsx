'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Download, FolderInput, Loader2, Mail, MailPlus, Paperclip, RefreshCw, Reply, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { encryptText } from '@/lib/e2ee';
import { insertRow, uploadCaseFile } from '@/lib/caseFile';
import { PRESETS } from '@/lib/mailPresets';
import { b64ToBytes, credsOf, fileToB64, mailApi, quoted, safeHtml, type FullMessage, type MailAccountRow, type MsgSummary } from '@/lib/mailClient';
import type { MailCreds } from '@/lib/mailServer';
import { useMasterKey } from '@/lib/useE2ee';
import { assignActivity, logActivity } from '@/lib/activity';
import { wordCount } from '@/lib/workLog';
import E2eeBox from '../situation/E2eeBox';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

type Folder = 'INBOX' | 'SENT';
type CaseOpt = { id: string; title: string; client_id: string | null; client_email: string | null; client_name: string | null };
type ClientOpt = { id: string; email: string };
type Compose = { to: string; cc: string; subject: string; body: string; files: File[]; caseId: string; inReplyTo?: string; references?: string[] };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} kB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

// E-mail v aplikaci: schránka se připojí přes IMAP/SMTP, zprávy se čtou živě a do věci se ukládá jen to, co advokát vybere
export default function LawyerMail() {
    const { userId, access } = useLawyer();
    const master = useMasterKey();
    const [accounts, setAccounts] = useState<MailAccountRow[] | null | undefined>(undefined);
    const [accId, setAccId] = useState('');
    const [creds, setCreds] = useState<MailCreds | null>(null);
    const [folder, setFolder] = useState<Folder>('INBOX');
    const [messages, setMessages] = useState<MsgSummary[]>([]);
    const [sel, setSel] = useState<FullMessage | null>(null);
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [compose, setCompose] = useState<Compose | null>(null);
    const [cases, setCases] = useState<CaseOpt[]>([]);
    const [clients, setClients] = useState<ClientOpt[]>([]);
    const [saveCase, setSaveCase] = useState('');
    const [pending, setPending] = useState<MsgSummary | null>(null);
    const cache = useRef(new Map<string, FullMessage>());

    const account = accounts?.find((a) => a.id === accId) ?? accounts?.[0] ?? null;
    const reloadAccounts = useCallback(async () => {
        const { data, error: e } = await supabase.from('mail_accounts').select('*').order('created_at');
        if (e) { setAccounts(null); setError(/mail_accounts|schema cache|does not exist/i.test(e.message) ? 'E-mail zatím není v databázi zapnutý (chybí spuštění souboru posta.sql).' : e.message); return; }
        setAccounts((data ?? []) as MailAccountRow[]);
    }, []);
    useEffect(() => {
        const t = window.setTimeout(() => {
            void reloadAccounts();
            supabase.from('cases').select('id, title, client_id, client_email, client_name').then(({ data }) => setCases((data ?? []) as CaseOpt[]));
            supabase.from('lawyer_clients').select('id, email').then(({ data }) => setClients((data ?? []) as ClientOpt[]));
        }, 0);
        return () => window.clearTimeout(t);
    }, [reloadAccounts]);
    // Heslo ke schránce se odemkne hlavním klíčem v prohlížeči
    useEffect(() => {
        let alive = true;
        void (async () => { if (!master || !account) { if (alive) setCreds(null); return; } try { const c = await credsOf(master, account); if (alive) setCreds(c); } catch { if (alive) { setCreds(null); setError('Heslo ke schránce se nepodařilo odemknout.'); } } })();
        return () => { alive = false; };
    }, [master, account]);

    const load = useCallback(async (c: MailCreds, f: Folder, q: string, before?: number) => {
        setBusy('list'); setError('');
        try {
            const path = f === 'SENT' ? (c.sentFolder || 'Sent') : 'INBOX';
            const r = await mailApi<{ messages: MsgSummary[] }>('list', c, { folder: path, query: q || undefined, before });
            setMessages((m) => (before ? [...m, ...r.messages] : r.messages));
        } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se načíst e-maily.'); }
        setBusy('');
    }, []);
    useEffect(() => { const t = window.setTimeout(() => { if (creds) void load(creds, folder, '', undefined); }, 0); return () => window.clearTimeout(t); }, [creds, folder, load]);

    async function open(m: MsgSummary) {
        if (!creds) return;
        setError(''); setInfo(''); setSaveCase('');
        const key = `${folder}:${m.uid}:${account?.id ?? ''}`;
        const suggest = (full: FullMessage) => {
            // Věc, ke které zpráva pravděpodobně patří (podle e-mailu klienta)
            const who = (folder === 'SENT' ? full.to : full.fromEmail).toLowerCase();
            const hit = cases.find((c) => c.client_email && who.includes(c.client_email.toLowerCase())) ?? cases.find((c) => clients.some((cl) => cl.id === c.client_id && cl.email && who.includes(cl.email.toLowerCase())));
            if (hit) setSaveCase(hit.id);
            return hit?.id ?? null;
        };
        setMessages((all) => all.map((x) => (x.uid === m.uid ? { ...x, seen: true } : x)));
        const hit = cache.current.get(key);
        if (hit) { setSel(hit); setPending(null); suggest(hit); return; }
        // Hlavička se ukáže hned, obsah se dočte
        setPending(m); setSel(null); setBusy('read');
        try {
            const path = folder === 'SENT' ? (creds.sentFolder || 'Sent') : 'INBOX';
            const full = await mailApi<FullMessage>('read', creds, { folder: path, uid: m.uid });
            cache.current.set(key, full);
            setSel(full);
            const guess = suggest(full);
            // Stopa práce: přečtený e-mail (k věci, pokud ji aplikace pozná podle klienta)
            if (folder === 'INBOX') logActivity('email_read', { caseId: guess, label: full.subject, ref: `mail:${key}` });
        } catch (e) { setError(e instanceof Error ? e.message : 'Zprávu se nepodařilo otevřít.'); }
        setPending(null); setBusy('');
    }

    async function saveToCase() {
        if (!creds || !sel || !saveCase) return;
        setBusy('save'); setError(''); setInfo('');
        try {
            const path = folder === 'SENT' ? (creds.sentFolder || 'Sent') : 'INBOX';
            let n = 0;
            for (const a of sel.attachments.filter((x) => x.size <= 15 * 1024 * 1024)) {
                const r = await mailApi<{ filename: string; contentType: string; base64: string }>('attachment', creds, { folder: path, uid: sel.uid, index: a.index });
                await uploadCaseFile(userId, saveCase, null, new File([b64ToBytes(r.base64) as BlobPart], r.filename, { type: r.contentType })); n += 1;
            }
            await insertRow('case_entries', { case_id: saveCase, user_id: userId, kind: 'event', title: `E-mail: ${sel.subject}`.slice(0, 200), body: `Od: ${sel.from}\nKomu: ${sel.to}\nDatum: ${sel.date ? new Date(sel.date).toLocaleString('cs-CZ') : ''}${n ? `\nPřílohy uloženy do souborů věci: ${n}` : ''}\n\n${sel.text.slice(0, 6000)}`, happened_on: sel.date ? sel.date.slice(0, 10) : null });
            assignActivity(`mail:${folder}:${sel.uid}:${account?.id ?? ''}`, saveCase);
            setInfo(`Uloženo do věci „${cases.find((c) => c.id === saveCase)?.title ?? ''}“: zápis v chronologii${n ? ` a ${n} příloh` : ''}.`);
        } catch (e) { setError(e instanceof Error ? e.message : 'Uložení se nepovedlo.'); }
        setBusy('');
    }
    async function download(idx: number) {
        if (!creds || !sel) return;
        setBusy(`att-${idx}`);
        try {
            const r = await mailApi<{ filename: string; contentType: string; base64: string }>('attachment', creds, { folder: folder === 'SENT' ? (creds.sentFolder || 'Sent') : 'INBOX', uid: sel.uid, index: idx });
            const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([b64ToBytes(r.base64) as BlobPart], { type: r.contentType })); a.download = r.filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
        } catch (e) { setError(e instanceof Error ? e.message : 'Přílohu se nepodařilo stáhnout.'); }
        setBusy('');
    }
    const signature = [access.display_name, access.firm_name, access.phone].filter(Boolean).join('\n');
    function reply() {
        if (!sel) return;
        setCompose({ to: sel.fromEmail, cc: '', subject: /^re:/i.test(sel.subject) ? sel.subject : `Re: ${sel.subject}`, body: `\n\n${signature}${quoted(sel)}`, files: [], caseId: saveCase, inReplyTo: sel.messageId, references: [...sel.references, sel.messageId].filter(Boolean) });
    }
    async function send() {
        if (!creds || !compose) return;
        setBusy('send'); setError('');
        try {
            const attachments = await Promise.all(compose.files.map(async (f) => ({ filename: f.name, contentType: f.type || 'application/octet-stream', base64: await fileToB64(f) })));
            const r = await mailApi<{ saved: boolean }>('send', creds, { mail: { to: compose.to, cc: compose.cc, subject: compose.subject, text: compose.body, inReplyTo: compose.inReplyTo, references: compose.references, attachments } });
            logActivity('email_sent', { caseId: compose.caseId || null, label: compose.subject, words: wordCount(compose.body.split('\n').filter((l) => !l.startsWith('>')).join(' ')) });
            if (compose.caseId) await insertRow('case_entries', { case_id: compose.caseId, user_id: userId, kind: 'event', title: `Odeslán e-mail: ${compose.subject}`.slice(0, 200), body: `Komu: ${compose.to}\n\n${compose.body.slice(0, 6000)}`, happened_on: new Date().toISOString().slice(0, 10) });
            setInfo(`E-mail je odeslaný${compose.caseId ? ' a zapsaný do věci' : ''}${r.saved ? '' : '. Kopii do složky Odeslané se uložit nepodařilo.'}`); setCompose(null);
        } catch (e) { setError(e instanceof Error ? e.message : 'E-mail se nepodařilo odeslat.'); }
        setBusy('');
    }
    async function removeAccount() {
        if (!account || !window.confirm(`Odpojit schránku ${account.email}? Zprávy zůstanou u poskytovatele, smaže se jen propojení.`)) return;
        await supabase.from('mail_accounts').delete().eq('id', account.id); setSel(null); setMessages([]); await reloadAccounts();
    }

    const caseTitle = useMemo(() => new Map(cases.map((c) => [c.id, c.title])), [cases]);
    if (accounts === undefined) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (accounts === null) return <p role="alert" className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">{error}</p>;
    if (!master) return <div className="max-w-2xl space-y-3"><p className="text-sm text-slate-600">Heslo ke schránce je uložené zašifrované vaším šifrovacím heslem, proto ho nejdřív nastavte nebo odemkněte.</p><E2eeBox access={access} onChanged={() => window.location.reload()} /></div>;
    if (accounts.length === 0) return <Connect master={master} userId={userId} onDone={reloadAccounts} />;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                {accounts.length > 1 && <select value={account?.id} onChange={(e) => { setAccId(e.target.value); setSel(null); }} className={`${inputCls} w-auto`} aria-label="Schránka">{accounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}</select>}
                {accounts.length === 1 && <span className="text-sm font-semibold text-slate-700">{account?.email}</span>}
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="tablist" aria-label="Složka">{([['INBOX', 'Doručené'], ['SENT', 'Odeslané']] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={folder === id} onClick={() => { setFolder(id); setSel(null); }} className={`rounded-lg px-3 py-1 text-sm font-semibold ${folder === id ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'}`}>{label}</button>)}</div>
                <form onSubmit={(e) => { e.preventDefault(); if (creds) void load(creds, folder, query); }} className="flex flex-1 items-center gap-2"><div className="relative min-w-40 flex-1"><Search size={14} className="absolute left-3 top-3 text-slate-400" aria-hidden="true" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hledat odesílatele nebo předmět…" className={`${inputCls} pl-8`} /></div></form>
                <button type="button" onClick={() => creds && void load(creds, folder, query)} disabled={busy === 'list'} aria-label="Obnovit" className={ghostBtn}>{busy === 'list' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
                <button type="button" onClick={() => setCompose({ to: '', cc: '', subject: '', body: `\n\n${signature}`, files: [], caseId: '' })} className={primaryBtn}><MailPlus size={15} /> Nový e-mail</button>
                <button type="button" onClick={() => void removeAccount()} aria-label="Odpojit schránku" title="Odpojit schránku" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 cursor-pointer"><Trash2 size={15} /></button>
            </div>
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            {info && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{info}</p>}

            <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
                <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200 bg-white text-sm">
                    {messages.map((m) => (
                        <li key={m.uid}><button type="button" onClick={() => void open(m)} className={`block w-full px-4 py-2.5 text-left hover:bg-slate-50 cursor-pointer ${sel?.uid === m.uid ? 'bg-indigo-50' : ''}`}>
                            <span className="flex items-baseline justify-between gap-2"><span className={`truncate ${m.seen ? 'text-slate-700' : 'font-bold text-slate-900'}`}>{folder === 'SENT' ? m.to : m.from}</span><span className="shrink-0 text-[11px] text-slate-400">{fmt(m.date)}</span></span>
                            <span className={`block truncate ${m.seen ? 'text-slate-500' : 'font-semibold text-slate-800'}`}>{m.attachments && <Paperclip size={11} className="mr-1 inline" aria-label="Příloha" />}{m.subject}</span></button></li>
                    ))}
                    {messages.length === 0 && busy !== 'list' && <li className="px-4 py-6 text-slate-500">Žádné zprávy.</li>}
                    {messages.length >= 30 && creds && <li><button type="button" onClick={() => void load(creds, folder, query, messages[messages.length - 1].seq)} className="w-full px-4 py-2.5 text-center text-xs font-semibold text-indigo-800 hover:bg-slate-50 cursor-pointer">Načíst starší</button></li>}
                </ul>

                <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Zpráva">
                    {busy === 'read' && pending && <div role="status"><h2 className="text-lg font-bold text-slate-900">{pending.subject}</h2><p className="text-xs text-slate-500">Od: {pending.from} · {pending.date ? new Date(pending.date).toLocaleString('cs-CZ') : ''}</p><p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Načítám obsah…</p></div>}
                    {!sel && busy !== 'read' && <p className="flex items-center gap-2 text-sm text-slate-500"><Mail size={16} aria-hidden="true" /> Vyberte zprávu vlevo.</p>}
                    {sel && busy !== 'read' && (
                        <div className="space-y-3">
                            <div><h2 className="text-lg font-bold text-slate-900">{sel.subject}</h2><p className="text-xs text-slate-500">Od: {sel.from} · Komu: {sel.to}{sel.cc ? ` · Kopie: ${sel.cc}` : ''} · {sel.date ? new Date(sel.date).toLocaleString('cs-CZ') : ''}</p></div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button type="button" onClick={reply} className={primaryBtn}><Reply size={15} /> Odpovědět</button>
                                <select value={saveCase} onChange={(e) => setSaveCase(e.target.value)} className={`${inputCls} w-auto max-w-64`} aria-label="Věc"><option value="">Uložit do věci…</option>{cases.map((c) => <option key={c.id} value={c.id}>{c.title}{c.client_name ? ` · ${c.client_name}` : ''}</option>)}</select>
                                <button type="button" onClick={() => void saveToCase()} disabled={!saveCase || busy === 'save'} className={ghostBtn}>{busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <FolderInput size={14} />} Uložit</button>
                            </div>
                            {saveCase && <p className="text-xs text-slate-500">Uloží se zápis do chronologie věci „{caseTitle.get(saveCase)}“ a všechny přílohy do jejích souborů.</p>}
                            {sel.attachments.length > 0 && <ul className="flex flex-wrap gap-2">{sel.attachments.map((a) => <li key={a.index}><button type="button" onClick={() => void download(a.index)} disabled={busy === `att-${a.index}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"><Download size={12} /> {a.filename} ({size(a.size)})</button></li>)}</ul>}
                            {sel.html ? <iframe title="Obsah zprávy" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={safeHtml(sel.html)} className="h-[28rem] w-full rounded-xl border border-slate-200" /> : <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm text-slate-800">{sel.text}</pre>}
                            {sel.html && <p className="text-xs text-slate-400">Obrázky z internetu a skripty ve zprávě jsou ze soukromí a bezpečnosti zablokované.</p>}
                        </div>
                    )}
                </section>
            </div>

            {compose && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="Nový e-mail">
                    <div className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
                        <h2 className="text-lg font-bold text-slate-900">{compose.inReplyTo ? 'Odpověď' : 'Nový e-mail'}</h2>
                        <input value={compose.to} onChange={(e) => setCompose({ ...compose, to: e.target.value })} placeholder="Komu" aria-label="Komu" className={inputCls} />
                        <input value={compose.cc} onChange={(e) => setCompose({ ...compose, cc: e.target.value })} placeholder="Kopie (nepovinné)" aria-label="Kopie" className={inputCls} />
                        <input value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} placeholder="Předmět" aria-label="Předmět" className={inputCls} />
                        <textarea value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} rows={12} aria-label="Text" className={`${inputCls} font-mono text-[13px]`} />
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"><Paperclip size={14} /> Přidat přílohu<input type="file" multiple className="sr-only" onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ''; setCompose((c) => (c ? { ...c, files: [...c.files, ...f] } : c)); }} /></label>
                            {compose.files.map((f, i) => <button key={`${f.name}-${i}`} type="button" onClick={() => setCompose({ ...compose, files: compose.files.filter((_, j) => j !== i) })} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200 cursor-pointer" title="Odebrat">{f.name} ×</button>)}
                        </div>
                        <select value={compose.caseId} onChange={(e) => setCompose({ ...compose, caseId: e.target.value })} className={inputCls} aria-label="Zapsat do věci"><option value="">Nezapisovat do věci</option>{cases.map((c) => <option key={c.id} value={c.id}>Zapsat do věci: {c.title}</option>)}</select>
                        <div className="flex justify-end gap-2"><button type="button" onClick={() => setCompose(null)} className={ghostBtn}>Zrušit</button><button type="button" onClick={() => void send()} disabled={busy === 'send' || !compose.to.trim() || !compose.subject.trim()} className={primaryBtn}>{busy === 'send' && <Loader2 size={15} className="animate-spin" />} Odeslat</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Connect({ master, userId, onDone }: { master: CryptoKey; userId: string; onDone: () => Promise<void> }) {
    const [preset, setPreset] = useState('gmail');
    const [f, setF] = useState({ email: '', password: '', imapHost: '', imapPort: '993', smtpHost: '', smtpPort: '465' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const p = PRESETS[preset];
    const ref = useRef<HTMLInputElement>(null);
    async function save(e: React.FormEvent) {
        e.preventDefault(); setBusy(true); setError('');
        try {
            const creds: MailCreds = { email: f.email.trim(), password: f.password, imapHost: preset === 'jiny' ? f.imapHost : p.imapHost, imapPort: Number(preset === 'jiny' ? f.imapPort : p.imapPort), smtpHost: preset === 'jiny' ? f.smtpHost : p.smtpHost, smtpPort: Number(preset === 'jiny' ? f.smtpPort : p.smtpPort), skipAppend: p.skipAppend };
            const t = await mailApi<{ sentFolder: string }>('test', creds);
            const { error: err } = await supabase.from('mail_accounts').insert({ user_id: userId, label: creds.email, email: creds.email, preset: ['gmail', 'seznam', 'centrum'].includes(preset) ? preset : 'jiny', imap_host: creds.imapHost, imap_port: creds.imapPort, smtp_host: creds.smtpHost, smtp_port: creds.smtpPort, sent_folder: t.sentFolder, skip_append: !!creds.skipAppend, enc_password: await encryptText(master, creds.password) });
            if (err) throw new Error(/mail_accounts|schema cache/i.test(err.message) ? 'E-mail zatím není v databázi zapnutý (chybí spuštění souboru posta.sql).' : err.message);
            await onDone();
        } catch (ex) { setError(ex instanceof Error ? ex.message : 'Připojení se nepovedlo.'); }
        setBusy(false);
    }
    return (
        <form onSubmit={save} className="max-w-2xl space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Mail size={18} className="text-indigo-700" aria-hidden="true" /> Připojit e-mailovou schránku</h2>
            <p className="text-sm leading-relaxed text-slate-600">E-maily pak čtete a odpovídáte na ně přímo v aplikaci, zprávy uložíte do věci jedním kliknutím a nemusíte přepínat do Gmailu. Heslo se uloží zašifrované vaším šifrovacím heslem, server ho nezná a použije ho jen při načtení pošty.</p>
            <label className="block text-xs font-semibold text-slate-600">Poskytovatel<select value={preset} onChange={(e) => setPreset(e.target.value)} className={`${inputCls} mt-1 font-normal`}>{Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
            <p className="rounded-lg bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-950">{p.help}</p>
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-600">E-mailová adresa<input ref={ref} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoComplete="off" className={`${inputCls} mt-1 font-normal`} /></label>
                <label className="block text-xs font-semibold text-slate-600">Heslo (pro aplikace)<input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required autoComplete="new-password" className={`${inputCls} mt-1 font-normal`} /></label>
                {preset === 'jiny' && <><label className="block text-xs font-semibold text-slate-600">Server IMAP<input value={f.imapHost} onChange={(e) => setF({ ...f, imapHost: e.target.value })} required placeholder="imap.example.cz" className={`${inputCls} mt-1 font-normal`} /></label><label className="block text-xs font-semibold text-slate-600">Port IMAP<select value={f.imapPort} onChange={(e) => setF({ ...f, imapPort: e.target.value })} className={`${inputCls} mt-1 font-normal`}><option>993</option><option>143</option></select></label>
                    <label className="block text-xs font-semibold text-slate-600">Server SMTP<input value={f.smtpHost} onChange={(e) => setF({ ...f, smtpHost: e.target.value })} required placeholder="smtp.example.cz" className={`${inputCls} mt-1 font-normal`} /></label><label className="block text-xs font-semibold text-slate-600">Port SMTP<select value={f.smtpPort} onChange={(e) => setF({ ...f, smtpPort: e.target.value })} className={`${inputCls} mt-1 font-normal`}><option>465</option><option>587</option></select></label></>}
            </div>
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            <button type="submit" disabled={busy} className={primaryBtn}>{busy && <Loader2 size={15} className="animate-spin" />} Ověřit a připojit</button>
            <p className="text-xs text-slate-500">Přihlašování heslem k Microsoft 365 a Outlook.com už Microsoft nepovoluje, pro ně tato funkce zatím není. Více v <Link href="/ochrana-osobnich-udaju" className="underline">zásadách ochrany údajů</Link>.</p>
        </form>
    );
}
