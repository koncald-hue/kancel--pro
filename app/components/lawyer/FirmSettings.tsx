'use client';

import { confirmAction } from '@/lib/confirm';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Check, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ROLE_HELP, ROLE_LABELS, canManageFirm, type FirmOverview, type FirmRole } from '@/lib/firm';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';

const dateCz = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ') : '–');

// Nastavení kanceláře: každý vidí své místo v kanceláři, měnit ji smí jen vedoucí
export default function FirmSettings() {
    const [overview, setOverview] = useState<FirmOverview | null | undefined>(undefined);
    const [name, setName] = useState('');
    const [msg, setMsg] = useState('');

    const load = useCallback(async () => {
        const { data } = await supabase.rpc('firm_overview');
        const o = (data as FirmOverview | null) ?? null;
        setOverview(o);
        if (o) setName(o.firm.name);
    }, []);

    useEffect(() => {
        let cancelled = false;
        void (async () => { await Promise.resolve(); if (!cancelled) await load(); })();
        return () => { cancelled = true; };
    }, [load]);

    async function rename() {
        const { error } = await supabase.rpc('rename_firm', { p_name: name });
        setMsg(error ? (/function|schema cache/i.test(error.message) ? 'Role zatím nejsou v databázi zapnuté (chybí spuštění souboru role.sql).' : error.message) : 'Název kanceláře je uložen.');
        if (!error) await load();
    }

    async function leave() {
        if (!await confirmAction('Opravdu opustit kancelář? Ztratíte přístup z jejího balíčku. Vaše data zůstanou vaše.')) return;
        const { error } = await supabase.rpc('leave_firm');
        if (error) setMsg(error.message); else window.location.reload();
    }

    if (overview === undefined) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (overview === null) return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Building2 size={18} className="text-indigo-700" /> Kancelář</h2>
            <p className="mt-2 text-sm text-slate-600">Zatím nejste členem žádné kanceláře. Kancelář můžete založit nebo se k ní připojit pozvánkou v záložce Tým.</p>
            <Link href="/kancelar/tym" className={`${primaryBtn} mt-4 inline-flex`}>Otevřít Tým</Link>
        </section>
    );

    const f = overview.firm;
    const role: FirmRole = f.role;
    const isOwner = role === 'owner';
    const active = f.seats > 0 && !!f.until && f.until >= new Date().toISOString().slice(0, 10);

    return (
        <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Kancelář">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Building2 size={18} className="text-indigo-700" /> {f.name}</h2>
                <p className="mt-1 text-sm text-slate-600">Vaše role: <strong>{ROLE_LABELS[role]}</strong>. {ROLE_HELP[role]}</p>
                <p className="mt-2 text-sm text-slate-700">Balíček: {active ? <strong>pro {f.seats} do {dateCz(f.until)}</strong> : <span className="text-slate-500">není aktivní</span>}</p>
                {isOwner ? (
                    <div className="mt-4">
                        <label className="block text-sm font-semibold text-slate-700">Název kanceláře<input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={`${inputCls} mt-1 max-w-md font-normal`} /></label>
                        <button type="button" onClick={() => void rename()} disabled={name.trim().length < 2 || name.trim() === f.name} className={`${primaryBtn} mt-3`}><Check size={16} /> Uložit název</button>
                    </div>
                ) : (
                    <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><Lock size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" /> Nastavení kanceláře (název, balíček, role) smí měnit jen vedoucí. Své osobní údaje upravíte v záložce Můj profil.</p>
                )}
                {msg && <p role="status" className="mt-3 text-sm text-slate-700">{msg}</p>}
            </section>

            {canManageFirm(role) && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Správa členů">
                    <h2 className="text-lg font-bold text-slate-900">Členové a pozvánky</h2>
                    <p className="mt-1 text-sm text-slate-600">{isOwner ? 'Zvete kolegy, odebírejte členy, přidělujte role (správce, člen) a pořizujte balíček.' : 'Zvete kolegy a odebírejte členy. Role a balíček spravuje vedoucí.'}</p>
                    <Link href="/kancelar/tym" className={`${primaryBtn} mt-3 inline-flex`}>Otevřít Tým</Link>
                </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Role">
                <h2 className="text-lg font-bold text-slate-900">Role v kanceláři</h2>
                <dl className="mt-3 space-y-3 text-sm">
                    {(['owner', 'admin', 'member'] as FirmRole[]).map((r) => <div key={r}><dt className="font-semibold text-slate-900">{ROLE_LABELS[r]}{r === role && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-900">vy</span>}</dt><dd className="text-slate-600">{ROLE_HELP[r]}</dd></div>)}
                </dl>
                <p className="mt-3 text-xs text-slate-500">Role přiděluje jen vedoucí. Obsah cizích spisů, klientů a zpráv nevidí nikdo z nich, ani vedoucí.</p>
            </section>

            {!isOwner && <button type="button" onClick={() => void leave()} className={`${ghostBtn} text-rose-700`}>Opustit kancelář</button>}
        </div>
    );
}
