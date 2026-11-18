'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, History, Loader2 } from 'lucide-react';
import { loadCases, type LegalCase } from '@/lib/cases';
import { ACTION_LABEL, COLUMN_LABEL, ENTITY_LABEL, auditCsv, loadAudit, type AuditRow } from '@/lib/audit';
import { downloadTextFile } from '@/lib/caseFile';
import { ghostBtn, inputCls } from '../situation/caseUi';

const TONE: Record<string, string> = { vytvoreno: 'bg-emerald-50 text-emerald-800', zmeneno: 'bg-amber-50 text-amber-900', smazano: 'bg-rose-50 text-rose-800', otevreno: 'bg-slate-100 text-slate-700', stazeno: 'bg-sky-50 text-sky-800', exportovano: 'bg-violet-50 text-violet-800' };

// Auditní záznam: kdo kdy co ve věcech otevřel nebo změnil. Jen ke čtení a s exportem do CSV.
export default function AuditLogView() {
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [caseId, setCaseId] = useState(() => (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('case') ?? ''));
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [action, setAction] = useState('');
    const [rows, setRows] = useState<AuditRow[] | null>(null);
    const [error, setError] = useState('');
    useEffect(() => { let a = true; loadCases().then((c) => { if (a) setCases(c); }).catch(() => undefined); return () => { a = false; }; }, []);
    const load = useCallback(() => {
        setRows(null); setError('');
        loadAudit({ caseId: caseId || undefined, from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined, to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined, limit: 2000 }).then(setRows).catch((e) => { setError(e instanceof Error ? e.message : 'Záznam se nepodařilo načíst.'); setRows([]); });
    }, [caseId, from, to]);
    useEffect(() => { const t = window.setTimeout(load, 0); return () => window.clearTimeout(t); }, [load]);
    const shown = (rows ?? []).filter((r) => !action || r.action === action);

    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><History size={18} className="text-indigo-800" aria-hidden="true" /> Auditní záznam</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Kdo, kdy a co ve věcech vytvořil, změnil, smazal, otevřel, stáhl nebo exportoval. Zapisuje se jen název záznamu a názvy změněných polí, nikdy obsah zpráv ani souborů. Záznam nejde upravit ani smazat. Vidíte události ve svých věcech a ve věcech, které s vámi kolegové sdílejí.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-xs font-semibold text-slate-600">Věc<select value={caseId} onChange={(e) => setCaseId(e.target.value)} className={`${inputCls} mt-1`}><option value="">Všechny věci</option>{cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
                    <label className="text-xs font-semibold text-slate-600">Od<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} mt-1`} /></label>
                    <label className="text-xs font-semibold text-slate-600">Do<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} mt-1`} /></label>
                    <label className="text-xs font-semibold text-slate-600">Událost<select value={action} onChange={(e) => setAction(e.target.value)} className={`${inputCls} mt-1`}><option value="">Všechny</option>{Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button type="button" disabled={!shown.length} onClick={() => downloadTextFile(`audit-${new Date().toISOString().slice(0, 10)}.csv`, auditCsv(shown), 'text/csv;charset=utf-8')} className={ghostBtn}><Download size={15} aria-hidden="true" /> Export do CSV ({shown.length})</button>
                    {rows && rows.length >= 2000 && <span className="text-xs text-amber-800">Zobrazeno nejvýše 2 000 nejnovějších událostí. Zúžte období.</span>}
                </div>
            </section>
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            {rows === null ? <p className="flex items-center gap-2 text-sm text-slate-500" role="status"><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Načítám…</p> : shown.length === 0 && !error ? <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">Žádné události pro zvolený filtr.</p> : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[44rem] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Čas</th><th className="px-3 py-2">Kdo</th><th className="px-3 py-2">Věc</th><th className="px-3 py-2">Událost</th><th className="px-3 py-2">Co</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {shown.map((r, i) => (
                                <tr key={`${r.at}-${i}`}>
                                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{new Date(r.at).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                    <td className="px-3 py-2 text-slate-800">{r.actor_name}</td>
                                    <td className="px-3 py-2 text-slate-700">{r.case_title ?? '–'}</td>
                                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${TONE[r.action]}`}>{ACTION_LABEL[r.action]}</span></td>
                                    <td className="px-3 py-2 text-slate-700">{ENTITY_LABEL[r.entity] ?? r.entity}{r.summary ? `: ${r.summary}` : ''}{r.changed.length > 0 && <span className="block text-xs text-slate-500">změněno: {r.changed.map((c) => COLUMN_LABEL[c] ?? c).join(', ')}</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
