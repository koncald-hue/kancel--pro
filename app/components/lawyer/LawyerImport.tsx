'use client';

import { confirmAction } from '@/lib/confirm';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Undo2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ENTITY_LABEL, FIELDS, buildRecords, detectEntity, planImport, readFile, summarize, type Entity, type Existing, type Mapping, type Sheet } from '@/lib/importer';
import { loadExisting, runImport, undoImport, type RunResult } from '@/lib/importRun';
import { useLawyer } from './LawyerGate';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { PRESETS, guessPreset, presetById, suggestWithPreset, type PresetId } from '@/lib/importPresets';

type Batch = { id: string; entity: Entity; source: string; counts: { created?: number; updated?: number }; undone: boolean; created_at: string };
const BADGE: Record<string, string> = { create: 'bg-emerald-100 text-emerald-900', update: 'bg-indigo-100 text-indigo-900', skip: 'bg-slate-100 text-slate-700', error: 'bg-rose-100 text-rose-900' };
const ACTION: Record<string, string> = { create: 'Nový', update: 'Doplnit', skip: 'Přeskočit', error: 'Chyba' };
const LINKS: Record<Entity, string> = { klienti: '/kancelar/klienti', veci: '/kancelar/veci', lhuty: '/kancelar/veci', kontakty: '/kancelar/veci', cas: '/kancelar/vykazy' };

