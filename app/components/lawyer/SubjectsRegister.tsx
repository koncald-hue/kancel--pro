'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Contact, Mail, Phone, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { buildSubjects, type SourceClient, type SourceContact, type Subject } from '@/lib/subjects';
import { inputCls } from '../situation/caseUi';

// Subjekty napříč věcmi: jedna osoba nebo firma s kontakty, rolemi a odkazy na všechny věci, ve kterých se objevuje.
// Sloučení se počítá z existujících kontaktů a klientů (IČO, e-mail, telefon, jméno), nic navíc se nezakládá.
export default function SubjectsRegister() {
    const [subjects, setSubjects] = useState<Subject[] | null>(null);
    const [q, setQ] = useState('');
    const [multi, setMulti] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        const [c, cl, cs] = await Promise.all([
            supabase.from('case_contacts').select('id, case_id, role, name, email, phone, ico'),
            supabase.from('lawyer_clients').select('id, name, email, phone'),
            supabase.from('cases').select('id, title'),
        ]);
        const err = c.error ?? cl.error ?? cs.error;
        if (err) { setError(err.message); setSubjects([]); return; }
        setSubjects(buildSubjects((c.data ?? []) as SourceContact[], (cl.data ?? []) as SourceClient[], (cs.data ?? []) as { id: string; title: string }[]));
    }, []);
    useEffect(() => { let alive = true; Promise.resolve().then(() => { if (alive) void load(); }); return () => { alive = false; }; }, [load]);

    const shown = useMemo(() => {
        const n = q.trim().toLowerCase();
        return (subjects ?? []).filter((s) => (!multi || s.appearances.length > 1) && (!n || `${s.name} ${s.emails.join(' ')} ${s.phones.join(' ')} ${s.icos.join(' ')}`.toLowerCase().includes(n)));
    }, [subjects, q, multi]);

    return (
        <div className="mx-auto max-w-5xl space-y-5">
            <header>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Contact size={22} className="text-indigo-800" /> Subjekty</h1>
                <p className="mt-1 text-sm text-slate-600">Všechny osoby a firmy z vašich věcí na jednom místě. Stejná osoba z více věcí (podle IČO, e-mailu, telefonu nebo jména) je sloučená a vidíte, kde všude vystupuje.</p>
            </header>
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-0 flex-1 sm:max-w-sm"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Jméno, IČO, e-mail, telefon…" aria-label="Hledat subjekt" className={`${inputCls} pl-9`} /></div>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} className="accent-indigo-800" /> Jen ve více věcech</label>
                {subjects && <span className="text-xs text-slate-500">{shown.length} z {subjects.length}</span>}
            </div>
            {subjects === null ? <p className="text-sm text-slate-500" role="status">Načítám…</p> : shown.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">{subjects.length === 0 ? 'Zatím tu nejsou žádné subjekty. Objeví se, jakmile přidáte kontakty do věcí nebo klienty.' : 'Nic neodpovídá hledání.'}</p>
            ) : (
                <ul className="space-y-3">
                    {shown.slice(0, 200).map((s) => (
                        <li key={s.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-base font-bold text-slate-900">{s.name}{s.clientIds.length > 0 && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 align-middle text-[11px] font-bold uppercase text-indigo-900">Klient</span>}</p>
                                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                                        {s.icos.map((i) => <span key={i}>IČO {i}</span>)}
                                        {s.emails.map((e) => <a key={e} href={`mailto:${e}`} className="inline-flex items-center gap-1 hover:underline"><Mail size={12} aria-hidden="true" />{e}</a>)}
                                        {s.phones.map((p) => <a key={p} href={`tel:${p.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 hover:underline"><Phone size={12} aria-hidden="true" />{p}</a>)}
                                    </p>
                                </div>
                                {s.appearances.length > 0 && <span className="shrink-0 text-xs font-semibold text-slate-500">{s.appearances.length} {s.appearances.length === 1 ? 'věc' : s.appearances.length < 5 ? 'věci' : 'věcí'}</span>}
                            </div>
                            {s.appearances.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{s.appearances.map((a) => <li key={a.contactId}><Link href={`/kancelar/veci/${a.caseId}`} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50">{a.caseTitle}{a.role && <span className="font-normal text-slate-500">· {a.role}</span>}</Link></li>)}</ul>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
