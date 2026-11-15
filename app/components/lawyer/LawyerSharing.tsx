'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Download, FileLock2, Loader2, Lock, Send, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatSize } from '@/lib/caseFile';
import { useMasterKey } from '@/lib/useE2ee';
import { MAX_SHARE_BYTES, createMemberKeys, decryptShareFile, encryptShare, fingerprint, openShareMeta, unlockMemberKey } from '@/lib/e2eeShare';
import E2eeBox from '../situation/E2eeBox';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

type Colleague = { user_id: string; name: string; email: string; has_keys: boolean };
type KeyRow = { user_id: string; public_key: string; wrapped_private: string };
type Share = { id: string; sender_id: string; recipient_id: string; path: string; size: number; enc_name: string; enc_note: string; wrapped_key_recipient: string; wrapped_key_sender: string; created_at: string; read_at: string | null };

const when = (iso: string) => new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Šifrované předávání dokumentů mezi členy kanceláře. Server vidí jen zašifrovaná data.
export default function LawyerSharing() {
    const { userId, access } = useLawyer();
    const master = useMasterKey();
    const [colleagues, setColleagues] = useState<Colleague[] | null | undefined>(undefined);
    const [keys, setKeys] = useState<Record<string, KeyRow>>({});
    const [shares, setShares] = useState<Share[]>([]);
    const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
    const [keyProblem, setKeyProblem] = useState(false);
    const [meta, setMeta] = useState<Record<string, { name: string; note: string }>>({});
    const [prints, setPrints] = useState<Record<string, string>>({});
    const [to, setTo] = useState('');
    const [note, setNote] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [msg, setMsg] = useState('');
    const input = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        const col = await supabase.rpc('firm_colleagues');
        if (col.error) { setError(/firm_colleagues|does not exist|find the function/i.test(col.error.message) ? 'Sdílení zatím není v databázi zapnuté (chybí spuštění souboru sdileni.sql).' : col.error.message); setColleagues(null); return; }
        setColleagues((col.data as Colleague[] | null) ?? null);
        const ids = [userId, ...(((col.data as Colleague[] | null) ?? []).map((c) => c.user_id))];
        const [k, s] = await Promise.all([supabase.from('member_keys').select('user_id, public_key, wrapped_private').in('user_id', ids), supabase.from('firm_shares').select('*').order('created_at', { ascending: false })]);
        const map: Record<string, KeyRow> = {};
        for (const r of (k.data ?? []) as KeyRow[]) map[r.user_id] = r;
        setKeys(map);
        setShares((s.data ?? []) as Share[]);
        const printMap: Record<string, string> = {};
        for (const r of Object.values(map)) printMap[r.user_id] = await fingerprint(r.public_key).catch(() => '');
        setPrints(printMap);
    }, [userId]);

    useEffect(() => {
        let cancelled = false;
        void (async () => { await Promise.resolve(); if (!cancelled) await load(); })();
        return () => { cancelled = true; };
    }, [load]);

    // Soukromý klíč se odemkne hlavním klíčem
    const myRow = keys[userId];
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            if (!master || !myRow) { if (!cancelled) { setPrivateKey(null); setKeyProblem(false); } return; }
            try { const k = await unlockMemberKey(master, myRow.wrapped_private); if (!cancelled) { setPrivateKey(k); setKeyProblem(false); } } catch { if (!cancelled) { setPrivateKey(null); setKeyProblem(true); } }
        })();
        return () => { cancelled = true; };
    }, [master, myRow]);

    // Názvy a poznámky se dešifrují jen u mě
    useEffect(() => {
        if (!privateKey) return;
        let cancelled = false;
        void (async () => {
            const out: Record<string, { name: string; note: string }> = {};
            for (const s of shares) {
                try { out[s.id] = await openShareMeta(privateKey, s.recipient_id === userId ? s.wrapped_key_recipient : s.wrapped_key_sender, s.enc_name, s.enc_note); } catch { out[s.id] = { name: '[nelze dešifrovat]', note: '' }; }
            }
            if (!cancelled) setMeta(out);
        })();
        return () => { cancelled = true; };
    }, [privateKey, shares, userId]);

    async function enable() {
        if (!master) return;
        setBusy('keys'); setError('');
        try {
            const created = await createMemberKeys(master);
            const { error: err } = await supabase.from('member_keys').upsert({ user_id: userId, public_key: created.publicKey, wrapped_private: created.wrappedPrivate });
            if (err) throw new Error(err.message);
            await load();
        } catch (e) { setError(e instanceof Error ? e.message : 'Klíče se nepodařilo vytvořit.'); } finally { setBusy(''); }
    }

    async function send() {
        const recipient = keys[to];
        if (!recipient || !myRow || !privateKey) { setError('Vyberte kolegu, který má zapnuté sdílení.'); return; }
        if (!files.length) { setError('Vyberte alespoň jeden soubor.'); return; }
        if (files.some((f) => f.size > MAX_SHARE_BYTES)) { setError(`Soubor může mít nejvýše ${formatSize(MAX_SHARE_BYTES)}.`); return; }
        setBusy('send'); setError(''); setMsg('');
        try {
            const { data: firmRow } = await supabase.from('firm_members').select('firm_id').eq('user_id', userId).maybeSingle();
            if (!firmRow) throw new Error('Nejste členem kanceláře.');
            for (const file of files) {
                const enc = await encryptShare(file, note, recipient.public_key, myRow.public_key);
                const path = `${userId}/${crypto.randomUUID()}.bin`;
                const up = await supabase.storage.from('firm-shares').upload(path, enc.blob, { contentType: 'application/octet-stream' });
                if (up.error) throw new Error(up.error.message);
                const ins = await supabase.from('firm_shares').insert({ firm_id: (firmRow as { firm_id: string }).firm_id, sender_id: userId, recipient_id: to, path, size: enc.blob.size, enc_name: enc.encName, enc_note: enc.encNote, wrapped_key_recipient: enc.wrappedForRecipient, wrapped_key_sender: enc.wrappedForSender });
                if (ins.error) { await supabase.storage.from('firm-shares').remove([path]); throw new Error(ins.error.message); }
            }
            setMsg(`Odesláno (${files.length}), zašifrováno.`);
            setFiles([]); setNote(''); if (input.current) input.current.value = '';
            await load();
        } catch (e) { setError(e instanceof Error ? e.message : 'Odeslání se nepovedlo.'); } finally { setBusy(''); }
    }

    async function download(s: Share) {
        if (!privateKey) return;
        setBusy(`dl-${s.id}`); setError('');
        try {
            const { data, error: err } = await supabase.storage.from('firm-shares').download(s.path);
            if (err || !data) throw new Error(err?.message ?? 'Soubor se nepodařilo stáhnout.');
            const name = meta[s.id]?.name ?? 'soubor';
            const blob = await decryptShareFile(privateKey, s.recipient_id === userId ? s.wrapped_key_recipient : s.wrapped_key_sender, new Uint8Array(await data.arrayBuffer()), name);
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
            if (s.recipient_id === userId && !s.read_at) { await supabase.rpc('mark_share_read', { p_id: s.id }); setShares((l) => l.map((x) => (x.id === s.id ? { ...x, read_at: new Date().toISOString() } : x))); }
        } catch { setError('Soubor se nepodařilo dešifrovat. Ověřte, že máte odemčené šifrování.'); } finally { setBusy(''); }
    }

    async function remove(s: Share) {
        if (!window.confirm('Smazat sdílený soubor? Zmizí odesílateli i příjemci.')) return;
        await supabase.storage.from('firm-shares').remove([s.path]);
        const { error: err } = await supabase.from('firm_shares').delete().eq('id', s.id);
        if (err) setError(err.message); else setShares((l) => l.filter((x) => x.id !== s.id));
    }

    const nameOf = (id: string) => (id === userId ? 'Já' : (colleagues ?? []).find((c) => c.user_id === id)?.name ?? 'Kolega');
    const received = shares.filter((s) => s.recipient_id === userId);
    const sent = shares.filter((s) => s.sender_id === userId);
    const ready = !!privateKey;

    if (colleagues === undefined) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (colleagues === null) return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <Lock size={26} className="mx-auto text-indigo-700" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-bold text-slate-900">Sdílení je pro členy kanceláře</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">Až se připojíte ke kanceláři (nebo ji založíte), budete si moct šifrovaně posílat dokumenty s kolegy. {error}</p>
            <Link href="/kancelar/tym" className={`${primaryBtn} mt-4 inline-flex`}>Otevřít Tým</Link>
        </div>
    );

    return (
        <div className="space-y-5">
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            {msg && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{msg}</p>}

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><FileLock2 size={18} className="text-indigo-700" /> Šifrované sdílení v kanceláři</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Soubor se zašifruje ve vašem prohlížeči a otevře ho jen vybraný kolega. Server, provozovatel ani vedoucí kanceláře ho přečíst nemohou. Smazáním soubor zmizí odesílateli i příjemci.</p>
                {!master ? <div className="mt-4"><E2eeBox access={access} onChanged={() => window.location.reload()} /></div>
                    : !myRow ? <button type="button" onClick={() => void enable()} disabled={busy === 'keys'} className={`${primaryBtn} mt-4`}>{busy === 'keys' ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Zapnout sdílení</button>
                    : keyProblem ? (
                        <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
                            <p><strong>Klíče pro sdílení nejdou odemknout</strong> aktuálním šifrováním (po změně hesla nebo záchranného kódu). Nové klíče vytvoříte tady, ale dříve přijaté soubory pak nepůjde otevřít.</p>
                            <button type="button" onClick={() => { if (window.confirm('Vytvořit nové klíče? Dříve přijaté soubory pak nepůjde otevřít.')) void enable(); }} className={`${ghostBtn} mt-3`}>Vytvořit nové klíče</button>
                        </div>
                    ) : <p className="mt-3 text-xs text-slate-500">Otisk vašeho klíče: <span className="font-mono text-slate-700">{prints[userId] || '…'}</span> (kolega si ho může ověřit po telefonu).</p>}
            </section>

            {ready && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Poslat soubor">
                    <h2 className="text-lg font-bold text-slate-900">Poslat soubor kolegovi</h2>
                    {colleagues.length === 0 ? <p className="mt-2 text-sm text-slate-600">V kanceláři zatím nejsou další členové. Pozvěte je v záložce Tým.</p> : (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className="block text-xs font-semibold text-slate-600">Komu
                                <select value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} mt-1 font-normal`}>
                                    <option value="">Vyberte kolegu…</option>
                                    {colleagues.map((c) => <option key={c.user_id} value={c.user_id} disabled={!c.has_keys}>{c.name || c.email}{c.has_keys ? '' : ' (ještě nemá zapnuté sdílení)'}</option>)}
                                </select>
                            </label>
                            <label className="block text-xs font-semibold text-slate-600">Soubory (do {formatSize(MAX_SHARE_BYTES)})<input ref={input} type="file" multiple onChange={(e) => setFiles([...(e.target.files ?? [])])} className="mt-1 block w-full text-sm font-normal file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold" /></label>
                            <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">Zpráva (nepovinné, také šifrovaná)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className={`${inputCls} mt-1 font-normal`} placeholder="např. Prosím o kontrolu před odesláním" /></label>
                            {to && prints[to] && <p className="text-xs text-slate-500 sm:col-span-2">Otisk klíče příjemce: <span className="font-mono text-slate-700">{prints[to]}</span>. Chcete-li mít jistotu, že posíláte opravdu jemu, porovnejte ho s ním po telefonu.</p>}
                            <div className="sm:col-span-2"><button type="button" onClick={() => void send()} disabled={busy === 'send' || !to || !files.length} className={primaryBtn}>{busy === 'send' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Zašifrovat a odeslat</button></div>
                        </div>
                    )}
                </section>
            )}

            {([['Přijaté', received, true], ['Odeslané', sent, false]] as const).map(([title, list, isInbox]) => (
                <section key={title} aria-label={title}>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">{title} ({list.length}){isInbox && list.some((s) => !s.read_at) && <span className="ml-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] text-white">{list.filter((s) => !s.read_at).length} nové</span>}</h2>
                    {list.length === 0 ? <p className="mt-2 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">{isInbox ? 'Zatím vám nikdo nic neposlal.' : 'Zatím jste nic neposlali.'}</p> : (
                        <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                            {list.map((s) => (
                                <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-slate-900">{ready ? (meta[s.id]?.name ?? '…') : 'Šifrovaný soubor'}{isInbox && !s.read_at && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-900">nové</span>}</p>
                                        <p className="text-xs text-slate-500">{isInbox ? `od ${nameOf(s.sender_id)}` : `pro ${nameOf(s.recipient_id)}${s.read_at ? ` · přečteno ${when(s.read_at)}` : ' · zatím nepřečteno'}`} · {when(s.created_at)} · {formatSize(s.size)}</p>
                                        {meta[s.id]?.note && <p className="mt-1 text-sm text-slate-700">„{meta[s.id].note}“</p>}
                                    </div>
                                    <button type="button" onClick={() => void download(s)} disabled={!ready || busy === `dl-${s.id}`} className={ghostBtn}>{busy === `dl-${s.id}` ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Stáhnout</button>
                                    <button type="button" onClick={() => void remove(s)} aria-label="Smazat" className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50"><Trash2 size={15} /></button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            ))}
        </div>
    );
}
