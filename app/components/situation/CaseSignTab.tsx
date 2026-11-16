'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, Download, FileSignature, KeyRound, Loader2, Plus, ShieldCheck, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { encryptFile } from '@/lib/e2ee';
import { fetchDecrypted } from '@/lib/e2eeFiles';
import { insertRow, safeFileName, updateRow, uploadCaseFile, type CaseFile } from '@/lib/caseFile';
import { isAllowedUpload } from '@/lib/portal';
import { KINDS, LEVEL_LABEL, STATUS_LABEL, defaultLevel, normalizePhone, sha256Hex, type Evidence, type IdentityMethod, type SignKind, type SignLevel, type SignStatus } from '@/lib/signing';
import { buildSignedPdf } from '@/lib/signedPdf';
import { ghostBtn, inputCls, primaryBtn, type TabProps } from './caseUi';
import { useChannelKey, useDecryptedNames } from './useChannelKey';

type Req = { id: string; file_id: string | null; title: string; kind: SignKind; level: SignLevel; identity_method: IdentityMethod; identity_note: string; doc_sha256: string; signer_name: string; signer_phone: string; status: SignStatus; expires_at: string | null; signed_at: string | null; evidence: Evidence | null; evidence_seal: string | null; external_file_id: string | null; decline_reason: string; created_at: string };
type LinkInfo = { id: string; e2ee: boolean; client_name: string; client_phone: string };
const fmt = (iso: string) => new Date(iso).toLocaleString('cs-CZ');

