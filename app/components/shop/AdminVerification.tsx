'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Eye, KeyRound, Lock, ShieldCheck, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { createAdminKeys, getAdminKey, setAdminKey, subscribeAdminKey, unlockAdminKey, unwrapFromAdmin, decryptBytes } from '@/lib/e2ee';
import type { LawyerAccess } from '@/lib/lawyer';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';

type Doc = { id: string; user_id: string; path: string; wrapped_key: string; created_at: string };

// Klíč správce: bez něj se průkaz nedá přečíst; heslo ani soukromý klíč neopouštějí prohlížeč
function AdminKeyBox({ onChange }: { onChange: () => void }) {
    const unlocked = useSyncExternalStore(subscribeAdminKey, getAdminKey, () => null);
    const [exists, setExists] = useState<boolean | null>(null);
    const [pass, setPass] = useState('');
    const [pass2, setPass2] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        supabase.from('admin_keys').select('id').maybeSingle().then(({ data, error: err }) => { if (!cancelled) setExists(err ? null : !!data); });
        return () => { cancelled = true; };
    }, [unlocked]);

    async function create() {
        if (pass.length < 12) { setError('Heslo správce musí mít aspoň 12 znaků.'); return; }
        if (pass !== pass2) { setError('Hesla se neshodují.'); return; }
        setBusy(true); setError('');
        try {
            const keys = await createAdminKeys(pass);
            const a = await supabase.from('admin_keys').insert({ id: 1, public_key: keys.publicKey });
            if (a.error) throw new Error(a.error.message);
            const b = await supabase.from('admin_secret').insert({ id: 1, salt: keys.salt, wrapped_private: keys.wrappedPrivate });
            if (b.error) { await supabase.from('admin_keys').delete().eq('id', 1); throw new Error(b.error.message); }
            setAdminKey(keys.privateKey); setPass(''); setPass2(''); setExists(true); onChange();
        } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se vytvořit klíč. Je spuštěné SQL verification-billing.sql?'); } finally { setBusy(false); }
    }

    async function unlock() {
        setBusy(true); setError('');
        try {
            const { data, error: err } = await supabase.from('admin_secret').select('salt, wrapped_private').eq('id', 1).single();
            if (err || !data) throw new Error('klíč');
            setAdminKey(await unlockAdminKey(pass, data.salt as string, data.wrapped_private as string));
            setPass('');
        } catch { setError('Heslo nesedí.'); } finally { setBusy(false); }
    }

    if (exists === null) return <p className="text-sm text-indigo-900">Klíč správce se nepodařilo načíst. Zkontrolujte, že je spuštěné SQL verification-billing.sql.</p>;
    if (unlocked) return <p className="flex items-center gap-2 text-sm text-emerald-800"><ShieldCheck size={15} /> Klíč správce je odemčený. <button type="button" onClick={() => setAdminKey(null)} className="text-xs font-semibold text-slate-600 underline cursor-pointer">Zamknout</button></p>;
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><KeyRound size={16} className="text-indigo-800" /> {exists ? 'Odemkněte klíč správce' : 'Vytvořte klíč správce'}</p>
            <p className="mt-1 text-xs text-slate-600">{exists ? 'Heslem odemknete čtení zašifrovaných průkazů.' : 'Žadatelé budou posílat průkazy zašifrované vaším veřejným klíčem. Přečte je jen ten, kdo zná toto heslo. Heslo nejde obnovit (při ztrátě si žadatelé pošlou průkaz znovu).'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
                <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={exists ? 'Heslo správce' : 'Heslo správce (min. 12 znaků)'} aria-label="Heslo správce" autoComplete="off" className={`${inputCls} max-w-64`} onKeyDown={(e) => { if (exists && e.key === 'Enter') void unlock(); }} />
                {!exists && <input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="Heslo znovu" aria-label="Heslo znovu" autoComplete="off" className={`${inputCls} max-w-64`} />}
                <button type="button" onClick={() => void (exists ? unlock() : create())} disabled={busy} className={primaryBtn}><Lock size={15} /> {exists ? 'Odemknout' : 'Vytvořit klíč'}</button>
            </div>
            {error && <p role="alert" className="mt-2 text-sm text-rose-800">{error}</p>}
        </div>
    );
}

const sniff = (b: Uint8Array) => (b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : b[0] === 0x25 && b[1] === 0x50 ? 'application/pdf' : b[0] === 0x52 && b[1] === 0x49 ? 'image/webp' : 'application/octet-stream');

