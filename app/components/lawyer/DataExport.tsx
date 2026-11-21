'use client';

import { useState } from 'react';
import { DatabaseBackup } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { buildDataExport, zipFiles } from '@/lib/dataExport';
import { primaryBtn } from '../situation/caseUi';

// Export všech dat do tabulek: záloha, přechod jinam, žádost klienta o jeho údaje
export default function DataExport() {
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');

    async function run() {
        setBusy(true); setError(''); setMsg('');
        try {
            const get = async (t: string) => { const r = await supabase.from(t).select('*'); if (r.error) throw new Error(`Tabulku „${t}“ se nepodařilo načíst.`); return (r.data ?? []) as Record<string, unknown>[]; };
            const [clients, cases, deadlines, contacts, entries, time] = await Promise.all(['lawyer_clients', 'cases', 'case_deadlines', 'case_contacts', 'case_entries', 'time_entries'].map(get));
            const built = buildDataExport({ clients, cases, deadlines, contacts, entries, time });
            const blob = await zipFiles(built.files);
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `kancelar-data-${new Date().toISOString().slice(0, 10)}.zip`; a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
            const c = built.counts;
            setMsg(`Hotovo: ${c.klienti} klientů, ${c.veci} spisů, ${c.lhuty} lhůt, ${c.kontakty} kontaktů, ${c.zapisy} zápisů, ${c.vykazy} výkazů.`);
        } catch (e) { setError(e instanceof Error ? e.message : 'Export se nepodařil.'); }
        setBusy(false);
    }

    return (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><DatabaseBackup size={18} className="text-indigo-700" aria-hidden="true" /> Export všech dat</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Klienti, spisy, lhůty, kontakty, zápisy a výkazy času v tabulkách (ZIP s CSV pro Excel). Vhodné jako záloha nebo pro přechod jinam: stejné tabulky umí načíst i Import. Neobsahuje soubory ve spisech (ty jsou v kartě spisu) ani faktury (ty jsou výše v exportu pro účetní).</p>
            <button type="button" onClick={() => void run()} disabled={busy} className={`${primaryBtn} mt-3`}>{busy ? 'Připravuji…' : 'Stáhnout všechna data'}</button>
            {msg && <p role="status" className="mt-2 text-sm text-emerald-800">{msg}</p>}
            {error && <p role="alert" className="mt-2 text-sm text-rose-800">{error}</p>}
        </section>
    );
}
