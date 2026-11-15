'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Briefcase, Building2, Check, Download, FileText, Landmark, Loader2, Lock, MessageSquare, Paperclip, Send, Trash2, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadCases, type LegalCase } from '@/lib/cases';
import { formatSize } from '@/lib/caseFile';
import { decryptAttachment, encryptMessage, openMessage } from '@/lib/e2eeShare';
import { KIND_LABELS, MAX_CASE_SHARE_BYTES, MAX_TEXT, addPropertyToCase, fetchCaseFileBytes, importCase, importClient, prepareCaseShare, type ChatKind, type ChatPayload } from '@/lib/chatItems';
import type { LawyerClient } from '@/lib/lawyer';
import { MAX_FILE_BYTES } from '@/lib/caseFile';
import type { PropertySnapshot } from '@/lib/katastr';
import E2eeBox from '../situation/E2eeBox';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { PropertyCard, snapshotLabel } from './KatastrSearch';
import { useSharingKeys } from './useSharingKeys';
import { useLawyer } from './LawyerGate';

type Msg = { id: string; sender_id: string; recipient_id: string; kind: ChatKind; payload: string; wrapped_key_recipient: string; wrapped_key_sender: string; created_at: string; read_at: string | null };
type Opened = { payload: ChatPayload; key: CryptoKey } | 'error';
type Summary = Record<string, { unread: number; last_at: string; last_kind: ChatKind }>;
type SavedProperty = { id: string; case_id: string; label: string; snapshot: PropertySnapshot; data_as_of: string };

const time = (iso: string) => { const d = new Date(iso); const today = new Date(); return d.toDateString() === today.toDateString() ? d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }) + ' ' + d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }); };

