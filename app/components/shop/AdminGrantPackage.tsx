'use client';

import { useState } from 'react';
import { Gift } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { opsLog } from '@/lib/opsLog';
import { FIRM_SIZES } from '@/lib/firm';
import { inputCls, primaryBtn } from '../situation/caseUi';

// Správce přidělí uživateli balíček kanceláře bez placení (zkoušení, dokud není platební brána)
export default function AdminGrantPackage({ onDone }: { onDone: () => void }) {
    const [email, setEmail] = useState('');
    const [seats, setSeats] = useState<number>(5);
    const [months, setMonths] = useState('3');
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);

    async function grant(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true); setMsg('');
        const { data, error } = await supabase.rpc('staff_grant_firm_package', { p_email: email, p_seats: seats, p_months: Number(months) || 1 });
        if (!error) await opsLog('přidělení balíčku kanceláře', email, `${seats} míst, ${months} měs.`);
        setBusy(false);
        setMsg(error ? (/function|schema cache/i.test(error.message) ? 'Chybí spuštění souboru testovaci-balicek.sql.' : error.message) : String(data));
        if (!error) onDone();
    }

    return (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Přidělit balíček kanceláře">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Gift size={18} className="text-indigo-700" /> Přidělit balíček kanceláře bez placení</h2>
            <p className="mt-1 text-xs text-slate-600">Uživateli s tímto e-mailem se založí kancelář (pokud žádnou nemá) a nastaví se jí balíček. Slouží ke zkoušení. Uživatel se musí nejdřív zaregistrovat.</p>
            <form onSubmit={grant} className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
                <label className="block text-xs font-semibold text-slate-600">E-mail uživatele<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputCls} mt-1 font-normal`} /></label>
                <label className="block text-xs font-semibold text-slate-600">Počet míst<select value={seats} onChange={(e) => setSeats(Number(e.target.value))} className={`${inputCls} mt-1 font-normal`}>{FIRM_SIZES.map((n) => <option key={n} value={n}>do {n}</option>)}</select></label>
                <label className="block text-xs font-semibold text-slate-600">Měsíců<input value={months} onChange={(e) => setMonths(e.target.value)} inputMode="numeric" className={`${inputCls} mt-1 font-normal`} /></label>
                <button type="submit" disabled={busy} className={primaryBtn}>Přidělit</button>
            </form>
            {msg && <p role="status" className="mt-3 text-sm text-slate-700">{msg}</p>}
        </section>
    );
}
