'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { BadgeCheck, Building2, CalendarDays, CheckCircle2, Circle, FileText, Globe, Loader2, Lock, Mail, MessageSquare, Phone, Send, Upload, LayoutDashboard, FolderOpen, FileSignature } from 'lucide-react';
import { SECURITY_TEXT_CLIENT, SECURITY_TEXT_CLIENT_E2EE, initials, isAllowedUpload, validateIdentity } from '@/lib/portal';
import PortalSign from './PortalSign';
import PortalAml from './PortalAml';
import { KEY_FRAGMENT, decryptText, decryptToBlob, encryptFile, encryptText, importKey, isEncrypted } from '@/lib/e2ee';
import PortalCodeGate from './PortalCodeGate';
import { ACCENTS, accentOf } from '@/lib/portalBrand';

type Lawyer = { accent?: string; greeting?: string; firm: string; name: string; phone: string; office: string; website: string; barNumber: string; email: string; photo?: string; verified?: boolean; profession?: string; verifiedAt?: string | null };
type PortalFile = { id: string; name: string; size: number; created_at: string; source: string; request_id: string | null; client_visible: boolean; enc?: boolean };
type Onboarded = {
    onboarded: true; e2ee: boolean; lawyer: Lawyer; title: string; status: string;
    client: { name: string; email: string; phone: string; verified?: boolean };
    requests: { id: string; title: string; done: boolean }[];
    files: PortalFile[];
    entries: { id: string; title: string; body: string; happened_on: string | null; created_at: string }[];
    deadlines: { id: string; title: string; due_date: string; done: boolean }[];
    messages: { id: string; from_client: boolean; body: string; created_at: string }[];
};
type Pending = { onboarded: false; e2ee: boolean; lawyer: Lawyer; title: string; prefillName: string };

const fmtDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('cs-CZ');
const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} kB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
const field = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-700/40';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"><h2 className="text-lg font-bold text-slate-900">{title}</h2><div className="mt-3">{children}</div></section>;
}

