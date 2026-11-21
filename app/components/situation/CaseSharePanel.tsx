'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Lock, Trash2, UserPlus, Users, X } from 'lucide-react';
import { ROLE_LABEL, addMember, loadShare, removeMember, updateMember, type ShareRole, type ShareRow } from '@/lib/caseShare';
import { wrapForAdmin } from '@/lib/e2ee';
import type { LegalCase } from '@/lib/cases';
import { useSharingKeys } from '../lawyer/useSharingKeys';
import { ghostBtn, inputCls, primaryBtn } from './caseUi';
import { useChannelKey } from './useChannelKey';

// Sdílení věci s kolegy z kanceláře. Vlastník věci určuje, kdo ji vidí a jestli ji smí upravovat.
export default function CaseSharePanel({ item, userId, onClose, onLeft, fail }: { item: LegalCase; userId: string; onClose: () => void; onLeft: () => void; fail: (e: unknown) => void }) {
    const { colleagues, keys, error: keyError } = useSharingKeys();
    const channel = useChannelKey(item.id);
    const [rows, setRows] = useState<ShareRow[] | null>(null);
    const [problem, setProblem] = useState('');
    const [pick, setPick] = useState('');
    const [role, setRole] = useState<ShareRole>('editor');
    const [withKey, setWithKey] = useState(false);
    const [busy, setBusy] = useState('');

    const load = useCallback(async () => { try { setRows(await loadShare(item.id)); setProblem(''); } catch (e) { setProblem(e instanceof Error ? e.message : 'Nepodařilo se načíst.'); setRows([]); } }, [item.id]);
    useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

    const owner = rows?.find((r) => r.is_owner);
    const isOwner = !!owner && owner.user_id === userId;
    const members = (rows ?? []).filter((r) => !r.is_owner);
    const taken = new Set((rows ?? []).map((r) => r.user_id));
    const free = (colleagues ?? []).filter((c) => !taken.has(c.user_id));
    const chosen = free.find((c) => c.user_id === pick);
    const canKey = !!channel.key && !!chosen?.has_keys && !!keys[pick]?.public_key;
    async function run(key: string, fn: () => Promise<void>) { setBusy(key); try { await fn(); await load(); } catch (e) { fail(e); } setBusy(''); }

    async function wrapFor(memberId: string): Promise<string | null> {
        if (!channel.key || !keys[memberId]?.public_key) return null;
        return wrapForAdmin(keys[memberId].public_key, channel.key);
    }
    return (
        <section className="mt-4 rounded-2xl border border-indigo-200 bg-white p-5" aria-label="Sdílení spisu">
            <div className="flex items-start justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Users size={18} className="text-indigo-700" aria-hidden="true" /> Sdílení spisu</h2>
                <button type="button" onClick={onClose} aria-label="Zavřít" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"><X size={16} /></button>
            </div>
            {rows === null ? <p className="mt-3 text-sm text-slate-500" role="status">Načítám…</p> : problem ? <p role="alert" className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-slate-700">{problem}</p> : (
                <>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{isOwner ? 'Spis můžete nasdílet kolegům z kanceláře. Uvidí její soubory, lhůty, chronologii a kontakty. Klientskou stránku, podpisy, identifikaci, výkazy a vyúčtování mají jen vy.' : `Spis vám sdílí ${owner?.name || 'kolega'}. Vaše role: ${ROLE_LABEL[(members.find((m) => m.user_id === userId)?.role ?? 'viewer') as ShareRole]}.`}</p>
                    <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                        {owner && <li className="flex items-center gap-3 px-4 py-2.5"><span className="flex-1"><strong className="text-slate-900">{owner.name || owner.email}</strong><span className="block text-xs text-slate-500">{owner.email}</span></span><span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-900">Vlastník</span></li>}
                        {members.map((m) => (
                            <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                                <span className="min-w-0 flex-1"><strong className="text-slate-900">{m.name || m.email}</strong><span className="block text-xs text-slate-500">{m.email}</span></span>
                                {isOwner ? (<>
                                    <select value={m.role} onChange={(e) => void run(`r-${m.user_id}`, () => updateMember(item.id, m.user_id, { role: e.target.value as ShareRole }))} className={`${inputCls} w-auto py-1.5`} aria-label={`Role: ${m.name}`}><option value="editor">{ROLE_LABEL.editor}</option><option value="viewer">{ROLE_LABEL.viewer}</option></select>
                                    <button type="button" onClick={() => void run(`d-${m.user_id}`, () => removeMember(item.id, m.user_id))} aria-label={`Odebrat ${m.name}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"><Trash2 size={15} /></button>
                                </>) : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{ROLE_LABEL[m.role]}</span>}
                            </li>
                        ))}
                        {members.length === 0 && <li className="px-4 py-3 text-slate-500">Spis zatím nikomu nesdílíte.</li>}
                    </ul>

                    {isOwner ? (
                        colleagues === null || colleagues === undefined ? <p className="mt-3 text-sm text-slate-500">{keyError || 'Kolegové se načítají, nebo nejste členem kanceláře.'}</p> : (
                            <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Přidat kolegu</p>
                                <div className="flex flex-wrap items-end gap-2">
                                    <select value={pick} onChange={(e) => { setPick(e.target.value); setWithKey(false); }} className={`${inputCls} w-auto min-w-52`} aria-label="Kolega"><option value="">Vyberte kolegu…</option>{free.map((c) => <option key={c.user_id} value={c.user_id}>{c.name || c.email}</option>)}</select>
                                    <select value={role} onChange={(e) => setRole(e.target.value as ShareRole)} className={`${inputCls} w-auto`} aria-label="Role"><option value="editor">{ROLE_LABEL.editor}</option><option value="viewer">{ROLE_LABEL.viewer}</option></select>
                                    <button type="button" disabled={!pick || busy === 'add'} onClick={() => void run('add', async () => { await addMember(item.id, userId, pick, role, withKey && canKey ? await wrapFor(pick) : null); setPick(''); setWithKey(false); })} className={primaryBtn}>{busy === 'add' ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Sdílet</button>
                                </div>
                                {channel.hasEncrypted && (
                                    <label className={`flex items-start gap-2 text-xs ${canKey ? 'text-slate-700' : 'text-slate-400'}`}><input type="checkbox" checked={withKey && canKey} disabled={!canKey} onChange={(e) => setWithKey(e.target.checked)} className="mt-0.5 accent-indigo-800" /><span><Lock size={12} className="mr-1 inline" aria-hidden="true" />Sdílet i šifrované soubory a zprávy od klienta (kolega dostane klíč kanálu). {!canKey && 'Dostupné, když je šifrování odemčené a kolega má zapnutou šifrovanou výměnu.'}</span></label>)}
                                {free.length === 0 && <p className="text-xs text-slate-500">Žádný další kolega z vaší kanceláře k přidání.</p>}
                            </div>
                        )
                    ) : <button type="button" onClick={() => void run('leave', async () => { await removeMember(item.id, userId); onLeft(); })} className={`${ghostBtn} mt-3`}>Opustit sdílení</button>}
                    {isOwner && <p className="mt-3 text-xs text-slate-500">Klient by měl být o sdílení údajů s kolegy informován, jak vyžaduje vaše smlouva a povinnost mlčenlivosti. Přístup kolegy zaniká, jakmile opustí kancelář nebo ho odeberete.</p>}
                </>
            )}
        </section>
    );
}