// Šifrovaný chat mezi členy kanceláře: zprávy, soubory, celé věci, klienti a nemovitosti
export default function LawyerChat() {
    const { access } = useLawyer();
    const keys = useSharingKeys();
    const { userId, master, colleagues, privateKey, myRow } = keys;
    const [peer, setPeer] = useState<string>('');
    const [summary, setSummary] = useState<Summary>({});
    const [messages, setMessages] = useState<Msg[]>([]);
    const [opened, setOpened] = useState<Record<string, Opened>>({});
    const [text, setText] = useState('');
    const [attach, setAttach] = useState<null | 'file' | 'case' | 'client' | 'property'>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [clients, setClients] = useState<LawyerClient[]>([]);
    const [props, setProps] = useState<SavedProperty[]>([]);
    const [pick, setPick] = useState('');
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const firmId = useRef('');
    const bottom = useRef<HTMLDivElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    const loadSummary = useCallback(async () => {
        const { data } = await supabase.rpc('chat_summary');
        const map: Summary = {};
        for (const r of (data ?? []) as { peer: string; unread: number; last_at: string; last_kind: ChatKind }[]) map[r.peer] = { unread: Number(r.unread), last_at: r.last_at, last_kind: r.last_kind };
        setSummary(map);
    }, []);

    const loadMessages = useCallback(async (peerId: string) => {
        if (!peerId) return;
        const { data, error: err } = await supabase.from('firm_messages').select('*').or(`and(sender_id.eq.${userId},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${userId})`).order('created_at', { ascending: true }).limit(300);
        if (err) { setError(/firm_messages|does not exist/i.test(err.message) ? 'Chat zatím není v databázi zapnutý (chybí spuštění souboru chat.sql).' : err.message); return; }
        setMessages((data ?? []) as Msg[]);
        if (((data ?? []) as Msg[]).some((m) => m.recipient_id === userId && !m.read_at)) { await supabase.rpc('mark_chat_read', { p_peer: peerId }); void loadSummary(); }
    }, [userId, loadSummary]);

    // Průběžné obnovování (každých 10 s), dokud je chat otevřený
    useEffect(() => {
        if (!privateKey) return;
        let cancelled = false;
        const tick = () => { if (!cancelled) { void loadSummary(); if (peer) void loadMessages(peer); } };
        tick();
        const id = window.setInterval(tick, 10_000);
        return () => { cancelled = true; window.clearInterval(id); };
    }, [privateKey, peer, loadSummary, loadMessages]);

    // Dešifrování nových zpráv
    useEffect(() => {
        if (!privateKey) return;
        let cancelled = false;
        void (async () => {
            const next: Record<string, Opened> = {};
            for (const m of messages) {
                if (opened[m.id]) continue;
                try { next[m.id] = await openMessage<ChatPayload>(privateKey, m.recipient_id === userId ? m.wrapped_key_recipient : m.wrapped_key_sender, m.payload); } catch { next[m.id] = 'error'; }
            }
            if (!cancelled && Object.keys(next).length) setOpened((o) => ({ ...o, ...next }));
        })();
        return () => { cancelled = true; };
    }, [messages, privateKey, userId, opened]);

    useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages.length, peer]);

    // Podklady pro přílohy (věci, klienti, uložené nemovitosti) se načtou až při otevření přílohy
    async function openAttach(kind: 'file' | 'case' | 'client' | 'property') {
        setAttach(kind); setPick(''); setFiles([]); setError('');
        if (kind === 'case' && !cases.length) setCases(await loadCases().catch(() => []));
        if (kind === 'client' && !clients.length) { const { data } = await supabase.from('lawyer_clients').select('*').order('name'); setClients((data ?? []) as LawyerClient[]); }
        if (kind === 'property' && !props.length) { const { data } = await supabase.from('case_properties').select('id, case_id, label, snapshot, data_as_of').order('created_at', { ascending: false }); setProps((data ?? []) as SavedProperty[]); }
    }

    async function getFirmId(): Promise<string> {
        if (firmId.current) return firmId.current;
        const { data } = await supabase.from('firm_members').select('firm_id').eq('user_id', userId).maybeSingle();
        if (!data) throw new Error('Nejste členem kanceláře.');
        firmId.current = (data as { firm_id: string }).firm_id;
        return firmId.current;
    }

    async function send(kind: ChatKind, payload: ChatPayload, attachments: Uint8Array[] = []) {
        const recipient = keys.keys[peer]; const mine = myRow;
        if (!recipient || !mine) throw new Error('Kolega ještě nemá zapnuté šifrované sdílení.');
        const id = crypto.randomUUID();
        const enc = await encryptMessage(payload, attachments, recipient.public_key, mine.public_key);
        const paths: string[] = [];
        try {
            for (let i = 0; i < enc.blobs.length; i++) {
                const path = `${userId}/${id}/${i}.bin`;
                const up = await supabase.storage.from('firm-shares').upload(path, enc.blobs[i], { contentType: 'application/octet-stream' });
                if (up.error) throw new Error(up.error.message);
                paths.push(path);
            }
            const ins = await supabase.from('firm_messages').insert({ id, firm_id: await getFirmId(), sender_id: userId, recipient_id: peer, kind, payload: enc.encPayload, wrapped_key_recipient: enc.wrappedForRecipient, wrapped_key_sender: enc.wrappedForSender });
            if (ins.error) throw new Error(ins.error.message);
            if (paths.length) { const f = await supabase.from('firm_message_files').insert(paths.map((path, i) => ({ message_id: id, path, size: enc.blobs[i].size }))); if (f.error) throw new Error(f.error.message); }
        } catch (e) {
            if (paths.length) await supabase.storage.from('firm-shares').remove(paths);
            throw e;
        }
        await loadMessages(peer); await loadSummary();
    }

    async function sendText() {
        const body = text.trim();
        if (!body || !peer) return;
        if (body.length > MAX_TEXT) { setError(`Zpráva může mít nejvýše ${MAX_TEXT} znaků.`); return; }
        setBusy('text'); setError('');
        try { await send('text', { v: 1, kind: 'text', text: body }); setText(''); } catch (e) { setError(e instanceof Error ? e.message : 'Odeslání se nepovedlo.'); } finally { setBusy(''); }
    }

    async function sendAttachment() {
        setBusy('attach'); setError(''); setInfo('');
        try {
            const note = text.trim().slice(0, MAX_TEXT);
            if (attach === 'file') {
                if (!files.length) throw new Error('Vyberte alespoň jeden soubor.');
                if (files.length > 10) throw new Error('Najednou lze poslat nejvýše 10 souborů.');
                if (files.some((f) => f.size > MAX_FILE_BYTES)) throw new Error(`Soubor může mít nejvýše ${formatSize(MAX_FILE_BYTES)}.`);
                const bytes = await Promise.all(files.map(async (f) => new Uint8Array(await f.arrayBuffer())));
                await send('file', { v: 1, kind: 'file', note, files: files.map((f, i) => ({ name: f.name, size: f.size, mime: f.type, i, folder: '' })) }, bytes);
            } else if (attach === 'case') {
                if (!pick) throw new Error('Vyberte věc.');
                const prepared = await prepareCaseShare(pick, note);
                const bytes: Uint8Array[] = [];
                for (const f of prepared.files) bytes.push(await fetchCaseFileBytes(f));
                await send('case', prepared.payload, bytes);
            } else if (attach === 'client') {
                const c = clients.find((x) => x.id === pick);
                if (!c) throw new Error('Vyberte klienta.');
                await send('client', { v: 1, kind: 'client', note, client: { name: c.name, email: c.email, phone: c.phone, address: c.address ?? '', ico: c.ico ?? '', dic: c.dic ?? '', note: c.note } });
            } else if (attach === 'property') {
                const p = props.find((x) => x.id === pick);
                if (!p) throw new Error('Vyberte nemovitost.');
                await send('property', { v: 1, kind: 'property', note, label: p.label, snapshot: p.snapshot, data_as_of: p.data_as_of });
            }
            setAttach(null); setFiles([]); setText(''); setPick(''); if (fileInput.current) fileInput.current.value = '';
        } catch (e) { setError(e instanceof Error ? e.message : 'Odeslání se nepovedlo.'); } finally { setBusy(''); }
    }

    async function removeMessage(m: Msg) {
        if (!window.confirm('Smazat zprávu? Zmizí oběma.')) return;
        const { data: fs } = await supabase.from('firm_message_files').select('path').eq('message_id', m.id);
        if (fs?.length) await supabase.storage.from('firm-shares').remove(fs.map((f) => f.path as string));
        const { error: err } = await supabase.from('firm_messages').delete().eq('id', m.id);
        if (err) setError(err.message); else { setMessages((l) => l.filter((x) => x.id !== m.id)); void loadSummary(); }
    }

    // Soubor z přílohy zprávy: stažení, dešifrování a uložení do počítače
    async function downloadFile(m: Msg, key: CryptoKey, index: number, name: string) {
        setBusy(`dl-${m.id}-${index}`); setError('');
        try {
            const { data, error: err } = await supabase.storage.from('firm-shares').download(`${m.sender_id}/${m.id}/${index}.bin`);
            if (err || !data) throw new Error(err?.message ?? 'Soubor se nepodařilo stáhnout.');
            const plain = await decryptAttachment(key, new Uint8Array(await data.arrayBuffer()));
            const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([plain.buffer.slice(plain.byteOffset, plain.byteOffset + plain.byteLength) as ArrayBuffer])); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
        } catch { setError('Soubor se nepodařilo dešifrovat.'); } finally { setBusy(''); }
    }

    const peerName = (id: string) => (colleagues ?? []).find((c) => c.user_id === id)?.name || (colleagues ?? []).find((c) => c.user_id === id)?.email || 'Kolega';

    // ---------- Stav před použitím ----------
    if (colleagues === undefined) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (colleagues === null) return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <Lock size={26} className="mx-auto text-indigo-700" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-bold text-slate-900">Chat je pro členy kanceláře</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">Až se připojíte ke kanceláři (nebo ji založíte), budete si moct šifrovaně psát a posílat dokumenty i celé věci s kolegy. {keys.error}</p>
            <Link href="/kancelar/tym" className={`${primaryBtn} mt-4 inline-flex`}>Otevřít Tým</Link>
        </div>
    );
    if (!privateKey) return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><MessageSquare size={18} className="text-indigo-700" /> Šifrovaný chat kanceláře</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Zprávy, soubory i celé věci se šifrují ve vašem prohlížeči. Server, provozovatel ani vedoucí kanceláře je přečíst nemohou. Nejdřív odemkněte šifrování a zapněte sdílení.</p>
            {keys.error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{keys.error}</p>}
            {!master ? <div className="mt-4"><E2eeBox access={access} onChanged={() => window.location.reload()} /></div>
                : !myRow ? <button type="button" onClick={() => void keys.enable()} disabled={keys.busy} className={`${primaryBtn} mt-4`}>{keys.busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Zapnout šifrovaný chat</button>
                : keys.keyProblem ? <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950"><p><strong>Klíče nejdou odemknout</strong> aktuálním šifrováním (po změně hesla nebo záchranného kódu). Nové klíče vytvoříte tady, ale dříve přijaté zprávy pak nepůjde otevřít.</p><button type="button" onClick={() => { if (window.confirm('Vytvořit nové klíče? Dříve přijaté zprávy pak nepůjde otevřít.')) void keys.enable(); }} className={`${ghostBtn} mt-3`}>Vytvořit nové klíče</button></div>
                : <p className="mt-4 text-sm text-slate-500" role="status">Odemykám…</p>}
        </section>
    );

    const peerReady = !!keys.keys[peer];
    const thread = (
        <section className="flex min-h-[28rem] flex-col rounded-2xl border border-slate-200 bg-white" aria-label={peer ? `Konverzace s ${peerName(peer)}` : 'Konverzace'}>
            {!peer ? <div className="m-auto p-8 text-center text-sm text-slate-500"><MessageSquare size={26} className="mx-auto text-slate-300" aria-hidden="true" /><p className="mt-2">Vyberte kolegu a napište mu.</p></div> : (
                <>
                    <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
                        <button type="button" onClick={() => setPeer('')} aria-label="Zpět na kolegy" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 lg:hidden"><ArrowLeft size={18} /></button>
                        <div className="min-w-0 flex-1"><p className="truncate font-bold text-slate-900">{peerName(peer)}</p><p className="truncate text-xs text-slate-500">{peerReady ? <>Šifrováno end-to-end · otisk klíče <span className="font-mono">{keys.prints[peer] || '…'}</span></> : 'Kolega ještě nemá zapnutý šifrovaný chat.'}</p></div>
                    </header>
                    <div className="max-h-[32rem] min-h-[16rem] flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4" aria-live="polite">
                        {messages.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Zatím tu nic není.</p>}
                        {messages.map((m) => {
                            const mine = m.sender_id === userId; const o = opened[m.id];
                            return (
                                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`group max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-xs ${mine ? 'rounded-br-md bg-indigo-600 text-white' : 'rounded-bl-md bg-white text-slate-800'}`}>
                                        {!o ? <p className="opacity-70">Dešifruji…</p> : o === 'error' ? <p className="italic opacity-80">[nelze dešifrovat]</p> : (
                                            <Bubble m={m} payload={o.payload} k={o.key} mine={mine} fromName={peerName(m.sender_id)} userId={userId} cases={cases} loadCases={async () => { if (!cases.length) setCases(await loadCases().catch(() => [])); }} onDownload={downloadFile} busy={busy} />
                                        )}
                                        <p className={`mt-1 flex items-center justify-end gap-2 text-[10px] ${mine ? 'text-indigo-200' : 'text-slate-400'}`}>{time(m.created_at)}{mine && (m.read_at ? ' · přečteno' : '')}<button type="button" onClick={() => void removeMessage(m)} aria-label="Smazat zprávu" className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"><Trash2 size={11} /></button></p>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={bottom} />
                    </div>
                    {error && <p role="alert" className="mx-4 mt-3 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-900">{error}</p>}
                    {info && <p role="status" className="mx-4 mt-3 rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-900">{info}</p>}
                    {attach && (
                        <div className="mx-4 mt-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 text-sm">
                            <p className="font-semibold text-slate-900">Poslat: {{ file: 'soubory', case: 'celou věc (spis)', client: 'klienta', property: 'nemovitost' }[attach]}</p>
                            {attach === 'file' && <input ref={fileInput} type="file" multiple onChange={(e) => setFiles([...(e.target.files ?? [])])} className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold" />}
                            {attach === 'case' && <><select value={pick} onChange={(e) => setPick(e.target.value)} className={`${inputCls} mt-2`} aria-label="Věc"><option value="">Vyberte věc…</option>{cases.map((c) => <option key={c.id} value={c.id}>{c.title}{c.client_name ? ` · ${c.client_name}` : ''}</option>)}</select><p className="mt-2 text-xs text-slate-600">Pošle se vše ze spisu: údaje, postup, chronologie, lhůty, kontakty, uložené nemovitosti a nahrané soubory (do {formatSize(MAX_CASE_SHARE_BYTES)}). Kolega si věc převezme jako novou věc ve svém prostoru.</p></>}
                            {attach === 'client' && <select value={pick} onChange={(e) => setPick(e.target.value)} className={`${inputCls} mt-2`} aria-label="Klient"><option value="">Vyberte klienta…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
                            {attach === 'property' && <select value={pick} onChange={(e) => setPick(e.target.value)} className={`${inputCls} mt-2`} aria-label="Nemovitost"><option value="">Vyberte uloženou nemovitost…</option>{props.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>}
                            <div className="mt-3 flex gap-2"><button type="button" onClick={() => void sendAttachment()} disabled={busy === 'attach' || !peerReady} className={primaryBtn}>{busy === 'attach' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Zašifrovat a odeslat</button><button type="button" onClick={() => setAttach(null)} className={ghostBtn}>Zrušit</button></div>
                            <p className="mt-2 text-xs text-slate-500">Text napsaný níže se přidá jako zpráva k příloze.</p>
                        </div>
                    )}
                    <footer className="border-t border-slate-100 p-3">
                        <div className="mb-2 flex flex-wrap gap-1.5">
                            {([['file', 'Soubor', Paperclip], ['case', 'Věc', Briefcase], ['client', 'Klient', User], ['property', 'Nemovitost', Landmark]] as const).map(([k, label, Icon]) => <button key={k} type="button" onClick={() => void openAttach(k)} disabled={!peerReady} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${attach === k ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-300 text-slate-700 hover:bg-slate-50'} disabled:opacity-40`}><Icon size={13} aria-hidden="true" /> {label}</button>)}
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); if (attach) void sendAttachment(); else void sendText(); }} className="flex gap-2">
                            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={peerReady ? 'Napište zprávu…' : 'Kolega ještě nemá zapnutý chat'} disabled={!peerReady} maxLength={MAX_TEXT} className={inputCls} aria-label="Zpráva" />
                            <button type="submit" disabled={!peerReady || (!attach && !text.trim()) || busy === 'text' || busy === 'attach'} className={primaryBtn} aria-label="Odeslat">{busy === 'text' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
                        </form>
                    </footer>
                </>
            )}
        </section>
    );

    return (
        <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
            <aside className={`${peer ? 'hidden lg:block' : ''} rounded-2xl border border-slate-200 bg-white`} aria-label="Kolegové">
                <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900"><Building2 size={15} className="text-indigo-700" /> Kolegové</h2>
                {colleagues.length === 0 ? <p className="p-4 text-sm text-slate-500">V kanceláři zatím nejsou další členové. Pozvěte je v záložce Tým.</p> : (
                    <ul className="divide-y divide-slate-100">
                        {[...colleagues].sort((a, b) => (summary[b.user_id]?.last_at ?? '').localeCompare(summary[a.user_id]?.last_at ?? '') || a.name.localeCompare(b.name, 'cs')).map((c) => {
                            const s = summary[c.user_id];
                            return (
                                <li key={c.user_id}>
                                    <button type="button" onClick={() => { setPeer(c.user_id); setAttach(null); setError(''); setMessages([]); void loadMessages(c.user_id); }} aria-current={peer === c.user_id ? 'true' : undefined} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 ${peer === c.user_id ? 'bg-indigo-50/60' : ''}`}>
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-900">{(c.name || c.email).charAt(0).toUpperCase()}</span>
                                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{c.name || c.email}</span><span className="block truncate text-xs text-slate-500">{c.has_keys ? (s ? `${KIND_LABELS[s.last_kind]} · ${time(s.last_at)}` : 'Zatím bez zpráv') : 'chat zatím nezapnutý'}</span></span>
                                        {s && s.unread > 0 && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">{s.unread}</span>}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </aside>
            <div className={peer ? '' : 'hidden lg:block'}>{thread}</div>
        </div>
    );
}

// Jedna zpráva podle druhu: text, soubory, věc, klient, nemovitost
function Bubble({ m, payload, k, mine, fromName, userId, cases, loadCases, onDownload, busy }: { m: Msg; payload: ChatPayload; k: CryptoKey; mine: boolean; fromName: string; userId: string; cases: LegalCase[]; loadCases: () => Promise<void>; onDownload: (m: Msg, key: CryptoKey, i: number, name: string) => Promise<void>; busy: string }) {
    const [state, setState] = useState<{ msg: string; caseId?: string; working?: boolean; done?: boolean }>({ msg: '' });
    const [target, setTarget] = useState('');
    const note = 'note' in payload && payload.note ? <p className="mb-2 whitespace-pre-wrap">{payload.note}</p> : null;
    const sub = mine ? 'text-indigo-100' : 'text-slate-500';
    const button = `inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${mine ? 'border-indigo-300 text-white hover:bg-indigo-500' : 'border-slate-300 text-slate-800 hover:bg-slate-50'}`;

    if (payload.kind === 'text') return <p className="whitespace-pre-wrap break-words">{payload.text}</p>;

    if (payload.kind === 'file') return (
        <div>{note}<ul className="space-y-1.5">{payload.files.map((f) => (
            <li key={f.i} className="flex items-center gap-2"><FileText size={15} className="shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{f.name}<span className={`ml-1.5 text-xs ${sub}`}>{formatSize(f.size)}</span></span>
                <button type="button" onClick={() => void onDownload(m, k, f.i, f.name)} disabled={busy === `dl-${m.id}-${f.i}`} className={button}>{busy === `dl-${m.id}-${f.i}` ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Stáhnout</button></li>
        ))}</ul></div>
    );

    if (payload.kind === 'case') {
        const c = payload.case;
        async function take() {
            if (payload.kind !== 'case') return;
            setState({ msg: 'Přebírám…', working: true });
            try {
                const id = await importCase(userId, payload, fromName, async (i) => {
                    const { data, error } = await supabase.storage.from('firm-shares').download(`${m.sender_id}/${m.id}/${i}.bin`);
                    if (error || !data) throw new Error(error?.message ?? 'Soubor se nepodařilo stáhnout.');
                    return decryptAttachment(k, new Uint8Array(await data.arrayBuffer()));
                }, (done, total) => setState({ msg: `Soubory ${done}/${total}…`, working: true }));
                setState({ msg: 'Věc je převzata.', caseId: id, done: true });
            } catch (e) { setState({ msg: e instanceof Error ? e.message : 'Převzetí se nepovedlo.' }); }
        }
        return (
            <div className="min-w-[14rem]">{note}
                <p className="flex items-center gap-1.5 font-semibold"><Briefcase size={15} aria-hidden="true" /> {c.title}</p>
                <p className={`text-xs ${sub}`}>{[c.client_name && `klient ${c.client_name}`, c.reference, c.authority].filter(Boolean).join(' · ') || 'bez údajů o klientovi'}</p>
                {c.summary && <p className="mt-1.5 line-clamp-3 text-xs">{c.summary}</p>}
                <p className={`mt-1.5 text-xs ${sub}`}>{payload.entries.length} záznamů, {payload.deadlines.length} lhůt, {payload.contacts.length} kontaktů, {payload.properties.length} nemovitostí, {payload.files.length} souborů{payload.skippedFiles ? ` (${payload.skippedFiles} nepřiloženo)` : ''}</p>
                {!mine && (state.done ? <p className="mt-2 text-xs font-semibold">✓ {state.msg} {state.caseId && <Link href={`/kancelar/veci/${state.caseId}`} className="underline">Otevřít věc</Link>}</p> : <div className="mt-2"><button type="button" onClick={() => void take()} disabled={state.working} className={button}>{state.working ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Převzít do mých věcí</button>{state.msg && <p className="mt-1 text-xs">{state.msg}</p>}</div>)}
            </div>
        );
    }

    if (payload.kind === 'client') {
        const c = payload.client;
        return (
            <div className="min-w-[13rem]">{note}
                <p className="flex items-center gap-1.5 font-semibold"><User size={15} aria-hidden="true" /> {c.name}</p>
                <p className={`text-xs ${sub}`}>{[c.email, c.phone, c.address, c.ico && `IČO ${c.ico}`].filter(Boolean).join(' · ')}</p>
                {!mine && (state.done ? <p className="mt-2 text-xs font-semibold">✓ {state.msg}</p> : <div className="mt-2"><button type="button" onClick={async () => { try { const r = await importClient(userId, c); setState({ msg: r === 'created' ? 'Klient přidán.' : 'Údaje klienta doplněny.', done: true }); } catch (e) { setState({ msg: e instanceof Error ? e.message : 'Nepodařilo se.' }); } }} className={button}><Check size={12} /> Přidat do klientů</button>{state.msg && <p className="mt-1 text-xs">{state.msg}</p>}</div>)}
            </div>
        );
    }

    return (
        <div className="min-w-[14rem]">{note}
            <p className="flex items-center gap-1.5 font-semibold"><Landmark size={15} aria-hidden="true" /> {payload.label || snapshotLabel(payload.snapshot)}</p>
            <div className="mt-2 overflow-hidden rounded-xl text-slate-900"><PropertyCard snap={payload.snapshot} dataAsOf={payload.data_as_of || null} /></div>
            {!mine && (state.done ? <p className="mt-2 text-xs font-semibold">✓ {state.msg}</p> : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select value={target} onFocus={() => void loadCases()} onChange={(e) => setTarget(e.target.value)} aria-label="Přidat do věci" className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"><option value="">Přidat do věci…</option>{cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
                    <button type="button" disabled={!target} onClick={async () => { try { await addPropertyToCase(userId, target, { label: payload.label, snapshot: payload.snapshot, data_as_of: payload.data_as_of }); setState({ msg: 'Nemovitost přidána do věci.', done: true }); } catch (e) { setState({ msg: e instanceof Error ? e.message : 'Nepodařilo se.' }); } }} className={button}><Check size={12} /> Přidat</button>
                    {state.msg && <p className="w-full text-xs">{state.msg}</p>}
                </div>
            ))}
        </div>
    );
}
