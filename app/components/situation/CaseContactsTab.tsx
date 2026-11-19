'use client';

import { confirmAction } from '@/lib/confirm';
import { useState } from 'react';
import { Mail, Phone, Radar, Trash2 } from 'lucide-react';
import { deleteRow, insertRow, updateRow, type CaseContact } from '@/lib/caseFile';
import { cleanIco, isValidIco } from '@/lib/ares';
import { inputCls, primaryBtn, type TabProps } from './caseUi';
import { limitsFor } from '@/lib/tiers';
import UpgradeNote from './UpgradeNote';
import AresPicker from '../lawyer/AresPicker';

const ROLES = ['Úřad', 'Soud', 'Policie', 'Advokát', 'Protistrana', 'Svědek', 'Pojišťovna', 'Jiné'];

export default function CaseContactsTab({ item, bundle, userId, lawyer, setBundle, fail }: TabProps) {
    const limits = limitsFor(lawyer);
    const full = bundle.contacts.length >= limits.contactsPerCase;
    const [form, setForm] = useState({ role: 'Úřad', name: '', email: '', phone: '', note: '', ico: '', birth: '', watch: false });
    const set = (key: 'role' | 'name' | 'email' | 'phone' | 'note' | 'ico' | 'birth') => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value, ...(key === 'role' ? { watch: e.target.value === 'Protistrana' } : {}) }));
    const radarMissing = (m: string) => (/ico|birth|watch|schema cache/i.test(m) ? 'Radar protistrany zatím není v databázi zapnutý (chybí spuštění souboru radar.sql).' : m);

    async function add() {
        if (!form.name.trim()) return;
        const ico = cleanIco(form.ico);
        if (ico && !isValidIco(ico)) { fail(new Error('IČO nemá platný kontrolní součet.')); return; }
        try {
            // Údaje pro radar se posílají, jen když jsou vyplněné (funguje i bez spuštěného radar.sql)
            const radar = ico || form.birth || form.watch ? { ico, birth: form.birth || null, watch: form.watch } : {};
            const row = await insertRow<CaseContact>('case_contacts', { case_id: item.id, user_id: userId, role: form.role, name: form.name.trim().slice(0, 120), email: form.email.trim().slice(0, 120), phone: form.phone.trim().slice(0, 40), note: form.note.trim().slice(0, 500), ...radar });
            setBundle((b) => ({ ...b, contacts: [...b.contacts, row] }));
            setForm({ role: form.role, name: '', email: '', phone: '', note: '', ico: '', birth: '', watch: form.role === 'Protistrana' });
        } catch (err) { fail(new Error(radarMissing(err instanceof Error ? err.message : String(err)))); }
    }

    async function toggleWatch(c: CaseContact) {
        try { await updateRow('case_contacts', c.id, { watch: !c.watch }); setBundle((b) => ({ ...b, contacts: b.contacts.map((x) => (x.id === c.id ? { ...x, watch: !c.watch } : x)) })); }
        catch (err) { fail(new Error(radarMissing(err instanceof Error ? err.message : String(err)))); }
    }

    async function remove(id: string) {
        if (!(await confirmAction('Smazat kontakt ze spisu?'))) return;
        try { await deleteRow('case_contacts', id); setBundle((b) => ({ ...b, contacts: b.contacts.filter((c) => c.id !== id) })); } catch (err) { fail(err); }
    }

    return (
        <div className="space-y-5">
            {bundle.contacts.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">Zatím žádné kontakty. Uložte si úřad, soudce, advokáta nebo protistranu na jedno místo.</p>
            ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                    {bundle.contacts.map((c) => (
                        <li key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-600">{c.role}</span>
                                    <p className="mt-1.5 text-sm font-semibold text-slate-900">{c.name}</p>
                                </div>
                                <button type="button" onClick={() => void remove(c.id)} aria-label={`Smazat ${c.name}`} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={15} /></button>
                            </div>
                            <div className="mt-2 space-y-1 text-sm">
                                {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 break-all text-indigo-900 hover:underline"><Mail size={14} className="shrink-0" />{c.email}</a>}
                                {c.phone && <a href={`tel:${c.phone.replace(/\s+/g, '')}`} className="flex items-center gap-2 text-indigo-900 hover:underline"><Phone size={14} className="shrink-0" />{c.phone}</a>}
                                {c.note && <p className="text-xs leading-relaxed text-slate-600">{c.note}</p>}
                                {(c.ico || c.birth) && <p className="text-xs text-slate-500">{c.ico ? `IČO ${c.ico}` : ''}{c.ico && c.birth ? ' · ' : ''}{c.birth ? `nar. ${new Date(`${c.birth}T12:00:00`).toLocaleDateString('cs-CZ')}` : ''}</p>}
                                {lawyer && <button type="button" onClick={() => void toggleWatch(c)} disabled={!c.watch && !c.ico && !c.birth} title={!c.ico && !c.birth ? 'Pro hlídání je potřeba IČO nebo datum narození' : ''} className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${c.watch ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><Radar size={12} aria-hidden="true" /> {c.watch ? 'Hlídáno radarem' : 'Hlídat v radaru'}</button>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><AresPicker compact onPick={(c) => setForm((f) => ({ ...f, ico: c.ico, watch: f.watch || f.role === 'Protistrana', name: c.name.slice(0, 120), note: `IČO ${c.ico}${c.dic ? `, DIČ ${c.dic}` : ''}${c.address ? `, ${c.address}` : ''}`.slice(0, 500) }))} label="Najít firmu v ARES a vyplnit kontakt" /></div>
                <select value={form.role} onChange={set('role')} className={inputCls} aria-label="Role kontaktu">{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
                <input value={form.name} onChange={set('name')} placeholder="Jméno nebo název (např. Městský úřad Plzeň)" maxLength={120} className={inputCls} aria-label="Jméno kontaktu" />
                <input type="email" value={form.email} onChange={set('email')} placeholder="E-mail" className={inputCls} aria-label="E-mail" />
                <input type="tel" value={form.phone} onChange={set('phone')} placeholder="Telefon" className={inputCls} aria-label="Telefon" />
                {lawyer && <>
                    <input value={form.ico} onChange={set('ico')} placeholder="IČO (u firmy)" inputMode="numeric" maxLength={12} className={inputCls} aria-label="IČO" />
                    <label className="flex items-center gap-2 text-xs text-slate-600">Datum narození (u osoby)<input type="date" value={form.birth} onChange={set('birth')} className={`${inputCls} w-auto py-1.5`} aria-label="Datum narození" /></label>
                    <label className="flex items-start gap-2 text-sm text-slate-700 sm:col-span-2"><input type="checkbox" checked={form.watch} onChange={(e) => setForm((f) => ({ ...f, watch: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-indigo-800" /><span><strong>Hlídat v radaru</strong>: aplikace upozorní na insolvenci, likvidaci, zánik nebo změnu sídla a navrhne lhůtu. Firma se hlídá podle IČO, osoba podle data narození (insolvenci hlídá doplněk Hlídání insolvence).</span></label>
                    {form.watch && !form.ico && !form.birth && <p className="text-xs text-amber-800 sm:col-span-2">Pro hlídání vyplňte IČO (firma), nebo datum narození (osoba).</p>}
                </>}
                <input value={form.note} onChange={set('note')} placeholder="Poznámka (např. spisová značka, úřední hodiny)" maxLength={500} className={`${inputCls} sm:col-span-2`} aria-label="Poznámka ke kontaktu" />
                <button type="submit" disabled={!form.name.trim() || full} className={`${primaryBtn} sm:col-span-2 justify-center`}>Přidat kontakt</button>
                {full && <div className="sm:col-span-2"><UpgradeNote>Bezplatný účet umožňuje {limits.contactsPerCase} kontaktů na případ. Neomezeně přes</UpgradeNote></div>}
            </form>
        </div>
    );
}