// Fronta žádostí o ověření: průkaz se dešifruje jen tady a po rozhodnutí se smaže
export default function AdminVerification({ rows, onDecided }: { rows: LawyerAccess[]; onDecided: () => void }) {
    const unlocked = useSyncExternalStore(subscribeAdminKey, getAdminKey, () => null);
    const [docs, setDocs] = useState<Record<string, Doc>>({});
    const [preview, setPreview] = useState<{ user: string; url: string; type: string } | null>(null);
    const [error, setError] = useState('');
    const pending = rows.filter((r) => r.verification_status === 'pending');

    const loadDocs = useCallback(async () => {
        const { data } = await supabase.from('verification_docs').select('*');
        setDocs(Object.fromEntries(((data ?? []) as Doc[]).map((d) => [d.user_id, d])));
    }, []);
    useEffect(() => {
        const timer = window.setTimeout(() => { void loadDocs(); }, 0);
        return () => window.clearTimeout(timer);
    }, [loadDocs, rows]);

    async function show(userId: string) {
        const doc = docs[userId];
        if (!doc || !unlocked) return;
        setError('');
        try {
            const { data, error: err } = await supabase.storage.from('verification-docs').download(doc.path);
            if (err || !data) throw new Error('Soubor se nepodařilo stáhnout.');
            const key = await unwrapFromAdmin(unlocked, doc.wrapped_key);
            const plain = await decryptBytes(key, new Uint8Array(await data.arrayBuffer()));
            const type = sniff(plain);
            setPreview({ user: userId, type, url: URL.createObjectURL(new Blob([plain.buffer.slice(plain.byteOffset, plain.byteOffset + plain.byteLength) as ArrayBuffer], { type })) });
        } catch (e) { setError(e instanceof Error ? e.message : 'Průkaz se nepodařilo dešifrovat. Je odemčený správný klíč?'); }
    }

    function closePreview() { if (preview) URL.revokeObjectURL(preview.url); setPreview(null); }

    // Nejdřív se smaže zašifrovaný soubor, potom záznam a stav; selže-li smazání, rozhodnutí se neprovede
    async function decide(row: LawyerAccess, ok: boolean) {
        const note = ok ? '' : window.prompt('Důvod zamítnutí (uvidí ho žadatel):') ?? '';
        if (!ok && !note) return;
        setError('');
        const doc = docs[row.user_id];
        if (doc) {
            const del = await supabase.storage.from('verification-docs').remove([doc.path]);
            if (del.error) { setError('Průkaz se nepodařilo smazat, rozhodnutí nebylo provedeno.'); return; }
        }
        const { error: err } = await supabase.rpc('decide_lawyer_verification', { p_user: row.user_id, p_ok: ok, p_note: note });
        if (err) { setError(err.message); return; }
        closePreview();
        onDecided();
    }

    return (
        <section className="mt-6 rounded-2xl border border-indigo-300 bg-indigo-50/60 p-5" aria-label="Ověřování advokátů">
            <h2 className="text-lg font-bold text-slate-900">Ověřování advokátů</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">Postup: vyhledejte jméno a evidenční číslo ve veřejném seznamu advokátů České advokátní komory (cak.cz). Porovnejte údaje s průkazem a kontakt zjistěte z veřejného seznamu, ne z údajů žadatele. Průkaz je zašifrovaný, čtete ho jen vy a po rozhodnutí se nenávratně smaže.</p>
            <div className="mt-3"><AdminKeyBox onChange={() => void loadDocs()} /></div>
            {error && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            {pending.length === 0 ? <p className="mt-4 text-sm text-slate-500">Žádné žádosti nečekají.</p> : (
                <ul className="mt-4 space-y-3">
                    {pending.map((r) => (
                        <li key={r.user_id} className="rounded-xl border border-slate-200 bg-white p-4">
                            <p className="text-sm font-semibold text-slate-900">{r.register_name || '(bez jména)'} <span className="font-normal text-slate-500">· {r.profession === 'jiny' ? 'jiný právník' : 'advokát'} · ev. č. {r.bar_number || '–'}</span></p>
                            <p className="text-xs text-slate-500">Účet: {r.email || r.user_id} · {docs[r.user_id] ? 'průkaz nahrán (zašifrovaný)' : 'průkaz chybí'}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button type="button" onClick={() => void show(r.user_id)} disabled={!unlocked || !docs[r.user_id]} className={ghostBtn}><Eye size={15} /> Zobrazit průkaz</button>
                                <button type="button" onClick={() => void decide(r, true)} className={ghostBtn}>Ověřeno, schválit</button>
                                <button type="button" onClick={() => void decide(r, false)} className={`${ghostBtn} text-rose-700`}>Zamítnout</button>
                            </div>
                            {!unlocked && <p className="mt-2 text-xs text-slate-500">Pro zobrazení průkazu odemkněte klíč správce.</p>}
                        </li>
                    ))}
                </ul>
            )}
            {preview && (
                <div className="mt-4 rounded-xl border border-slate-300 bg-white p-3" role="dialog" aria-label="Náhled průkazu">
                    <div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-700">Průkaz (jen pro vaše oči, nic se neukládá)</p><button type="button" onClick={closePreview} aria-label="Zavřít náhled" className="rounded p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"><X size={16} /></button></div>
                    {preview.type === 'application/pdf' && <iframe src={preview.url} title="Průkaz" className="mt-2 h-96 w-full rounded-lg border border-slate-200" />}
                    {preview.type.startsWith('image/') && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview.url} alt="Průkaz žadatele" className="mt-2 max-h-96 rounded-lg border border-slate-200" />
                    )}
                    {preview.type === 'application/octet-stream' && <p className="mt-2 text-sm text-slate-600">Neznámý formát souboru.</p>}
                </div>
            )}
        </section>
    );
}
