'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, CheckCircle2, FileSignature, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { decryptBytes, encryptFile } from '@/lib/e2ee';
import { CONSENT_TEXT, LEVEL_LABEL, STATUS_LABEL, sha256Hex, type SignLevel, type SignStatus } from '@/lib/signing';
import { isAllowedUpload } from '@/lib/portal';

type Req = { id: string; title: string; kind: string; level: SignLevel; status: SignStatus; file_id: string | null; doc_sha256: string; identity_method: 'bankid' | 'lawyer' | 'none'; identity_verified: boolean; phone: string; signed_at: string | null; expires_at: string | null; created_at: string; decline_reason: string };
type List = { requests: Req[]; enabled: boolean; bankid: boolean; sms: boolean };
const btn = 'inline-flex items-center gap-2 rounded-xl bg-indigo-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-900 disabled:opacity-60 cursor-pointer';
const ghost = 'inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer';
const field = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-700/40';
const fmt = (iso: string) => new Date(iso).toLocaleString('cs-CZ');

// Dokumenty k podpisu v klientském portálu
export default function PortalSign({ token, e2ee, cryptoKey, focusId, notice }: { token: string; e2ee: boolean; cryptoKey: CryptoKey | null; focusId: string; notice: string }) {
    const [list, setList] = useState<List | null>(null);
    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/portal/${token}/sign`);
            setList(res.ok ? await res.json() as List : { requests: [], enabled: false, bankid: false, sms: false });
        } catch { setList({ requests: [], enabled: false, bankid: false, sms: false }); }
    }, [token]);
    useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

    if (!list) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (!list.enabled || list.requests.length === 0) return <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600"><h2 className="text-lg font-bold text-slate-900">Podpisy</h2><p className="mt-2">Zatím nemáte žádný dokument k podpisu.</p></section>;
    return (
        <div className="space-y-4">
            {notice && <p role="status" className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-950">{notice}</p>}
            {list.requests.map((r) => <Card key={r.id} r={r} list={list} token={token} e2ee={e2ee} cryptoKey={cryptoKey} open={r.id === focusId} reload={load} />)}
        </div>
    );
}

function Card({ r, list, token, e2ee, cryptoKey, open, reload }: { r: Req; list: List; token: string; e2ee: boolean; cryptoKey: CryptoKey | null; open: boolean; reload: () => Promise<void> }) {
    const [seen, setSeen] = useState<{ ok: boolean; url: string; pdf: boolean; name: string } | null>(null);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [code, setCode] = useState('');
    const [agree, setAgree] = useState(false);
    const [sent, setSent] = useState(false);
    const [reason, setReason] = useState('');
    const file = useRef<HTMLInputElement>(null);
    const pending = r.status === 'pending';

    async function view() {
        setBusy('view'); setError('');
        try {
            if (!r.file_id) throw new Error('K žádosti chybí dokument. Napište advokátovi.');
            if (e2ee && !cryptoKey) throw new Error('Chybí šifrovací klíč. Otevřete odkaz celý, tak jak jste ho dostali.');
            const meta = await (await fetch(`/api/portal/${token}/file/${r.file_id}?json=1`)).json() as { url?: string; name?: string; enc?: boolean };
            if (!meta.url) throw new Error('Dokument se nepodařilo načíst.');
            let bytes = new Uint8Array(await (await fetch(meta.url)).arrayBuffer());
            if (meta.enc) { if (!cryptoKey) throw new Error('Chybí šifrovací klíč.'); bytes = new Uint8Array(await decryptBytes(cryptoKey, bytes)); }
            const hash = await sha256Hex(bytes);
            const pdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
            const ok = hash === r.doc_sha256;
            setSeen({ ok, pdf, url: ok ? URL.createObjectURL(new Blob([bytes as BlobPart], { type: pdf ? 'application/pdf' : 'application/octet-stream' })) : '', name: r.title });
            if (!ok) setError('Dokument neodpovídá tomu, co advokát vložil. Nepodepisujte ho a napište advokátovi.');
        } catch (e) { setError(e instanceof Error ? e.message : 'Dokument se nepodařilo načíst.'); }
        setBusy('');
    }
    async function post(path: string, body?: unknown) {
        const res = await fetch(`/api/portal/${token}/sign/${r.id}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
        const out = await res.json().catch(() => ({})) as { message?: string; url?: string; devCode?: string };
        if (!res.ok) throw new Error(out.message ?? 'Nepodařilo se. Zkuste to prosím znovu.');
        return out;
    }
    async function identity() { setBusy('id'); setError(''); try { const o = await post('identity'); if (o.url) window.location.href = o.url; } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se.'); setBusy(''); } }
    async function sendCode() { setBusy('otp'); setError(''); setInfo(''); try { const o = await post('otp'); setSent(true); setInfo(o.devCode ? `Zkušební režim: kód je ${o.devCode}` : `Kód jsme poslali SMS na číslo ${r.phone}.`); } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se.'); } setBusy(''); }
    async function sign() { setBusy('sign'); setError(''); try { await post('sign', { code, docSha256: r.doc_sha256, agree }); await reload(); } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se.'); } setBusy(''); }
    async function decline() { setBusy('decl'); setError(''); try { await post('decline', { reason }); await reload(); } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se.'); } setBusy(''); }
    async function uploadSigned(f: File | undefined) {
        if (!f) return;
        const problem = isAllowedUpload(f.name, f.size); if (problem) { setError(problem); return; }
        setBusy('up'); setError('');
        try {
            const form = new FormData();
            if (e2ee) { if (!cryptoKey) throw new Error('Chybí šifrovací klíč.'); const { blob, encName } = await encryptFile(cryptoKey, f); form.append('file', blob, 'sifrovano.bin'); form.append('enc', '1'); form.append('encName', encName); } else form.append('file', f);
            const up = await fetch(`/api/portal/${token}/upload`, { method: 'POST', body: form });
            const out = await up.json().catch(() => ({})) as { file?: { id: string }; message?: string };
            if (!up.ok || !out.file) throw new Error(out.message ?? 'Soubor se nepodařilo nahrát.');
            await post('upload', { fileId: out.file.id }); await reload();
        } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se.'); }
        setBusy('');
    }

    const identityOk = r.identity_method !== 'bankid' || r.identity_verified;
    return (
        <section className={`rounded-2xl border bg-white p-5 shadow-xs ${open ? 'border-indigo-400' : 'border-slate-200'}`} aria-label={r.title}>
            <div className="flex flex-wrap items-start gap-3">
                <span className="rounded-xl bg-indigo-100 p-2.5 text-indigo-900"><FileSignature size={20} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1"><h2 className="text-lg font-bold text-slate-900">{r.title}</h2><p className="text-xs text-slate-500">{LEVEL_LABEL[r.level]}{r.expires_at && pending ? ` · platí do ${new Date(r.expires_at).toLocaleDateString('cs-CZ')}` : ''}</p></div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.status === 'signed' ? 'bg-emerald-100 text-emerald-900' : pending ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>{STATUS_LABEL[r.status]}</span>
            </div>

            {r.status === 'signed' && <p className="mt-3 flex items-center gap-2 text-sm text-emerald-900"><CheckCircle2 size={16} aria-hidden="true" /> Podepsáno {r.signed_at ? fmt(r.signed_at) : ''}. Doklad o podpisu má váš advokát.</p>}
            {r.status === 'declined' && <p className="mt-3 text-sm text-slate-600">Odmítli jste podpis{r.decline_reason ? `: ${r.decline_reason}` : ''}.</p>}
            {r.status === 'awaiting_check' && <p className="mt-3 text-sm text-slate-600">Podepsaný soubor jsme předali advokátovi k ověření.</p>}

            {pending && r.level === 'advanced' && (
                <ol className="mt-4 space-y-4 text-sm">
                    <li><p className="font-semibold text-slate-900">1. Přečtěte si dokument</p>
                        {!seen?.ok ? <button type="button" onClick={view} disabled={busy === 'view'} className={`${ghost} mt-2`}>{busy === 'view' && <Loader2 size={15} className="animate-spin" />} Zobrazit dokument</button> : (
                            <div className="mt-2 space-y-2">
                                {seen.pdf ? <iframe src={seen.url} title={seen.name} className="h-96 w-full rounded-xl border border-slate-200" /> : null}
                                <a href={seen.url} download={`${r.title}${seen.pdf ? '.pdf' : ''}`} className="text-sm font-semibold text-indigo-800 hover:underline">{seen.pdf ? 'Stáhnout dokument' : 'Stáhnout a otevřít dokument'}</a>
                                <p className="flex items-center gap-1.5 text-xs text-emerald-800"><ShieldCheck size={14} aria-hidden="true" /> Dokument je shodný s tím, který vložil advokát.</p>
                            </div>)}
                    </li>
                    {r.identity_method === 'bankid' && (
                        <li><p className="font-semibold text-slate-900">2. Ověřte svou totožnost</p>
                            {r.identity_verified ? <p className="mt-2 flex items-center gap-1.5 text-emerald-800"><BadgeCheck size={16} aria-hidden="true" /> Totožnost je ověřená.</p> : list.bankid
                                ? <><p className="mt-1 text-slate-600">Přihlásíte se svou bankovní identitou (Bank iD). Údaje se použijí jen k tomuto podpisu.</p><button type="button" onClick={identity} disabled={busy === 'id' || !seen?.ok} className={`${btn} mt-2`}>{busy === 'id' && <Loader2 size={15} className="animate-spin" />} Ověřit přes Bank iD</button></>
                                : <p className="mt-2 text-amber-900">Ověření přes Bank iD zatím není zapnuté. Napište advokátovi.</p>}
                        </li>)}
                    {r.identity_method === 'lawyer' && <li><p className="font-semibold text-slate-900">2. Totožnost</p><p className="mt-1 text-slate-600">Vaši totožnost ověřil advokát osobně.</p></li>}
                    <li><p className="font-semibold text-slate-900">{r.identity_method === 'none' ? '2' : '3'}. Potvrďte SMS kódem</p>
                        {list.sms && !r.phone ? <p className="mt-2 text-amber-900">U žádosti chybí telefonní číslo. Napište advokátovi.</p> : (
                            <div className="mt-2 space-y-2">
                                <label className="flex items-start gap-2 text-slate-700"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-800" /> <span>{CONSENT_TEXT}</span></label>
                                <div className="flex flex-wrap items-center gap-2">
                                    {list.sms ? <button type="button" onClick={sendCode} disabled={!seen?.ok || !identityOk || busy === 'otp'} className={ghost}>{busy === 'otp' && <Loader2 size={15} className="animate-spin" />} {sent ? 'Poslat kód znovu' : `Poslat SMS na ${r.phone}`}</button> : <p className="w-full text-slate-600">Kód vám sdělí váš advokát (telefonicky nebo osobně). Zadejte ho sem.</p>}
                                    <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="Kód z SMS" aria-label="Kód z SMS" className={`${field} max-w-40`} />
                                    <button type="button" onClick={sign} disabled={!seen?.ok || !identityOk || !agree || code.length !== 6 || busy === 'sign'} className={btn}>{busy === 'sign' && <Loader2 size={15} className="animate-spin" />} Podepsat</button>
                                </div>
                                {info && <p role="status" className="text-xs text-slate-600">{info}</p>}
                            </div>)}
                    </li>
                </ol>
            )}

            {pending && r.level === 'qualified' && (
                <div className="mt-4 space-y-2 text-sm text-slate-700">
                    <p>Tento dokument je potřeba podepsat <strong>kvalifikovaným elektronickým podpisem</strong> mimo tuto stránku (například Mobilním ID, občanským průkazem s čipem nebo u poskytovatele, kterého vám doporučí advokát). Podepsaný soubor sem pak nahrajte.</p>
                    <input ref={file} type="file" onChange={(e) => void uploadSigned(e.target.files?.[0])} className="sr-only" aria-label="Podepsaný soubor" />
                    <button type="button" onClick={() => file.current?.click()} disabled={busy === 'up'} className={btn}>{busy === 'up' ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} aria-hidden="true" />} Nahrát podepsaný dokument</button>
                </div>
            )}

            {pending && (
                <details className="mt-4 text-sm"><summary className="cursor-pointer text-xs font-semibold text-slate-500">Nechci podepsat</summary>
                    <div className="mt-2 flex flex-wrap gap-2"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={400} placeholder="Důvod (nepovinné)" className={`${field} max-w-sm`} /><button type="button" onClick={decline} disabled={busy === 'decl'} className={ghost}>Odmítnout podpis</button></div></details>
            )}
            {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-900">{error}</p>}
        </section>
    );
}