// Žádosti o podpis dokumentů klientem v portálu
export default function CaseSignTab({ item, bundle, userId, setBundle, fail }: TabProps) {
    const channel = useChannelKey(item.id);
    const names = useDecryptedNames(bundle.files, channel.key);
    const [link, setLink] = useState<LinkInfo | null | undefined>(undefined);
    const [rows, setRows] = useState<Req[]>([]);
    const [enabled, setEnabled] = useState(true);
    const [busy, setBusy] = useState('');
    const [msg, setMsg] = useState('');
    const [open, setOpen] = useState(false);
    const [f, setF] = useState({ kind: 'smlouva' as SignKind, title: '', name: item.client_name ?? '', phone: item.client_phone ?? '', identity: 'lawyer' as IdentityMethod, note: '', days: 14 });
    const [file, setFile] = useState<File | null>(null);
    const picker = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        const [l, r] = await Promise.all([
            supabase.from('client_links').select('id, e2ee, client_name, client_phone').eq('case_id', item.id).eq('revoked', false).order('created_at', { ascending: false }).limit(1),
            supabase.from('signature_requests').select('*').eq('case_id', item.id).order('created_at', { ascending: false }),
        ]);
        if (r.error) { setEnabled(false); return; }
        const current = ((l.data ?? [])[0] as LinkInfo | undefined) ?? null;
        setLink(current); setRows((r.data ?? []) as Req[]);
        if (current) setF((x) => ({ ...x, name: x.name || current.client_name || '', phone: x.phone || current.client_phone || '' }));
    }, [item.id]);
    useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

    const shown = (cf: CaseFile) => (cf.enc ? (names[cf.id] ?? 'Šifrovaný soubor') : cf.name);
    async function bytesOf(cf: CaseFile): Promise<Uint8Array> {
        if (cf.enc) { if (!channel.key) throw new Error('Nejdřív odemkněte šifrování v záložce Klient.'); return fetchDecrypted(cf.path, channel.key); }
        const { data, error } = await supabase.storage.from('case-files').download(cf.path);
        if (error || !data) throw new Error(error?.message ?? 'Soubor se nepodařilo stáhnout.');
        return new Uint8Array(await data.arrayBuffer());
    }
    const save = (bytes: Uint8Array, name: string, type: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000); };
    async function run(key: string, fn: () => Promise<void>) { setBusy(key); setMsg(''); try { await fn(); } catch (e) { fail(e); } setBusy(''); }

    async function create(e: React.FormEvent) {
        e.preventDefault();
        if (!link || !file) return;
        await run('create', async () => {
            const problem = isAllowedUpload(file.name, file.size); if (problem) throw new Error(problem);
            if (f.phone.trim() && !normalizePhone(f.phone)) throw new Error('Telefon nevypadá správně.');
            if (f.identity === 'lawyer' && f.note.trim().length < 3) throw new Error('U osobního ověření uveďte, jak jste totožnost ověřili (např. doklad, datum).');
            const hash = await sha256Hex(new Uint8Array(await file.arrayBuffer()));
            let row: CaseFile;
            if (link.e2ee) {
                if (!channel.key) throw new Error('Nejdřív odemkněte šifrování v záložce Klient.');
                const { blob, encName } = await encryptFile(channel.key, file);
                const path = `${userId}/${item.id}/${crypto.randomUUID()}-${safeFileName('sifrovano')}.bin`;
                const up = await supabase.storage.from('case-files').upload(path, blob, { contentType: 'application/octet-stream' });
                if (up.error) throw new Error(up.error.message);
                row = await insertRow<CaseFile>('case_files', { case_id: item.id, user_id: userId, name: encName, path, size: blob.size, mime: '', source: 'lawyer', client_visible: true, enc: true });
            } else {
                row = await uploadCaseFile(userId, item.id, null, file);
                await updateRow('case_files', row.id, { client_visible: true, source: 'lawyer' }); row = { ...row, client_visible: true, source: 'lawyer' };
            }
            const level = defaultLevel(f.kind);
            const { error } = await supabase.from('signature_requests').insert({ user_id: userId, case_id: item.id, file_id: row.id, title: f.title.trim() || KINDS[f.kind].label, kind: f.kind, level, identity_method: level === 'advanced' ? f.identity : 'none', identity_note: f.note.trim(), doc_sha256: hash, signer_name: f.name.trim(), signer_phone: level === 'advanced' ? (normalizePhone(f.phone) ?? '') : '', expires_at: new Date(Date.now() + f.days * 86_400_000).toISOString() });
            if (error) throw new Error(error.message);
            setBundle((b) => ({ ...b, files: [row, ...b.files] }));
            setFile(null); setOpen(false); setF((x) => ({ ...x, title: '' })); setMsg('Žádost je odeslána do klientské stránky. Klient ji uvidí v záložce Podpisy.');
            await load();
        });
    }

    async function signedPdf(r: Req) {
        await run(`pdf-${r.id}`, async () => {
            if (!r.evidence || !r.evidence_seal) throw new Error('Žádost není podepsaná.');
            const cf = bundle.files.find((x) => x.id === r.file_id);
            const original = cf ? await bytesOf(cf) : null;
            const out = await buildSignedPdf(original, r.evidence, r.evidence_seal);
            save(out.bytes, `${safeFileName(r.title)}-podepsano.pdf`, 'application/pdf');
            if (!out.withOriginal) setMsg('Původní dokument není PDF. Stáhl se samostatný doklad o podpisu; původní soubor zůstává ve spisu.');
        });
    }
    async function verify(r: Req) {
        await run(`ver-${r.id}`, async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/sign/verify', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ id: r.id }) });
            const out = await res.json().catch(() => ({})) as { intact?: boolean };
            if (!res.ok) throw new Error('Pečeť se nepodařilo ověřit.');
            setMsg(out.intact ? 'Pečeť souhlasí: doklad o podpisu nebyl po podpisu změněn.' : 'POZOR: pečeť nesouhlasí, doklad byl změněn nebo poškozen.');
        });
    }
    async function giveCode(r: Req) {
        await run(`code-${r.id}`, async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/sign/code', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ id: r.id }) });
            const out = await res.json().catch(() => ({})) as { code?: string; minutes?: number };
            if (!res.ok || !out.code) throw new Error('Kód se nepodařilo vytvořit.');
            setMsg(`Kód pro klienta: ${out.code} (platí ${out.minutes} minut). Sdělte mu ho telefonicky nebo osobně, až bude mít dokument přečtený. Po zavření této zprávy už ho nezobrazíme.`);
        });
    }
    async function setStatus(r: Req, status: SignStatus) { await run(`st-${r.id}`, async () => { const { error } = await supabase.from('signature_requests').update({ status }).eq('id', r.id); if (error) throw new Error(error.message); await load(); }); }
    async function remove(r: Req) { if (!window.confirm('Smazat žádost o podpis?')) return; await run(`del-${r.id}`, async () => { const { error } = await supabase.from('signature_requests').delete().eq('id', r.id); if (error) throw new Error(error.message); await load(); }); }

    if (!enabled) return <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">Podpisy zatím nejsou v databázi zapnuté (chybí spuštění souboru podpisy-a-aml.sql).</p>;
    const advanced = defaultLevel(f.kind) === 'advanced';
    return (
        <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center gap-3">
                    <h2 className="flex flex-1 items-center gap-2 text-lg font-bold text-slate-900"><FileSignature size={18} className="text-indigo-700" aria-hidden="true" /> Podpisy dokumentů</h2>
                    {link && <button type="button" onClick={() => setOpen((v) => !v)} className={primaryBtn}><Plus size={15} /> Nová žádost o podpis</button>}
                </div>
                <p className="mt-1 text-sm text-slate-600">Klient dokument v portálu přečte, potvrdí jednorázovým kódem (SMS, nebo kódem od vás) a vznikne doklad o podpisu s časem, otiskem dokumentu a IP adresou.</p>
                {link === null && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Nejdřív vytvořte klientskou stránku v záložce Klient. Podpis probíhá přes ni.</p>}
                {msg && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{msg}</p>}
                {open && link && (
                    <form onSubmit={create} className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4">
                        <label className="block text-xs font-semibold text-slate-600">Druh dokumentu<select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as SignKind })} className={`${inputCls} mt-1 font-normal`}>{(Object.keys(KINDS) as SignKind[]).map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}</select></label>
                        <p className={`rounded-lg p-2.5 text-xs ${advanced ? 'bg-indigo-50 text-indigo-950' : 'bg-amber-50 text-amber-950'}`}><strong>{LEVEL_LABEL[defaultLevel(f.kind)]}.</strong> {KINDS[f.kind].note}{!advanced && ' Klient podepíše mimo aplikaci a podepsaný soubor sem nahraje, vy jeho platnost ověříte.'}</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block text-xs font-semibold text-slate-600">Název pro klienta<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={KINDS[f.kind].label} maxLength={200} className={`${inputCls} mt-1 font-normal`} /></label>
                            <label className="block text-xs font-semibold text-slate-600">Platnost žádosti (dny)<input type="number" min={1} max={90} value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) || 14 })} className={`${inputCls} mt-1 font-normal`} /></label>
                            <label className="block text-xs font-semibold text-slate-600">Jméno podepisujícího<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={`${inputCls} mt-1 font-normal`} /></label>
                            {advanced && <label className="block text-xs font-semibold text-slate-600">Telefon (jen pro SMS kód, je-li zapnutá SMS brána)<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" placeholder="777 123 456" className={`${inputCls} mt-1 font-normal`} /></label>}
                        </div>
                        {advanced && (
                            <fieldset className="space-y-1.5 text-sm"><legend className="text-xs font-semibold text-slate-600">Ověření totožnosti</legend>
                                {([['lawyer', 'Totožnost jsem ověřil osobně (doklad totožnosti)'], ['bankid', 'Klient se ověří přes Bank iD (vyžaduje zapnutý Bank iD)'], ['none', 'Neověřovat (jen SMS kód, nejnižší jistota)']] as const).map(([v, label]) => <label key={v} className="flex items-center gap-2"><input type="radio" name="idm" checked={f.identity === v} onChange={() => setF({ ...f, identity: v })} className="accent-indigo-800" /> {label}</label>)}
                                {f.identity === 'lawyer' && <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Jak jste ověřili (např. OP č. …, dne …)" maxLength={400} className={inputCls} />}
                            </fieldset>)}
                        <div className="flex flex-wrap items-center gap-2">
                            <input ref={picker} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="sr-only" aria-label="Dokument k podpisu" />
                            <button type="button" onClick={() => picker.current?.click()} className={ghostBtn}>{file ? file.name : 'Vybrat dokument (nejlépe PDF)'}</button>
                            <button type="submit" disabled={!file || busy === 'create'} className={primaryBtn}>{busy === 'create' && <Loader2 size={15} className="animate-spin" />} Odeslat klientovi</button>
                        </div>
                        <p className="text-xs text-slate-500">Dokument se k žádosti uloží, klient ho uvidí jen ve svém portálu. Po odeslání se dokument nemění; případnou opravu pošlete jako novou žádost.</p>
                    </form>)}
            </section>

            {rows.length > 0 && (
                <ul className="space-y-3">
                    {rows.map((r) => { const cf = bundle.files.find((x) => x.id === r.file_id); const ext = bundle.files.find((x) => x.id === r.external_file_id); return (
                        <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                                <strong className="flex-1 text-slate-900">{r.title}</strong>
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${r.status === 'signed' ? 'bg-emerald-100 text-emerald-900' : r.status === 'pending' || r.status === 'awaiting_check' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>{STATUS_LABEL[r.status]}</span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{LEVEL_LABEL[r.level]} · {r.signer_name || 'bez jména'} · vytvořeno {fmt(r.created_at)}{r.expires_at && r.status === 'pending' ? ` · platí do ${new Date(r.expires_at).toLocaleDateString('cs-CZ')}` : ''}</p>
                            {r.status === 'declined' && r.decline_reason && <p className="mt-1 text-xs text-slate-600">Důvod odmítnutí: {r.decline_reason}</p>}
                            {r.status === 'signed' && r.evidence && <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-900"><BadgeCheck size={14} aria-hidden="true" /> Podepsáno {r.signed_at ? fmt(r.signed_at) : ''}{r.evidence.identity.method === 'bankid' ? ` · ověřeno přes Bank iD (${r.evidence.signer.name})` : r.evidence.identity.method === 'lawyer' ? ' · totožnost ověřena advokátem' : ' · totožnost neověřována'} · IP {r.evidence.ip}</p>}
                            <div className="mt-3 flex flex-wrap gap-2">
                                {r.status === 'signed' && r.evidence && <button type="button" onClick={() => void signedPdf(r)} disabled={busy === `pdf-${r.id}`} className={ghostBtn}>{busy === `pdf-${r.id}` ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Podepsané PDF s dokladem</button>}
                                {r.status === 'signed' && r.evidence && <button type="button" onClick={() => void verify(r)} disabled={busy === `ver-${r.id}`} className={ghostBtn}><ShieldCheck size={14} /> Ověřit pečeť</button>}
                                {r.status === 'awaiting_check' && ext && <button type="button" onClick={() => void run(`ext-${r.id}`, async () => save(await bytesOf(ext), shown(ext), 'application/octet-stream'))} className={ghostBtn}><Download size={14} /> Stáhnout podepsaný soubor</button>}
                                {r.status === 'awaiting_check' && <><button type="button" onClick={() => void setStatus(r, 'signed')} className={primaryBtn}>Ověřil jsem podpis</button><button type="button" onClick={() => void setStatus(r, 'declined')} className={ghostBtn}>Podpis je neplatný</button></>}
                                {r.status === 'pending' && r.level === 'advanced' && <button type="button" onClick={() => void giveCode(r)} disabled={busy === `code-${r.id}`} className={ghostBtn}><KeyRound size={14} /> Vytvořit kód pro klienta</button>}
                                {r.status === 'pending' && <button type="button" onClick={() => void setStatus(r, 'cancelled')} className={ghostBtn}><X size={14} /> Zrušit žádost</button>}
                                {r.status !== 'signed' && <button type="button" onClick={() => void remove(r)} className={ghostBtn}>Smazat</button>}
                                {cf && r.status !== 'signed' && <button type="button" onClick={() => void run(`orig-${r.id}`, async () => save(await bytesOf(cf), shown(cf), 'application/octet-stream'))} className={ghostBtn}>Stáhnout dokument</button>}
                            </div>
                            {r.status === 'awaiting_check' && <p className="mt-2 text-xs text-amber-900">Aplikace platnost kvalifikovaného podpisu neověřuje. Ověřte podpis sami (např. v ověřovači elektronických podpisů) a teprve potom potvrďte.</p>}
                        </li>); })}
                </ul>)}
        </div>
    );
}
