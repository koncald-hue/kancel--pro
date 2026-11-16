'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Download, Inbox, KeyRound, Loader2, Lock, Mail, Paperclip, Plug, Plus, Search, Send, Smartphone, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { decryptText, encryptText } from '@/lib/e2ee';
import { useMasterKey } from '@/lib/useE2ee';
import { loadCases, type LegalCase } from '@/lib/cases';
import { insertRow, safeFileName, uploadCaseFile } from '@/lib/caseFile';
import { STATUS_LABELS, type BoxHit, type Downloaded, type IsdsEnv, type Record_ } from '@/lib/isds';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

type Account = { id: string; label: string; env: IsdsEnv; enc_cred: string };
type Cred = { login: string; password: string; method?: 'password' | 'mobile_key' };
type ApiRes = { ok: boolean; status: number; json: Record<string, unknown> };
type Caller = (body: Record<string, unknown>) => Promise<ApiRes>;
type Tab = 'received' | 'sent';

const MAX_SEND = 10 * 1024 * 1024;
const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} kB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
const fmtTime = (iso: string) => (iso ? new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–');

async function api(body: Record<string, unknown>): Promise<ApiRes> {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/isds', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify(body) });
    return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) as Record<string, unknown> };
}
const errText = (r: { status: number; json: Record<string, unknown> }) => (typeof r.json.message === 'string' ? r.json.message : r.status === 429 ? 'Příliš mnoho dotazů, zkuste to za chvíli.' : r.status === 403 ? 'Přístup je zamčený.' : 'Operace se nepodařila.');


const SESSION_MS = 25 * 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Přihlášení Mobilním klíčem: odeslání požadavku, čekání na potvrzení v telefonu (až 2,5 minuty), získání relace
async function mkLogin(env: IsdsEnv, cred: Cred, onWait: (w: boolean) => void): Promise<{ ok: true; session: string } | { ok: false; res: ApiRes }> {
    const start = await api({ action: 'mk_start', env, login: cred.login, password: cred.password });
    if (!start.ok) return { ok: false, res: start };
    const sCookie = String(start.json.sCookie ?? '');
    onWait(true);
    try {
        for (let i = 0; i < 75; i++) {
            await sleep(2000);
            const st = await api({ action: 'mk_poll', env, sCookie });
            const state = String(st.json.state ?? '');
            if (state === 'confirmed') break;
            if (state === 'expired' || state === 'error' || i === 74) return { ok: false, res: { ok: false, status: 408, json: { message: state === 'expired' ? 'Potvrzení v aplikaci Mobilní klíč vypršelo. Zkuste to znovu.' : 'Přihlášení nebylo potvrzeno v aplikaci Mobilní klíč.' } } };
        }
    } finally { onWait(false); }
    const fin = await api({ action: 'mk_finish', env, login: cred.login, password: cred.password, sCookie });
    return fin.ok ? { ok: true, session: String(fin.json.session ?? '') } : { ok: false, res: fin };
}

// Volání datových schránek s doplněním přihlášení; u Mobilního klíče se relace drží v paměti (platí 30 minut) a sama se obnoví
function useCaller(env: IsdsEnv, cred: Cred): { call: Caller; waiting: boolean } {
    const sess = useRef<{ value: string; at: number } | null>(null);
    const pending = useRef<Promise<{ ok: true; session: string } | { ok: false; res: ApiRes }> | null>(null);
    const [waiting, setWaiting] = useState(false);
    useEffect(() => () => { if (sess.current) void api({ action: 'mk_end', env, session: sess.current.value }); }, [env]);
    const call = useCallback<Caller>(async (body) => {
        if (cred.method !== 'mobile_key') return api({ ...body, env, login: cred.login, password: cred.password });
        if (!sess.current || Date.now() - sess.current.at > SESSION_MS) {
            pending.current ??= mkLogin(env, cred, setWaiting).finally(() => { pending.current = null; });
            const r = await pending.current;
            if (!r.ok) return r.res;
            sess.current = { value: r.session, at: Date.now() };
        }
        const res = await api({ ...body, env, session: sess.current.value });
        if (res.status === 401) sess.current = null;
        return res;
    }, [env, cred]);
    return { call, waiting };
}

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] ?? ''); r.onerror = () => reject(new Error('Soubor se nepodařilo načíst.')); r.readAsDataURL(file); });
const fromBase64 = (b64: string, mime: string, name: string) => { const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new File([bytes], name, { type: mime || 'application/octet-stream' }); };