// Vizitka advokáta: klient vidí, s kým komunikuje a jak ho zastihne
function LawyerCard({ lawyer }: { lawyer: Lawyer }) {
    const name = lawyer.name || lawyer.firm || 'Váš advokát';
    return (
        <section className="rounded-2xl border bg-white p-5 shadow-xs" style={{ borderColor: ACCENTS[accentOf(lawyer.accent)].hex, borderTopWidth: 4 }} aria-label="Váš advokát">
            <div className="flex items-start gap-4">
                {lawyer.photo?.startsWith('data:image/jpeg;base64,')
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={lawyer.photo} alt="" aria-hidden="true" className="h-20 w-20 shrink-0 rounded-full object-cover" />
                    : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-800 text-lg font-bold text-white" aria-hidden="true">{initials(name)}</span>}
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENTS[accentOf(lawyer.accent)].hex }}>Váš advokát</p>
                    <p className="text-xl font-bold leading-tight text-slate-900">{name}</p>
                    {lawyer.name && lawyer.firm && <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600"><Building2 size={14} aria-hidden="true" />{lawyer.firm}</p>}
                    {lawyer.barNumber && <p className="text-xs text-slate-500">Ev. č. ČAK {lawyer.barNumber}</p>}
                    {lawyer.office && <p className="mt-1 text-xs text-slate-500">{lawyer.office}</p>}
                    {lawyer.greeting && <p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">{lawyer.greeting}</p>}
                </div>
            </div>
            {(lawyer.phone || lawyer.email || lawyer.website) && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {lawyer.phone && <a href={`tel:${lawyer.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"><Phone size={14} aria-hidden="true" /> {lawyer.phone}</a>}
                    {lawyer.email && <a href={`mailto:${lawyer.email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"><Mail size={14} aria-hidden="true" /> {lawyer.email}</a>}
                    {lawyer.website && <a href={/^https?:\/\//.test(lawyer.website) ? lawyer.website : `https://${lawyer.website}`} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"><Globe size={14} aria-hidden="true" /> Web</a>}
                </div>
            )}
        </section>
    );
}

type Tab = 'prehled' | 'dokumenty' | 'podpisy' | 'zpravy';

// Soukromá stránka klienta: nejdřív údaje o klientovi, potom stav věci, dokumenty a zprávy
export default function ClientPortal() {
    const pathname = usePathname();
    const token = pathname.split('/').filter(Boolean).pop() ?? '';
    const [data, setData] = useState<Onboarded | Pending | null>(null);
    const [state, setState] = useState<'loading' | 'ok' | 'invalid' | 'unavailable' | 'unverified' | 'inactive' | 'code'>('loading');
    const [gate, setGate] = useState<{ email: string; title: string; lawyer: Lawyer } | null>(null);
    const [key, setKey] = useState<CryptoKey | null>(null);
    const [keyChecked, setKeyChecked] = useState(false);
    const [plain, setPlain] = useState<Record<string, string>>({});
    const [names, setNames] = useState<Record<string, string>>({});
    const [tab, setTab] = useState<Tab>('prehled');
    const [back, setBack] = useState({ focus: '', notice: '' });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const [text, setText] = useState('');
    const [identity, setIdentity] = useState({ name: '', email: '', phone: '', address: '', consent: false });
    const pickFor = useRef<string>('');
    const input = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/portal/${token}`);
            if (res.status === 404) { setState('invalid'); return; }
            if (!res.ok) { setState('unavailable'); return; }
            const body = await res.json() as Onboarded | Pending | { unverified: true } | { inactive: true } | { needsCode: true; email: string; title: string; lawyer: Lawyer };
            if ('needsCode' in body) { setGate({ email: body.email, title: body.title, lawyer: body.lawyer }); setData(null); setState('code'); return; }
            if ('unverified' in body) { setState('unverified'); return; }
            if ('inactive' in body) { setState('inactive'); return; }
            if (!body.onboarded) setIdentity((i) => ({ ...i, name: i.name || body.prefillName }));
            setData(body);
            setState('ok');
        } catch { setState('unavailable'); }
    }, [token]);

    useEffect(() => {
        const timer = window.setTimeout(() => { void load(); }, 0);
        return () => window.clearTimeout(timer);
    }, [load]);

    // Návrat z ověření totožnosti (Bank iD): otevře se příslušný podpis
    useEffect(() => {
        const t = window.setTimeout(() => {
            const q = new URLSearchParams(window.location.search); const status = q.get('identita'); const sign = q.get('podpis');
            if (!status || !sign) return;
            setBack({ focus: sign, notice: status === 'ok' ? 'Totožnost je ověřená. Pokračujte potvrzením SMS kódem.' : status === 'zruseno' ? 'Ověření jste zrušili.' : 'Ověření totožnosti se nepodařilo dokončit. Zkuste to znovu.' });
            setTab('podpisy');
        }, 0);
        return () => window.clearTimeout(t);
    }, []);

    // Šifrovací klíč je v odkazu za znakem #; server ho nikdy nedostane. Po načtení se uloží do úložiště karty prohlížeče.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const storeKey = `portalKey:${token}`;
            let raw = '';
            const match = window.location.hash.match(new RegExp(`${KEY_FRAGMENT}=([A-Za-z0-9_-]{43})`));
            if (match) { raw = match[1]; try { sessionStorage.setItem(storeKey, raw); } catch { /* ok */ } }
            else { try { raw = sessionStorage.getItem(storeKey) ?? ''; } catch { raw = ''; } }
            const imported = raw ? await importKey(raw).catch(() => null) : null;
            if (!cancelled) { setKey(imported); setKeyChecked(true); }
        })();
        return () => { cancelled = true; };
    }, [token]);

    // Dešifrování zpráv a názvů souborů pro zobrazení
    const messagesData = data && data.onboarded ? data.messages : null;
    const filesData = data && data.onboarded ? data.files : null;
    useEffect(() => {
        if (!key || !messagesData || !filesData) return;
        let cancelled = false;
        (async () => {
            const out: Record<string, string> = {};
            for (const m of messagesData) if (isEncrypted(m.body)) { try { out[m.id] = await decryptText(key, m.body); } catch { out[m.id] = '[zprávu nelze dešifrovat]'; } }
            const n: Record<string, string> = {};
            for (const f of filesData) if (f.enc) { try { n[f.id] = await decryptText(key, f.name); } catch { n[f.id] = 'šifrovaný soubor'; } }
            if (!cancelled) { setPlain(out); setNames(n); }
        })();
        return () => { cancelled = true; };
    }, [key, messagesData, filesData]);

    async function download(f: PortalFile) {
        setError('');
        try {
            const res = await fetch(`/api/portal/${token}/file/${f.id}?json=1`);
            if (!res.ok) throw new Error();
            const info = await res.json() as { url: string; enc: boolean };
            if (!info.enc) { const link = document.createElement('a'); link.href = info.url; link.click(); return; }
            if (!key) throw new Error('key');
            const cipher = new Uint8Array(await (await fetch(info.url)).arrayBuffer());
            const name = names[f.id] ?? 'soubor';
            const blob = await decryptToBlob(key, cipher, name);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
        } catch (e) { setError(e instanceof Error && e.message === 'key' ? 'Chybí šifrovací klíč. Otevřete odkaz celý, tak jak jste ho dostali.' : 'Soubor se nepodařilo stáhnout.'); }
    }

    async function identify() {
        const problem = validateIdentity(identity);
        if (problem) { setError(problem); return; }
        setBusy('id'); setError('');
        try {
            const res = await fetch(`/api/portal/${token}/identify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(identity) });
            if (res.status === 401) { void load(); return; }
            const out = await res.json().catch(() => ({}));
            if (!res.ok) { setError(out.message ?? 'Údaje se nepodařilo uložit. Zkuste to prosím znovu.'); return; }
            await load();
        } catch { setError('Údaje se nepodařilo uložit. Zkontrolujte připojení.'); } finally { setBusy(''); }
    }

    async function upload(files: FileList, requestId: string) {
        setError('');
        for (const file of [...files]) {
            const problem = isAllowedUpload(file.name, file.size);
            if (problem) { setError(problem); continue; }
            setBusy(requestId || 'free');
            const form = new FormData();
            if (data?.e2ee) {
                if (!key) { setError('Chybí šifrovací klíč. Otevřete odkaz celý, tak jak jste ho dostali.'); setBusy(''); return; }
                const { blob, encName } = await encryptFile(key, file);
                form.append('file', blob, 'sifrovano.bin');
                form.append('enc', '1');
                form.append('encName', encName);
            } else form.append('file', file);
            if (requestId) form.append('requestId', requestId);
            try {
                const res = await fetch(`/api/portal/${token}/upload`, { method: 'POST', body: form });
                const out = await res.json().catch(() => ({}));
                if (!res.ok) { setError(out.message ?? 'Soubor se nepodařilo nahrát. Zkuste to prosím znovu.'); continue; }
                setData((d) => (d && d.onboarded ? { ...d, files: [out.file as PortalFile, ...d.files] } : d));
            } catch { setError('Soubor se nepodařilo nahrát. Zkontrolujte připojení.'); }
        }
        setBusy('');
    }

    async function send() {
        const body = text.trim();
        if (!body) return;
        setBusy('msg'); setError('');
        try {
            const res = await fetch(`/api/portal/${token}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: data?.e2ee && key ? await encryptText(key, body) : body }) });
            const out = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error();
            setData((d) => (d && d.onboarded ? { ...d, messages: [...d.messages, out.message] } : d));
            setText('');
        } catch { setError('Zprávu se nepodařilo odeslat. Zkuste to prosím znovu.'); } finally { setBusy(''); }
    }

    if (state === 'loading') return <p className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-slate-500" role="status">Načítám…</p>;
    if (state === 'code' && gate) {
        return (
            <div className="min-h-screen bg-[#f8fafc]">
                <div className="mx-auto max-w-xl space-y-4 px-4 py-8 sm:py-12">
                    <PortalCodeGate token={token} email={gate.email} title={gate.title} onDone={() => { setState('loading'); void load(); }} />
                    <LawyerCard lawyer={gate.lawyer} />
                </div>
            </div>
        );
    }
    if (state === 'inactive') {
        return (
            <div className="mx-auto max-w-md px-4 py-20 text-center">
                <Lock size={30} className="mx-auto text-indigo-800" aria-hidden="true" />
                <h1 className="mt-3 text-2xl font-bold text-slate-900">Služba je momentálně neaktivní</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Advokát teď nemá aktivní přístup k této službě. Kontaktujte ho prosím napřímo. Vaše data zůstávají uložená.</p>
            </div>
        );
    }
    if (state === 'unverified') {
        return (
            <div className="mx-auto max-w-md px-4 py-20 text-center">
                <Lock size={30} className="mx-auto text-indigo-800" aria-hidden="true" />
                <h1 className="mt-3 text-2xl font-bold text-slate-900">Stránka zatím není dostupná</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Advokát si ještě nedokončil nastavení, proto se tato stránka zatím nedá otevřít. Obraťte se prosím na advokáta jinou cestou, například telefonem.</p>
            </div>
        );
    }
    if (state !== 'ok' || !data) {
        return (
            <div className="mx-auto max-w-md px-4 py-20 text-center">
                <Lock size={30} className="mx-auto text-indigo-800" aria-hidden="true" />
                <h1 className="mt-3 text-2xl font-bold text-slate-900">{state === 'invalid' ? 'Odkaz už není platný' : 'Stránka je dočasně nedostupná'}</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{state === 'invalid' ? 'Mohl vypršet nebo ho advokát zrušil. Požádejte ho o nový odkaz.' : 'Zkuste to prosím za chvíli znovu.'}</p>
            </div>
        );
    }

    const fname = (f: PortalFile) => (f.enc ? (names[f.id] ?? 'Šifrovaný soubor') : f.name);
    const fileLink = (f: PortalFile, className: string, children: React.ReactNode) => (f.enc
        ? <button type="button" onClick={() => void download(f)} className={`${className} text-left cursor-pointer`}>{children}</button>
        : <a href={`/api/portal/${token}/file/${f.id}`} className={className}>{children}</a>);
    const security = <p className="flex items-start gap-2 pt-2 text-xs leading-relaxed text-slate-500"><Lock size={14} className="mt-0.5 shrink-0 text-indigo-800" aria-hidden="true" />{data.e2ee ? SECURITY_TEXT_CLIENT_E2EE : <>{SECURITY_TEXT_CLIENT} Odkaz nikomu nepředávejte.</>}</p>;

    // Krok 1: klient se představí a potvrdí souhlas
    if (!data.onboarded) {
        const set = (key: 'name' | 'email' | 'phone' | 'address') => (e: { target: { value: string } }) => setIdentity((i) => ({ ...i, [key]: e.target.value }));
        return (
            <div className="min-h-screen bg-[#f8fafc]">
                <div className="mx-auto max-w-xl space-y-4 px-4 py-8 sm:py-12">
                    <header><h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{data.title}</h1><p className="mt-1 text-sm text-slate-600">Než začneme, představte se prosím. Po vyplnění se vám otevře stav věci, dokumenty a zprávy.</p></header>
                    <LawyerCard lawyer={data.lawyer} />
                    <form onSubmit={(e) => { e.preventDefault(); void identify(); }} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                        <h2 className="text-lg font-bold text-slate-900">Vaše údaje</h2>
                        <input value={identity.name} onChange={set('name')} required maxLength={120} placeholder="Jméno a příjmení" aria-label="Jméno a příjmení" autoComplete="name" className={field} />
                        <div className="grid gap-3 sm:grid-cols-2">
                            <input type="email" value={identity.email} onChange={set('email')} maxLength={160} placeholder="E-mail" aria-label="E-mail" autoComplete="email" className={field} />
                            <input type="tel" value={identity.phone} onChange={set('phone')} maxLength={40} placeholder="Telefon" aria-label="Telefon" autoComplete="tel" className={field} />
                        </div>
                        <input value={identity.address} onChange={set('address')} maxLength={240} placeholder="Adresa (nepovinné)" aria-label="Adresa" autoComplete="street-address" className={field} />
                        <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-slate-700">
                            <input type="checkbox" checked={identity.consent} onChange={(e) => setIdentity((i) => ({ ...i, consent: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-indigo-800" />
                            <span>Souhlasím, aby advokát zpracovával mé údaje a dokumenty za účelem vedení mé věci. Údaje budou použity jen k tomuto účelu.</span>
                        </label>
                        {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
                        <button type="submit" disabled={busy === 'id'} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-800 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-900 disabled:opacity-60 cursor-pointer">{busy === 'id' && <Loader2 size={16} className="animate-spin" />} Pokračovat do věci</button>
                    </form>
                    {security}
                </div>
            </div>
        );
    }

    const filesFor = (id: string) => data.files.filter((f) => f.request_id === id);
    const fromLawyer = data.files.filter((f) => f.client_visible && f.source !== 'client');
    const mine = data.files.filter((f) => f.source === 'client');
    const waiting = data.requests.filter((r) => !r.done && filesFor(r.id).length === 0).length;
    const lawyerName = data.lawyer.name || data.lawyer.firm || 'Advokát';

    const tabs: [Tab, string, typeof FileText, number][] = [['prehled', 'Přehled', LayoutDashboard, waiting], ['dokumenty', 'Dokumenty', FolderOpen, 0], ['podpisy', 'Podpisy', FileSignature, 0], ['zpravy', 'Zprávy', MessageSquare, 0]];

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <input ref={input} type="file" multiple className="hidden" aria-label="Vybrat soubory" onChange={(e) => { if (e.target.files?.length) void upload(e.target.files, pickFor.current); e.target.value = ''; }} />
            <div className="mx-auto max-w-xl space-y-4 px-4 py-8 sm:py-12">
                <header>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{data.title}</h1>
                    <p className="mt-1 text-sm text-slate-600">Přihlášen jako <strong className="text-slate-900">{data.client.name}</strong>{data.client.email && <> · {data.client.email}</>}</p>
                </header>

                <LawyerCard lawyer={data.lawyer} />

                {data.client.verified && <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900"><BadgeCheck size={16} aria-hidden="true" /> Vaši totožnost potvrdil advokát.</p>}
                {data.e2ee && keyChecked && !key && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-relaxed text-rose-900"><strong>Chybí šifrovací klíč.</strong> Zprávy a soubory se bez něj nedají přečíst ani odeslat. Otevřete odkaz přesně tak, jak vám ho poslal advokát (celý, včetně části za znakem #), nebo si od něj vyžádejte nový.</p>}

                <nav className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Části stránky">
                    {tabs.map(([id, label, Icon, badge]) => (
                        <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold cursor-pointer ${tab === id ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>
                            <Icon size={16} aria-hidden="true" /> {label}{badge > 0 && <span className="rounded-full bg-indigo-800 px-1.5 text-[11px] font-bold text-white">{badge}</span>}
                        </button>
                    ))}
                </nav>

                {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}

                {tab === 'prehled' && (
                    <div className="space-y-4" role="tabpanel">
                        <PortalAml token={token} />
                        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><p className="text-xs font-bold uppercase tracking-wide text-indigo-800">Aktuální stav</p><p className="mt-1 text-base leading-relaxed text-slate-900">{data.status || 'Advokát zatím nenapsal stav věci. Uvidíte ho tady.'}</p></div>

                        {data.requests.length > 0 && (
                            <Card title={waiting ? `Co od vás potřebujeme (${waiting})` : 'Co od vás potřebujeme'}>
                                <ul className="space-y-3">
                                    {data.requests.map((r) => {
                                        const uploaded = filesFor(r.id);
                                        const done = r.done || uploaded.length > 0;
                                        return (
                                            <li key={r.id} className="rounded-xl border border-slate-200 p-3.5">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="flex items-start gap-2 text-sm font-semibold text-slate-900">{done ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" /> : <Circle size={18} className="mt-0.5 shrink-0 text-indigo-600" />}{r.title}</span>
                                                    {!r.done && <button type="button" onClick={() => { pickFor.current = r.id; input.current?.click(); }} disabled={busy === r.id} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-800 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-900 disabled:opacity-60 cursor-pointer">{busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Nahrát</button>}
                                                </div>
                                                {uploaded.length > 0 && <ul className="mt-2 space-y-1 pl-7 text-xs text-slate-600">{uploaded.map((f) => <li key={f.id}>{fileLink(f, 'underline', fname(f))} · {fmtSize(f.size)}</li>)}</ul>}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </Card>
                        )}

                        {data.deadlines.filter((d) => !d.done).length > 0 && (
                            <Card title="Nejbližší termíny">
                                <ul className="space-y-2">{data.deadlines.filter((d) => !d.done).map((d) => <li key={d.id} className="flex items-start justify-between gap-3 text-sm"><span className="flex items-start gap-2 text-slate-800"><CalendarDays size={16} className="mt-0.5 shrink-0 text-indigo-800" />{d.title}</span><strong className="shrink-0 text-slate-900">{fmtDate(d.due_date)}</strong></li>)}</ul>
                            </Card>
                        )}

                        {data.entries.length > 0 && (
                            <Card title="Jak věc probíhala">
                                <ol className="space-y-3 border-l-2 border-indigo-200 pl-4">{data.entries.map((e) => <li key={e.id}><p className="text-xs font-semibold text-slate-500">{fmtDate(e.happened_on ?? e.created_at)}</p><p className="text-sm font-semibold text-slate-900">{e.title}</p>{e.body && <p className="text-sm text-slate-600">{e.body}</p>}</li>)}</ol>
                            </Card>
                        )}
                    </div>
                )}

                {tab === 'dokumenty' && (
                    <div className="space-y-4" role="tabpanel">
                        <Card title={`Od advokáta (${fromLawyer.length})`}>
                            {fromLawyer.length === 0 ? <p className="text-sm text-slate-500">Advokát vám zatím žádné dokumenty nezpřístupnil.</p> : (
                                <ul className="space-y-2">{fromLawyer.map((f) => <li key={f.id}>{fileLink(f, 'flex w-full items-center gap-2 text-sm text-slate-800 hover:text-indigo-800', <><FileText size={16} className="shrink-0 text-indigo-800" /><span className="min-w-0 flex-1 truncate underline">{fname(f)}</span>{f.enc && <Lock size={12} className="shrink-0 text-indigo-800" aria-label="Šifrováno" />}<span className="shrink-0 text-xs text-slate-500">{fmtSize(f.size)}</span></>)}</li>)}</ul>
                            )}
                        </Card>
                        <Card title={`Vaše nahrané (${mine.length})`}>
                            {mine.length > 0 && <ul className="mb-3 space-y-2">{mine.map((f) => <li key={f.id}>{fileLink(f, 'flex w-full items-center gap-2 text-sm text-slate-800 hover:text-indigo-800', <><FileText size={16} className="shrink-0 text-slate-500" /><span className="min-w-0 flex-1 truncate underline">{fname(f)}</span>{f.enc && <Lock size={12} className="shrink-0 text-indigo-800" aria-label="Šifrováno" />}<span className="shrink-0 text-xs text-slate-500">{fmtDate(f.created_at)}</span></>)}</li>)}</ul>}
                            <button type="button" onClick={() => { pickFor.current = ''; input.current?.click(); }} disabled={busy === 'free'} className="inline-flex items-center gap-2 rounded-lg bg-indigo-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-900 disabled:opacity-60 cursor-pointer">{busy === 'free' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Nahrát dokument nebo fotku</button>
                            <p className="mt-2 text-xs text-slate-500">PDF, Word, Excel, text a obrázky do 15 MB.</p>
                        </Card>
                    </div>
                )}

                {tab === 'podpisy' && <PortalSign token={token} e2ee={data.e2ee} cryptoKey={key} focusId={back.focus} notice={back.notice} />}
                {tab === 'zpravy' && (
                    <div role="tabpanel">
                        <Card title={`Zprávy s ${lawyerName}`}>
                            {data.messages.length === 0 ? <p className="text-sm text-slate-500">Máte dotaz? Napište ho sem a advokát vám odpoví.</p> : (
                                <ul className="space-y-2">{data.messages.map((m) => <li key={m.id} className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.from_client ? 'ml-auto bg-indigo-800 text-white' : 'bg-slate-100 text-slate-900'}`}><p className="whitespace-pre-line">{isEncrypted(m.body) ? (plain[m.id] ?? '🔒 Zašifrovaná zpráva') : m.body}</p><p className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${m.from_client ? 'text-indigo-100' : 'text-slate-500'}`}>{!m.from_client && data.lawyer.photo?.startsWith('data:image/jpeg;base64,') && (<img src={data.lawyer.photo} alt="" aria-hidden="true" className="h-5 w-5 rounded-full object-cover" />)}{m.from_client ? data.client.name || 'Vy' : lawyerName} · {fmtDate(m.created_at)}</p></li>)}</ul>
                            )}
                            <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="mt-3 flex gap-2">
                                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} placeholder="Napište zprávu advokátovi…" aria-label="Zpráva advokátovi" className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-700/40" />
                                <button type="submit" disabled={!text.trim() || busy === 'msg'} aria-label="Odeslat zprávu" className="self-end rounded-xl bg-indigo-800 p-3 text-white hover:bg-indigo-900 disabled:opacity-60 cursor-pointer"><Send size={18} /></button>
                            </form>
                        </Card>
                    </div>
                )}

                {security}
            </div>
        </div>
    );
}