// Hromadný import: klienti, věci, lhůty, kontakty a čas z Excelu, CSV, vCard nebo z jiného programu. Před importem se ukáže, co se stane, a po něm jde vrátit.
export default function LawyerImport() {
    const { userId, access } = useLawyer();
    const [sheets, setSheets] = useState<Sheet[]>([]);
    const [sheetIdx, setSheetIdx] = useState(0);
    const [fileName, setFileName] = useState('');
    const [entity, setEntity] = useState<Entity>('klienti');
    const [mapping, setMapping] = useState<Mapping>([]);
    const [preset, setPreset] = useState<PresetId>('auto');
    const [existing, setExisting] = useState<Existing | null>(null);
    const [createMissing, setCreateMissing] = useState(true);
    const [fillExisting, setFillExisting] = useState(true);
    const [paste, setPaste] = useState('');
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState('');
    const [result, setResult] = useState<(RunResult & { entity: Entity }) | null>(null);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [only, setOnly] = useState<'all' | 'error'>('all');
    const file = useRef<HTMLInputElement>(null);

    const loadBatches = useCallback(async () => {
        const { data, error: e } = await supabase.from('import_batches').select('*').order('created_at', { ascending: false }).limit(10);
        if (!e) setBatches((data ?? []) as Batch[]);
    }, []);
    useEffect(() => { const t = window.setTimeout(() => { void loadBatches(); loadExisting().then(setExisting).catch(() => undefined); }, 0); return () => window.clearTimeout(t); }, [loadBatches]);

    const table = sheets[sheetIdx]?.table;
    function choose(i: number, list: Sheet[] = sheets) {
        const t = list[i]?.table; if (!t) return;
        const d = detectEntity(t.headers); const guess = guessPreset(d.entity, t.headers) ?? 'auto'; setSheetIdx(i); setEntity(d.entity); setPreset(guess); setMapping(suggestWithPreset(d.entity, t.headers, guess)); setResult(null);
    }
    async function load(bytes: Uint8Array, name: string) {
        setError(''); setResult(null);
        try {
            const list = await readFile(bytes, name);
            if (!list.length) { setError('V souboru jsem nenašel žádná data. Zkontrolujte, že má hlavičku (názvy sloupců) a aspoň jeden řádek.'); return; }
            setSheets(list); setFileName(name); choose(0, list);
        } catch { setError('Soubor se nepodařilo přečíst. Zkuste ho uložit jako CSV nebo XLSX.'); }
    }
    async function onFile(f: File | undefined) { if (f) await load(new Uint8Array(await f.arrayBuffer()), f.name); }

    const rows = useMemo(() => (table ? buildRecords(entity, table, mapping) : []), [table, entity, mapping]);
    const plan = useMemo(() => (existing ? planImport(entity, rows, existing, { createMissingClients: createMissing, fillExisting }) : []), [entity, rows, existing, createMissing, fillExisting]);
    const sum = summarize(plan);
    const requiredMissing = FIELDS[entity].filter((f) => f.required && !mapping.includes(f.key) && !(entity === 'klienti' && f.key === 'name' && (mapping.includes('first') || mapping.includes('company'))) && !(entity === 'cas' && false));
    const timeMissing = entity === 'cas' && !mapping.some((m) => ['hours', 'minutes', 'duration'].includes(m));
    const sample = (i: number) => (table?.rows ?? []).slice(0, 3).map((r) => r[i]).filter(Boolean).join(' · ');

    async function start() {
        if (!existing) return;
        setBusy(true); setError(''); setProgress('Připravuji…');
        try {
            const r = await runImport(userId, entity, plan, { source: fileName || 'vložený text', defaultRate: Number(access.default_rate) || 0, clients: existing.clients }, (d, t, label) => setProgress(`${label}: ${d} z ${t}`));
            setResult({ ...r, entity }); setSheets([]); setPaste('');
            setExisting(await loadExisting()); await loadBatches();
        } catch (e) { setError(e instanceof Error ? e.message : 'Import se nepodařil.'); }
        setBusy(false); setProgress('');
    }
    async function undo(id: string) {
        if (!await confirmAction('Vrátit tento import? Smažou se všechny záznamy, které vytvořil (včetně toho, co jste k nim mezitím přidal). Doplněné údaje u stávajících klientů se nevracejí.', { title: 'Vrátit import?', confirmLabel: 'Vrátit import', danger: true, typeToConfirm: 'VRÁTIT' })) return;
        setBusy(true); setError('');
        try { await undoImport(id); setResult(null); await loadBatches(); setExisting(await loadExisting()); } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se.'); }
        setBusy(false);
    }

    const shown = plan.filter((p) => only === 'all' || p.action === 'error').slice(0, 100);
    return (
        <div className="max-w-5xl space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold text-slate-900">Import dat</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Přeneste si data z Excelu, jiného programu nebo kontaktů. Nahrajte soubor <strong>XLSX, CSV nebo vCard</strong> (nebo vložte buňky z Excelu). Aplikace sama pozná, co v souboru je, přiřadí sloupce a propojí věci s klienty. Před importem uvidíte, co se stane, a po něm ho můžete jedním krokem vrátit.</p>
                <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void onFile(e.dataTransfer.files[0]); }} className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-5">
                    <FileUp size={22} className="text-indigo-700" aria-hidden="true" />
                    <button type="button" onClick={() => file.current?.click()} className={primaryBtn}>Vybrat soubor</button>
                    <span className="text-sm text-slate-500">nebo ho sem přetáhněte{fileName ? ` · ${fileName}` : ''}</span>
                    <input ref={file} type="file" accept=".csv,.tsv,.txt,.xlsx,.vcf,text/csv" onChange={(e) => void onFile(e.target.files?.[0])} className="sr-only" aria-label="Soubor k importu" />
                </div>
                <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-slate-700">Vložit z Excelu (zkopírované buňky)</summary>
                    <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} placeholder="Označte v Excelu tabulku včetně hlavičky, zkopírujte a vložte sem." className={`${inputCls} mt-2 font-mono text-xs`} />
                    <button type="button" disabled={paste.trim().length < 5} onClick={() => void load(new TextEncoder().encode(paste), 'vložený text')} className={`${ghostBtn} mt-2`}>Načíst vložený text</button></details>
                <details className="mt-3 text-sm text-slate-600"><summary className="cursor-pointer font-semibold text-slate-700">Jak získat data z jiného programu</summary>
                    <ul className="mt-2 list-disc space-y-1 pl-5"><li>Excel nebo Google Tabulky: Soubor → Stáhnout/Uložit jako → CSV nebo XLSX.</li><li>Kontakty z telefonu, Googlu nebo Outlooku: export do vCard (.vcf) nebo CSV.</li><li>Jiný kancelářský program: v exportu zvolte Excel/CSV. Ke každé tabulce (klienti, věci, lhůty, čas) nahrajte jeden soubor, pořadí je dobré: klienti, věci, potom lhůty, kontakty a čas.</li></ul></details>
                {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            </section>

            {table && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                    <div className="flex flex-wrap items-end gap-3">
                        {sheets.length > 1 && <label className="text-xs font-semibold text-slate-600">List<select value={sheetIdx} onChange={(e) => choose(Number(e.target.value))} className={`${inputCls} mt-1 block font-normal`}>{sheets.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}</select></label>}
                        <label className="text-xs font-semibold text-slate-600">Co soubor obsahuje<select value={entity} onChange={(e) => { const en = e.target.value as Entity; setEntity(en); setMapping(suggestWithPreset(en, table.headers, preset)); }} className={`${inputCls} mt-1 block font-normal`}>{(Object.keys(ENTITY_LABEL) as Entity[]).map((k) => <option key={k} value={k}>{ENTITY_LABEL[k]}</option>)}</select></label>
                        <label className="text-xs font-semibold text-slate-600">Zdroj dat<select value={preset} onChange={(e) => { const id = e.target.value as PresetId; setPreset(id); setMapping(suggestWithPreset(entity, table.headers, id)); }} className={`${inputCls} mt-1 block font-normal`}>{PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
                        <p className="text-sm text-slate-500">{table.rows.length} řádků</p>
                        {preset !== 'auto' && <p className="basis-full text-xs text-slate-500">{presetById(preset).hint} Předvolba je návrh podle běžných názvů sloupců, ne ověřený formát exportu. Zkontrolujte přiřazení sloupců níže, než import potvrdíte.</p>}
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600"><tr><th className="px-3 py-2">Sloupec v souboru</th><th className="px-3 py-2">Ukázka</th><th className="px-3 py-2">Uložit do</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">{table.headers.map((h, i) => (
                                <tr key={i}><td className="px-3 py-2 font-semibold text-slate-800">{h}</td><td className="max-w-xs truncate px-3 py-2 text-slate-500">{sample(i)}</td>
                                    <td className="px-3 py-2"><select value={mapping[i] ?? ''} onChange={(e) => setMapping((m) => m.map((x, j) => (j === i ? e.target.value : x)))} className={`${inputCls} py-1.5`} aria-label={`Sloupec ${h}`}><option value="">— nepřevzít —</option>{FIELDS[entity].map((f) => <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>)}</select></td></tr>))}</tbody></table>
                    </div>
                    {(requiredMissing.length > 0 || timeMissing) && <p role="alert" className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> Přiřaďte povinné údaje: {[...requiredMissing.map((f) => f.label), ...(timeMissing ? ['čas (hodiny, minuty nebo čas ve tvaru 1:30)'] : [])].join(', ')}.</p>}

                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
                        {entity === 'veci' && <label className="flex items-center gap-2"><input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} className="accent-indigo-800" /> Klienty, které v adresáři nejsou, založit</label>}
                        {entity === 'klienti' && <label className="flex items-center gap-2"><input type="checkbox" checked={fillExisting} onChange={(e) => setFillExisting(e.target.checked)} className="accent-indigo-800" /> U stávajících klientů doplnit prázdné údaje</label>}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-5">
                        {([['Nových', sum.create, 'bg-emerald-50 text-emerald-900'], ['Doplnit', sum.update, 'bg-indigo-50 text-indigo-900'], ['Přeskočit (už existují)', sum.skip, 'bg-slate-50 text-slate-900'], ['Chyby', sum.error, 'bg-rose-50 text-rose-900'], ['Varování', sum.warnings, 'bg-amber-50 text-amber-900']] as const).map(([l, n, c]) => <div key={l} className={`rounded-xl p-3 ${c}`}><p className="text-xl font-bold">{n}</p><p className="text-xs text-slate-600">{l}</p></div>)}
                    </div>
                    {sum.newClients > 0 && <p className="text-xs text-slate-600">Založí se také {sum.newClients} nových klientů z věcí a věci se s nimi propojí.</p>}

                    <div className="flex items-center gap-2 text-xs"><button type="button" onClick={() => setOnly('all')} aria-pressed={only === 'all'} className={`rounded-full px-3 py-1 font-semibold ${only === 'all' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-700'}`}>Všechny</button><button type="button" onClick={() => setOnly('error')} aria-pressed={only === 'error'} className={`rounded-full px-3 py-1 font-semibold ${only === 'error' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-700'}`}>Jen chyby</button><span className="text-slate-500">Zobrazeno prvních {Math.min(100, plan.length)}</span></div>
                    <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 text-sm">
                        {shown.map((p) => <li key={p.row.index} className="flex flex-wrap items-center gap-2 px-3 py-2"><span className="w-10 shrink-0 text-xs text-slate-400">{p.row.index + 2}.</span><span className="min-w-0 flex-1 truncate text-slate-800">{p.row.rec.name || p.row.rec.title || p.row.rec.case || '—'}{p.row.rec.reference ? <span className="ml-1.5 text-xs text-slate-500">{p.row.rec.reference}</span> : null}</span><span className="min-w-0 max-w-sm truncate text-xs text-slate-500">{p.note || p.row.issues[0]?.text}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${BADGE[p.action]}`}>{ACTION[p.action]}</span></li>)}
                        {shown.length === 0 && <li className="px-3 py-4 text-slate-500">Žádné řádky k zobrazení.</li>}
                    </ul>
                    <div className="flex flex-wrap items-center gap-3">
                        <button type="button" onClick={() => void start()} disabled={busy || !existing || requiredMissing.length > 0 || timeMissing || sum.create + sum.update === 0} className={primaryBtn}>{busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Importovat {sum.create + sum.update} záznamů</button>
                        {progress && <span role="status" className="text-sm text-slate-600">{progress}</span>}
                        {sum.error > 0 && <span className="text-xs text-slate-500">Řádky s chybou se přeskočí.</span>}
                    </div>
                </section>
            )}

            {result && (
                <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950" role="status">
                    <p className="flex items-center gap-2 text-base font-bold"><CheckCircle2 size={18} aria-hidden="true" /> Import je hotový</p>
                    <p className="mt-1">Vytvořeno {result.created}{result.updated ? `, doplněno ${result.updated}` : ''}{result.clientsCreated ? `, nových klientů ${result.clientsCreated}` : ''}.</p>
                    <div className="mt-3 flex flex-wrap gap-2"><Link href={LINKS[result.entity]} className={primaryBtn}>Zobrazit</Link><button type="button" onClick={() => void undo(result.batchId)} disabled={busy} className={ghostBtn}><Undo2 size={14} /> Vrátit import</button></div>
                </section>
            )}

            {batches.length > 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold text-slate-900">Předchozí importy</h2>
                    <ul className="mt-2 divide-y divide-slate-100 text-sm">{batches.map((b) => <li key={b.id} className="flex flex-wrap items-center gap-3 py-2"><span className="flex-1"><strong>{ENTITY_LABEL[b.entity]}</strong> · {b.source} <span className="text-xs text-slate-500">· {new Date(b.created_at).toLocaleString('cs-CZ')} · {b.counts.created ?? 0} záznamů</span></span>{b.undone ? <span className="text-xs text-slate-500">vráceno</span> : <button type="button" onClick={() => void undo(b.id)} disabled={busy} className={ghostBtn}><Undo2 size={14} /> Vrátit</button>}</li>)}</ul></section>
            )}
        </div>
    );
}