// Datová schránka: příjem zpráv, uložení příloh do věci a odesílání. Přihlašovací údaje jsou zašifrované vaším šifrovacím heslem.
export default function LawyerDataBox() {
    const { userId } = useLawyer();
    const master = useMasterKey();
    const [accounts, setAccounts] = useState<Account[] | null | undefined>(undefined);
    const [creds, setCreds] = useState<Record<string, Cred>>({});
    const [activeId, setActiveId] = useState('');
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        const { data, error: err } = await supabase.from('isds_accounts').select('*').order('created_at');
        if (err) { setAccounts(null); setError(/isds_accounts|schema cache|does not exist/i.test(err.message) ? 'Datové schránky zatím nejsou v databázi zapnuté (chybí spuštění souboru datove-schranky.sql).' : err.message); return; }
        setAccounts((data ?? []) as Account[]);
    }, []);
    useEffect(() => { let alive = true; Promise.resolve().then(() => { if (alive) void load(); }); return () => { alive = false; }; }, [load]);

    // Po odemčení šifrovacího hesla se údaje ke schránkám dešifrují (jen v paměti prohlížeče)
    useEffect(() => {
        if (!master || !accounts?.length) return;
        let alive = true;
        (async () => {
            const out: Record<string, Cred> = {};
            for (const a of accounts) { try { out[a.id] = JSON.parse(await decryptText(master, a.enc_cred)) as Cred; } catch { /* nelze dešifrovat */ } }
            if (alive) setCreds(out);
        })();
        return () => { alive = false; };
    }, [master, accounts]);

    if (accounts === undefined) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (accounts === null) return <p role="alert" className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">{error}</p>;

    if (!master) return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <KeyRound size={26} className="text-indigo-700" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-bold text-slate-900">Nejdřív odemkněte šifrovací heslo</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Přihlašovací údaje k datové schránce jsou uložené zašifrované vaším šifrovacím heslem, takže je nikdo jiný (ani provozovatel služby) nepřečte. Odemkněte ho v Nastavení a vraťte se sem.</p>
            <a href="/kancelar/nastaveni" className={`${primaryBtn} mt-4`}>Otevřít Nastavení</a>
        </div>
    );

    const account = accounts.find((a) => a.id === activeId) ?? accounts[0];
    const cred = account ? creds[account.id] : undefined;

    return (
        <div className="space-y-5">
            {accounts.length === 0
                ? <Connect master={master} onDone={async () => { await load(); }} first />
                : (
                    <>
                        <div className="flex flex-wrap items-center gap-2">
                            {accounts.map((a) => <button key={a.id} type="button" onClick={() => setActiveId(a.id)} aria-pressed={account?.id === a.id} className={`rounded-full border px-4 py-1.5 text-sm font-semibold cursor-pointer ${account?.id === a.id ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{a.label}{a.env === 'test' ? ' (test)' : ''}</button>)}
                            <ConnectMore master={master} onDone={load} />
                        </div>
                        {account && !cred && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">Přihlašovací údaje k této schránce se nepodařilo dešifrovat. Odemkněte správné šifrovací heslo, nebo schránku odpojte a připojte znovu.</p>}
                        {account && cred && <Box key={account.id} account={account} cred={cred} userId={userId} onRemove={async () => { await supabase.from('isds_accounts').delete().eq('id', account.id); setActiveId(''); await load(); }} />}
                    </>
                )}
            <p className="text-xs leading-relaxed text-slate-500">Přihlášení: jméno a heslo do datové schránky (účet musí mít povolený přístup přes aplikace; u účtů s dvoufázovým přihlášením to nemusí fungovat). Zprávy se do Kanceláře neukládají, přenesou se jen přílohy, které sami uložíte do věci. Stažení zprávy, která ještě nebyla doručena, ji doručí a spustí zákonné lhůty.</p>
        </div>
    );
}

function Connect({ master, onDone, first }: { master: CryptoKey; onDone: () => Promise<void>; first?: boolean }) {
    const [form, setForm] = useState({ label: '', env: 'prod' as IsdsEnv, login: '', password: '', method: 'password' as 'password' | 'mobile_key' });
    const [waiting, setWaiting] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    async function save(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true); setError('');
        // Nejdřív zkouška přihlášení, ať se neuloží chybné údaje
        const cred: Cred = { login: form.login.trim(), password: form.password, method: form.method };
        if (form.method === 'mobile_key') {
            const r = await mkLogin(form.env, cred, setWaiting);
            if (!r.ok) { setBusy(false); setError(errText(r.res)); return; }
            void api({ action: 'mk_end', env: form.env, session: r.session });
        } else {
            const test = await api({ action: 'list', env: form.env, login: cred.login, password: cred.password, received: true });
            if (!test.ok) { setBusy(false); setError(errText(test)); return; }
        }
        const { data: { user } } = await supabase.auth.getUser();
        const enc = await encryptText(master, JSON.stringify({ login: form.login.trim(), password: form.password, method: form.method }));
        const { error: err } = await supabase.from('isds_accounts').insert({ user_id: user?.id, label: form.label.trim() || 'Moje datová schránka', env: form.env, enc_cred: enc });
        setBusy(false);
        if (err) { setError(err.message); return; }
        setForm({ label: '', env: 'prod', login: '', password: '', method: 'password' });
        await onDone();
    }
    const label = 'block text-xs font-semibold text-slate-600';
    return (
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Plug size={18} className="text-indigo-700" /> {first ? 'Připojit datovou schránku' : 'Připojit další schránku'}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>Název (jak se bude zobrazovat)<input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} maxLength={120} placeholder="např. Kancelář Novák" className={`${inputCls} mt-1 font-normal`} /></label>
                <label className={label}>Prostředí<select value={form.env} onChange={(e) => setForm((f) => ({ ...f, env: e.target.value as IsdsEnv }))} className={`${inputCls} mt-1 font-normal`}><option value="prod">Ostrý provoz (mojedatovaschranka.cz)</option><option value="test">Testovací (czebox.cz)</option></select></label>
                <label className={`${label} sm:col-span-2`}>Způsob přihlášení<select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as 'password' | 'mobile_key' }))} className={`${inputCls} mt-1 font-normal`}><option value="password">Jméno a heslo</option><option value="mobile_key">Mobilní klíč (komunikační kód)</option></select></label>
                {form.method === 'mobile_key' && <p className="rounded-lg bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-950 sm:col-span-2"><Smartphone size={13} className="mr-1 inline" aria-hidden="true" /> V portálu datových schránek otevřete <strong>Nastavení → Možnosti přihlášení → Přihlášení mobilním klíčem</strong>, aktivujte mobilní klíč a stiskněte <strong>Vygenerovat přístupové údaje</strong>. Získaný komunikační kód zadejte níže místo hesla. Při každém přihlášení vám v telefonu přijde oznámení, které potvrdíte.</p>}
                <label className={label}>Přihlašovací jméno *<input value={form.login} onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))} required autoComplete="off" className={`${inputCls} mt-1 font-normal`} /></label>
                 <label className={label}>{form.method === 'mobile_key' ? 'Komunikační kód *' : 'Heslo *'}<input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required autoComplete="new-password" className={`${inputCls} mt-1 font-normal`} /></label>
            </div>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500"><Lock size={13} className="mt-0.5 shrink-0 text-indigo-700" aria-hidden="true" /> Údaje se před uložením zašifrují vaším šifrovacím heslem v prohlížeči. Při každém použití je prohlížeč pošle zabezpečeně na náš server, ten je použije na jedno volání datových schránek a nikde neuloží.</p>
            {waiting && <p role="status" className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-950"><Smartphone size={16} aria-hidden="true" /> Potvrďte přihlášení v aplikaci Mobilní klíč v telefonu…</p>}
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            <button type="submit" disabled={busy} className={primaryBtn}>{busy && <Loader2 size={15} className="animate-spin" />} Ověřit a připojit</button>
        </form>
    );
}

function ConnectMore({ master, onDone }: { master: CryptoKey; onDone: () => Promise<void> }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setOpen(true)} className={ghostBtn}><Plus size={14} /> Další schránka</button>
            {open && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[10vh]" onClick={() => setOpen(false)}><div className="w-full max-w-xl" onClick={(e) => e.stopPropagation()}><Connect master={master} onDone={async () => { setOpen(false); await onDone(); }} /></div></div>}
        </>
    );
}

function Box({ account, cred, userId, onRemove }: { account: Account; cred: Cred; userId: string; onRemove: () => Promise<void> }) {
    const [tab, setTab] = useState<Tab>('received');
    const [records, setRecords] = useState<Record_[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [open, setOpen] = useState<Record_ | null>(null);
    const [compose, setCompose] = useState(false);
    const { call, waiting } = useCaller(account.env, cred);

    const refresh = useCallback(async (t: Tab) => {
        setBusy(true); setError('');
        const from = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 19);
        const r = await call({ action: 'list', received: t === 'received', from });
        setBusy(false);
        if (!r.ok) { setError(errText(r)); setRecords([]); return; }
        setRecords((r.json.records as Record_[]) ?? []);
    }, [call]);

    const switchTab = (t: Tab) => { setTab(t); setRecords(null); setOpen(null); void refresh(t); };
    // První načtení po otevření schránky
    useEffect(() => { let alive = true; Promise.resolve().then(() => { if (alive) void refresh('received'); }); return () => { alive = false; }; }, [refresh]);

    return (
        <div className="space-y-4">
            {waiting && <p role="status" className="fixed left-1/2 top-4 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-bold text-amber-950 shadow-lg"><Smartphone size={16} aria-hidden="true" /> Potvrďte přihlášení v aplikaci Mobilní klíč v telefonu…</p>}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Složka">
                    {([['received', 'Přijaté', Inbox], ['sent', 'Odeslané', Send]] as const).map(([id, name, Icon]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => switchTab(id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold cursor-pointer ${tab === id ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'}`}><Icon size={14} aria-hidden="true" /> {name}</button>)}
                </div>
                <button type="button" onClick={() => void refresh(tab)} disabled={busy} className={ghostBtn}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Načíst znovu</button>
                <button type="button" onClick={() => setCompose(true)} className={`${primaryBtn} ml-auto`}><Mail size={15} /> Napsat zprávu</button>
                <button type="button" onClick={() => { if (window.confirm(`Odpojit schránku „${account.label}“? Smažou se uložené přihlašovací údaje (zprávy ve schránce zůstanou).`)) void onRemove(); }} aria-label="Odpojit schránku" className="rounded-lg p-2 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={15} /></button>
            </div>
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            {records === null ? <p className="text-sm text-slate-500" role="status">Načítám zprávy z datové schránky…</p> : records.length === 0 && !error ? <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">Za posledních 90 dnů tu nejsou žádné zprávy.</p> : (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    {records.map((r) => (
                        <li key={r.id}>
                            <button type="button" onClick={() => setOpen(r)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 cursor-pointer">
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-slate-900">{tab === 'received' ? r.sender : r.recipient || r.recipientBox}</span>
                                    <span className="block truncate text-sm text-slate-600">{r.annotation || '(bez věci)'}</span>
                                </span>
                                <span className="shrink-0 text-right text-xs text-slate-500">{fmtTime(r.delivered || r.accepted)}<span className={`mt-1 block rounded-full px-2 py-0.5 font-bold ${r.undelivered && tab === 'received' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>{STATUS_LABELS[r.status] ?? r.status}</span></span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {open && <Detail record={open} tab={tab} call={call} userId={userId} onClose={() => setOpen(null)} onChanged={() => void refresh(tab)} />}
            {compose && <Compose account={account} call={call} userId={userId} onClose={() => setCompose(false)} onSent={() => { setCompose(false); void refresh('sent'); setTab('sent'); }} />}
        </div>
    );
}

function Detail({ record, tab, call, userId, onClose, onChanged }: { record: Record_; tab: Tab; call: Caller; userId: string; onClose: () => void; onChanged: () => void }) {
    const [msg, setMsg] = useState<Downloaded | null>(null);
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [caseId, setCaseId] = useState('');
    const [done, setDone] = useState('');
    useEffect(() => { let alive = true; loadCases().then((c) => { if (alive) setCases(c); }).catch(() => undefined); return () => { alive = false; }; }, []);

    async function download() {
        setBusy(true); setError('');
        const r = await call({ action: 'download', id: record.id, undelivered: record.undelivered && tab === 'received', confirmDelivery: confirm });
        setBusy(false);
        if (r.status === 409) { setConfirm(true); return; }
        if (!r.ok) { setError(errText(r)); return; }
        setMsg(r.json.message as Downloaded); onChanged();
    }
    function save(f: Downloaded['files'][number]) { const file = fromBase64(f.base64, f.mime, f.name); const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }

    async function toCase() {
        if (!msg || !caseId) return;
        setBusy(true); setError('');
        try {
            for (const f of msg.files) await uploadCaseFile(userId, caseId, null, fromBase64(f.base64, f.mime, `${safeFileName(f.name)}`));
            await insertRow('case_entries', { case_id: caseId, user_id: userId, kind: 'event', title: `Datová zpráva: ${record.annotation || 'bez věci'}`.slice(0, 200), body: `Odesílatel: ${record.sender}. Doručeno ${fmtTime(record.delivered || record.accepted)}. Přílohy (${msg.files.length}) uloženy ve spisu.`, happened_on: (record.delivered || record.accepted || '').slice(0, 10) || null });
            setDone(`Uloženo do věci (${msg.files.length} příloh) a zapsáno do chronologie.`);
        } catch (e) { setError(e instanceof Error ? e.message : 'Uložení se nepovedlo.'); }
        setBusy(false);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[8vh]" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-label="Datová zpráva" onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-indigo-800">{tab === 'received' ? 'Přijatá zpráva' : 'Odeslaná zpráva'} · {STATUS_LABELS[record.status] ?? record.status}</p><h2 className="text-lg font-bold text-slate-900">{record.annotation || '(bez věci)'}</h2></div><button type="button" onClick={onClose} aria-label="Zavřít" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"><X size={18} /></button></div>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs text-slate-500">Odesílatel</dt><dd className="text-slate-900">{record.sender || '–'}</dd></div>
                    <div><dt className="text-xs text-slate-500">Adresát</dt><dd className="text-slate-900">{record.recipient || record.recipientBox || '–'}</dd></div>
                    <div><dt className="text-xs text-slate-500">Dodáno</dt><dd className="text-slate-900">{fmtTime(record.delivered)}</dd></div>
                    <div><dt className="text-xs text-slate-500">Doručeno</dt><dd className="text-slate-900">{fmtTime(record.accepted)}</dd></div>
                </dl>
                {tab === 'received' && !msg && (
                    <div className="mt-5">
                        {record.undelivered && <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /><span><strong>Zpráva ještě nebyla doručena.</strong> Jakmile ji stáhnete, považuje se za doručenou a začnou běžet lhůty. Pokračujte, jen když jste na to připraven(a).</span></p>}
                        {confirm && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">Opravdu zprávu stáhnout a tím ji doručit?</p>}
                        <button type="button" onClick={() => void download()} disabled={busy} className={confirm ? 'inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800 cursor-pointer' : primaryBtn}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {confirm ? 'Ano, stáhnout a doručit' : 'Stáhnout zprávu a přílohy'}</button>
                    </div>
                )}
                {tab === 'sent' && <p className="mt-5 text-sm text-slate-500">U odeslaných zpráv se zobrazují jen údaje o doručení.</p>}
                {msg && (
                    <div className="mt-5 space-y-3">
                        <ul className="space-y-1.5">{msg.files.map((f, i) => <li key={i} className="flex items-center gap-2 text-sm"><Paperclip size={14} className="shrink-0 text-slate-400" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{f.name}</span><button type="button" onClick={() => save(f)} className={ghostBtn}><Download size={13} /> Stáhnout</button></li>)}{msg.files.length === 0 && <li className="text-sm text-slate-500">Zpráva nemá přílohy.</li>}</ul>
                        {msg.files.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
                                <select value={caseId} onChange={(e) => setCaseId(e.target.value)} aria-label="Věc, do které uložit" className={`${inputCls} max-w-xs`}><option value="">Uložit přílohy do věci…</option>{cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
                                <button type="button" onClick={() => void toCase()} disabled={!caseId || busy || !!done} className={primaryBtn}>Uložit do věci</button>
                            </div>
                        )}
                    </div>
                )}
                {done && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{done}</p>}
                {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
                <button type="button" onClick={onClose} className={`${ghostBtn} mt-4`}><ArrowLeft size={14} /> Zavřít</button>
            </div>
        </div>
    );
}

function Compose({ account, call, userId, onClose, onSent }: { account: Account; call: Caller; userId: string; onClose: () => void; onSent: () => void }) {
    const [q, setQ] = useState('');
    const [hits, setHits] = useState<BoxHit[]>([]);
    const [to, setTo] = useState<BoxHit | null>(null);
    const [boxId, setBoxId] = useState('');
    const [annotation, setAnnotation] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [caseId, setCaseId] = useState('');
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => { let alive = true; loadCases().then((c) => { if (alive) setCases(c); }).catch(() => undefined); return () => { alive = false; }; }, []);

    async function find() {
        const text = q.trim();
        if (text.length < 3) return;
        setBusy(true); setError('');
        const r = await call({ action: 'find', ...(/^\d[\d\s]{6,}\d$/.test(text) ? { ic: text } : { name: text }) });
        setBusy(false);
        if (!r.ok) { setError(errText(r)); return; }
        const list = (r.json.results as BoxHit[]) ?? [];
        setHits(list);
        if (!list.length) setError('Schránka nenalezena. Zadejte její ID ručně (7 znaků) níže.');
    }

    function add(list: FileList | null) {
        if (!list) return;
        const next = [...files, ...Array.from(list)];
        if (next.reduce((s, f) => s + f.size, 0) > MAX_SEND) { setError('Přílohy jsou dohromady větší než 10 MB.'); return; }
        if (next.length > 20) { setError('Nejvýše 20 příloh.'); return; }
        setError(''); setFiles(next);
    }

    const recipient = (to?.id ?? boxId).trim().toLowerCase();
    const valid = /^[a-z0-9]{7}$/.test(recipient) && annotation.trim().length > 0 && files.length > 0;

    async function send() {
        setBusy(true); setError('');
        try {
            const payload = await Promise.all(files.map(async (f) => ({ name: f.name, mime: f.type, base64: await toBase64(f) })));
            const r = await call({ action: 'send', recipient, annotation: annotation.trim(), files: payload, confirmSend: true });
            if (!r.ok) { setError(errText(r)); setBusy(false); setConfirm(false); return; }
            if (caseId) {
                try { await insertRow('case_entries', { case_id: caseId, user_id: userId, kind: 'event', title: `Odeslána datová zpráva: ${annotation.trim()}`.slice(0, 200), body: `Adresát: ${to?.name || recipient} (ID ${recipient}). ID zprávy ${String(r.json.id ?? '')}. Příloh: ${files.length}.`, happened_on: new Date().toISOString().slice(0, 10) }); } catch { /* chronologie není kritická */ }
            }
            onSent();
        } catch (e) { setError(e instanceof Error ? e.message : 'Odeslání se nepodařilo.'); setBusy(false); setConfirm(false); }
    }

    const label = 'block text-xs font-semibold text-slate-600';
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[6vh]" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-label="Nová datová zpráva" onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl space-y-4 rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-start justify-between"><h2 className="text-lg font-bold text-slate-900">Nová datová zpráva</h2><button type="button" onClick={onClose} aria-label="Zavřít" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"><X size={18} /></button></div>
                <div>
                    <label className={label} htmlFor="ds-find">Adresát: hledat schránku podle IČO nebo názvu</label>
                    <div className="mt-1 flex gap-2"><input id="ds-find" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void find(); } }} className={inputCls} placeholder="např. 00006947 nebo Ministerstvo financí" /><button type="button" onClick={() => void find()} disabled={busy} className={ghostBtn}><Search size={14} /> Najít</button></div>
                    {hits.length > 0 && <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">{hits.map((h) => <li key={h.id}><button type="button" onClick={() => { setTo(h); setHits([]); setBoxId(h.id); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 cursor-pointer"><strong className="text-slate-900">{h.name}</strong><span className="block text-xs text-slate-500">ID {h.id}{h.ic ? ` · IČO ${h.ic}` : ''}{h.city ? ` · ${h.city}` : ''}</span></button></li>)}</ul>}
                    {to && <p className="mt-2 rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-900">Adresát: <strong>{to.name}</strong> (ID {to.id})</p>}
                    <label className={`${label} mt-2`}>nebo ID datové schránky (7 znaků)<input value={boxId} onChange={(e) => { setBoxId(e.target.value); setTo(null); }} maxLength={7} className={`${inputCls} mt-1 font-mono font-normal`} placeholder="abc1234" /></label>
                </div>
                <label className={label}>Věc zprávy * (až 255 znaků)<input value={annotation} onChange={(e) => setAnnotation(e.target.value)} maxLength={255} className={`${inputCls} mt-1 font-normal`} placeholder="např. Žaloba o zaplacení, sp. zn. 12 C 34/2026" /></label>
                <div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"><Paperclip size={15} aria-hidden="true" /> Přiložit soubory *<input type="file" multiple onChange={(e) => { add(e.target.files); e.target.value = ''; }} className="sr-only" /></label>
                    {files.length > 0 && <ul className="mt-2 space-y-1">{files.map((f, i) => <li key={i} className="flex items-center gap-2 text-xs text-slate-700"><span className="min-w-0 flex-1 truncate">{f.name} <span className="text-slate-400">{fmtSize(f.size)}</span></span><button type="button" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} aria-label={`Odebrat ${f.name}`} className="rounded p-0.5 hover:bg-slate-100"><X size={14} /></button></li>)}</ul>}
                    <p className="mt-1 text-xs text-slate-500">Dohromady do 10 MB. První příloha je hlavní dokument. Dokumenty ze spisu si stáhněte a přiložte zde.</p>
                </div>
                <label className={label}>Zapsat do chronologie věci (nepovinné)<select value={caseId} onChange={(e) => setCaseId(e.target.value)} className={`${inputCls} mt-1 font-normal`}><option value="">Nezapisovat</option>{cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
                {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
                {!confirm ? <button type="button" disabled={!valid || busy} onClick={() => setConfirm(true)} className={primaryBtn}><Send size={15} /> Zkontrolovat a odeslat</button> : (
                    <div className="rounded-xl border border-rose-300 bg-rose-50 p-4">
                        <p className="text-sm font-bold text-rose-950">Odeslání datové zprávy má právní účinky a nejde vzít zpět.</p>
                        <p className="mt-1 text-sm text-rose-950">Adresát: <strong>{to?.name || `schránka ${recipient}`}</strong> · {files.length} příloh · věc: „{annotation.trim()}“. Z prostředí: {account.env === 'test' ? 'testovací' : 'OSTRÝ PROVOZ'}.</p>
                        <div className="mt-3 flex gap-2"><button type="button" onClick={() => void send()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-60 cursor-pointer">{busy && <Loader2 size={15} className="animate-spin" />} Odeslat</button><button type="button" onClick={() => setConfirm(false)} className={ghostBtn}>Zpět</button></div>
                    </div>
                )}
            </div>
        </div>
    );
}
