'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../site/AuthContext';
import { supabase } from '@/lib/supabase';
import { confirmAction } from '@/lib/confirm';
import AdminBilling from './AdminBilling';
import AdminFirms from './AdminFirms';
import AdminGrantPackage from './AdminGrantPackage';
import AdminIsir from './AdminIsir';
import AdminLawyers from './AdminLawyers';
import type { LawyerAccess } from '@/lib/lawyer';


// Správa přístupů do kanceláře: tým je aktivuje po zaplacení (zatím ručně)
export default function LawyerAdmin() {
    const { isStaff, authReady } = useAuth();
    const [rows, setRows] = useState<LawyerAccess[]>([]);
    const [message, setMessage] = useState('');
    const [reload, setReload] = useState(0);

    useEffect(() => {
        if (!isStaff) return;
        let cancelled = false;
        supabase.from('lawyer_access').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
            if (cancelled) return;
            if (error) setMessage('Kancelář není v databázi zapnutá (chybí SQL lawyer.sql).'); else setRows((data ?? []) as LawyerAccess[]);
        });
        return () => { cancelled = true; };
    }, [isStaff, reload]);

    if (!authReady) return <p className="max-w-3xl mx-auto px-4 py-12 text-sm text-slate-500" role="status">Načítám…</p>;
    if (!isStaff) return <p className="max-w-3xl mx-auto px-4 py-12 text-sm text-slate-600">Tato stránka je jen pro členy týmu.</p>;

    async function set(row: LawyerAccess, status: LawyerAccess['status'], until: string | null) {
        const who = row.display_name || row.email;
        if (!(await confirmAction(status === 'active' ? `Aktivovat přístup pro ${who}${until ? ` do ${new Date(`${until}T12:00:00`).toLocaleDateString('cs-CZ')}` : ''}?` : `Ukončit přístup pro ${who}? Data mu zůstanou jen ke čtení a funkce se zamknou.`, { danger: status !== 'active', confirmLabel: status === 'active' ? 'Aktivovat' : 'Ukončit přístup' }))) return;
        const { error } = await supabase.from('lawyer_access').update({ status, until }).eq('user_id', row.user_id);
        if (error) setMessage(error.message); else { setMessage(''); setReload((n) => n + 1); const { data: { user } } = await supabase.auth.getUser(); await supabase.from('ops_log').insert({ staff_id: user?.id, action: status === 'active' ? 'aktivace přístupu' : 'změna přístupu', target: row.email, detail: `${status}${until ? ` do ${until}` : ''}` }); }
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-slate-900">Advokáti a předplatné</h1>
            <p className="mt-1 text-sm text-slate-600">Přehled všech uživatelů s jejich profily, ceny a objednávky. Přístup se po zaplacení aktivuje sám, ruční aktivace je jen nouzová.</p>
            {message && <p role="alert" className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-slate-800">{message}</p>}

            <AdminGrantPackage onDone={() => setReload((n) => n + 1)} />
            <AdminIsir />
            <AdminFirms rows={rows} onDone={() => setReload((n) => n + 1)} />

            <AdminBilling rows={rows} />

            <AdminLawyers rows={rows} onSet={(r, st, until) => void set(r, st, until)} onDeleted={(m) => { setMessage(m); setReload((n) => n + 1); }} />
        </div>
    );
}
