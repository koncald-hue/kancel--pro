'use client';

import { confirmAction } from '@/lib/confirm';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Undo2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ENTITY_LABEL, ENTITY_ORDER, FIELDS, buildRecords, detectEntity, planWorkbook, readFile, summarize, type Entity, type Existing, type Mapping, type Planned, type Sheet, type Table } from '@/lib/importer';
import { loadExisting, runWorkbook, undoImport, type WorkbookResult } from '@/lib/importRun';
import { useLawyer } from './LawyerGate';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { PRESETS, guessPreset, presetById, suggestWithPreset, type PresetId } from '@/lib/importPresets';

type Batch = { id: string; entity: Entity; source: string; counts: { created?: number; updated?: number }; undone: boolean; created_at: string };
const BADGE: Record<string, string> = { create: 'bg-emerald-100 text-emerald-900', update: 'bg-indigo-100 text-indigo-900', skip: 'bg-slate-100 text-slate-700', error: 'bg-rose-100 text-rose-900' };
const ACTION: Record<string, string> = { create: 'Nový', update: 'Doplnit', skip: 'Přeskočit', error: 'Chyba' };
const LINKS: Record<Entity, string> = { klienti: '/kancelar/klienti', veci: '/kancelar/veci', lhuty: '/kancelar/veci', kontakty: '/kancelar/veci', cas: '/kancelar/vykazy' };

type Part = { name: string; table: Table; entity: Entity; preset: PresetId; mapping: Mapping; include: boolean };
function partFrom(sheet: Sheet): Part {
    const t = sheet.table; const d = detectEntity(t.headers, sheet.name, t.rows); const preset = guessPreset(d.entity, t.headers) ?? 'auto';
    return { name: sheet.name, table: t, entity: d.entity, preset, mapping: suggestWithPreset(d.entity, t.headers, preset, t.rows), include: true };
}
const missingRequired = (p: Part) => [
    ...FIELDS[p.entity].filter((f) => f.required && !p.mapping.includes(f.key) && !(p.entity === 'klienti' && f.key === 'name' && (p.mapping.includes('first') || p.mapping.includes('company')))).map((f) => f.label),
    ...(p.entity === 'cas' && !p.mapping.some((m) => ['hours', 'minutes', 'duration'].includes(m)) ? ['čas (hodiny, minuty nebo čas ve tvaru 1:30)'] : []),
];

// Hromadný import: klienti, věci, lhůty, kontakty a čas z Excelu, CSV, vCard nebo z jiného programu. Sešit s víc listy se naimportuje najednou
// (klienti → věci → lhůty, kontakty, čas), chybějící klienti a věci se založí a vše se propojí. Před importem se ukáže, co se stane, a po něm jde vrátit.
export default function LawyerImport() {
    const { userId, access } = useLawyer();
    const [parts, setParts] = useState<Part[]>([]);
    const [active, setActive] = useState(0);
    const [fileName, setFileName] = useState('');
    const [existing, setExisting] = useState<Existing | null>(null);
    const [createMissing, setCreateMissing] = useState(true);
    const [createMissingCases, setCreateMissingCases] = useState(true);
    const [fillExisting, setFillExisting] = useState(true);
    const [paste, setPaste] = useState('');
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState('');
    const [result, setResult] = useState<(WorkbookResult & { entity: Entity }) | null>(null);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [only, setOnly] = useState<'all' | 'error'>('all');
    const file = useRef<HTMLInputElement>(null);

    const loadBatches = useCallback(async () => {
        const { data, error: e } = await supabase.from('import_batches').select('*').order('created_at', { ascending: false }).limit(10);
        if (!e) setBatches((data ?? []) as Batch[]);
    }, []);
    useEffect(() => { const t = window.setTimeout(() => { void loadBatches(); loadExisting().then(setExisting).catch((e: unknown) => setError(`Nepodařilo se načíst stávající klienty a spisy, import nelze spustit: ${e instanceof Error ? e.message : 'neznámá chyba'}`)); }, 0); return () => window.clearTimeout(t); }, [loadBatches]);

    async function load(bytes: Uint8Array, name: string) {
        setError(''); setResult(null);
        try {
            const list = await readFile(bytes, name);
            if (!list.length) { setError('V souboru jsem nenašel žádná data. Zkontrolujte, že má hlavičku (názvy sloupců) a aspoň jeden řádek.'); return; }
            const ps = list.map(partFrom);
            // Pořadí záložek jako pořadí importu: klienti, věci, lhůty, kontakty, čas
            ps.sort((a, b) => ENTITY_ORDER.indexOf(a.entity) - ENTITY_ORDER.indexOf(b.entity));
            setParts(ps); setActive(0); setFileName(name);
        } catch { setError('Soubor se nepodařilo přečíst. Zkuste ho uložit jako CSV nebo XLSX.'); }
    }
    async function onFile(f: File | undefined) { if (f) await load(new Uint8Array(await f.arrayBuffer()), f.name); }
    const update = (i: number, patch: Partial<Part>) => setParts((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

    const rows = useMemo(() => parts.map((p) => buildRecords(p.entity, p.table, p.mapping)), [parts]);
    const plans = useMemo(() => {
        if (!existing) return parts.map(() => [] as Planned[]);
        const idx = parts.map((p, i) => i).filter((i) => parts[i].include);
        const planned = planWorkbook(idx.map((i) => ({ entity: parts[i].entity, rows: rows[i] })), existing, { createMissingClients: createMissing, fillExisting, createMissingCases });
        const out = parts.map(() => [] as Planned[]); idx.forEach((i, k) => { out[i] = planned[k]; }); return out;
    }, [parts, rows, existing, createMissing, fillExisting, createMissingCases]);
    const sums = plans.map(summarize);
    const total = parts.reduce((n, p, i) => (p.include ? n + sums[i].create + sums[i].update : n), 0);
    const blocked = parts.map((p, i) => ({ p, i, miss: missingRequired(p) })).filter((x) => x.p.include && x.miss.length);
    const entities = new Set(parts.filter((p) => p.include).map((p) => p.entity));

    const part = parts[active]; const plan = plans[active] ?? []; const sum = sums[active];
    const sample = (i: number) => (part?.table.rows ?? []).slice(0, 3).map((r) => r[i]).filter(Boolean).join(' · ');

    async function start() {
        if (!existing) return;
        setBusy(true); setError(''); setProgress('Připravuji…');
        try {
            const steps = parts.map((p, i) => ({ entity: p.entity, plan: plans[i], include: p.include })).filter((s) => s.include).map(({ entity, plan: pl }) => ({ entity, plan: pl }));
            const src = fileName ? (steps.length > 1 ? `${fileName} (${steps.length} listy)` : fileName) : 'vložený text';
            const r = await runWorkbook(userId, steps, { source: src, defaultRate: Number(access.default_rate) || 0, clients: existing.clients }, (d, t, label) => setProgress(`${label}: ${d} z ${t}`));
            setResult({ ...r, entity: steps.length === 1 ? steps[0].entity : 'veci' }); setParts([]); setPaste('');
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
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Přeneste si data z Excelu, jiného programu nebo kontaktů. Nahrajte soubor <strong>XLSX, CSV nebo vCard</strong> (nebo vložte buňky z Excelu). Aplikace sama pozná, co je na kterém listu, přiřadí sloupce a vše propojí: spisy s klienty, lhůty, kontakty a čas se spisy. Co v kanceláři chybí, založí. Před importem uvidíte, co se stane, a po něm ho můžete jedním krokem vrátit.</p>
                <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void onFile(e.dataTransfer.files[0]); }} className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-5">
                    <FileUp size={22} className="text-indigo-700" aria-hidden="true" />
                    <button type="button" onClick={() => file.current?.click()} className={primaryBtn}>Vybrat soubor</button>
                    <span className="text-sm text-slate-500">nebo ho sem přetáhněte{fileName ? ` · ${fileName}` : ''}</span>
                    <input ref={file} type="file" accept=".csv,.tsv,.txt,.xlsx,.vcf,text/csv" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} className="sr-only" aria-label="Soubor k importu" />
                </div>
                <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-slate-700">Vložit z Excelu (zkopírované buňky)</summary>
                    <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} placeholder="Označte v Excelu tabulku včetně hlavičky, zkopírujte a vložte sem." className={`${inputCls} mt-2 font-mono text-xs`} />
                    <button type="button" disabled={paste.trim().length < 5} onClick={() => void load(new TextEncoder().encode(paste), 'vložený text')} className={`${ghostBtn} mt-2`}>Načíst vložený text</button></details>
                <details className="mt-3 text-sm text-slate-600"><summary className="cursor-pointer font-semibold text-slate-700">Jak získat data z jiného programu</summary>
                    <ul className="mt-2 list-disc space-y-1 pl-5"><li>Excel nebo Google Tabulky: Soubor → Stáhnout/Uložit jako → XLSX (všechny listy najednou) nebo CSV.</li><li>Kontakty z telefonu, Googlu nebo Outlooku: export do vCard (.vcf) nebo CSV.</li><li>Jiný kancelářský program: v exportu zvolte Excel/CSV. Klienty, spisy, lhůty, kontakty i čas můžete dát do jednoho sešitu, každé na vlastní list. Lhůty, kontakty a čas se k spisům připojí podle spisové značky nebo názvu spisu.</li></ul></details>
                {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            </section>

            {part && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                    {parts.length > 1 && (
                        <div>
                            <p className="text-xs font-semibold text-slate-600">Listy v souboru ({parts.length}). Naimportují se najednou v pořadí zleva doprava.</p>
                            <div className="mt-2 flex flex-wrap gap-2" role="tablist" aria-label="Listy v souboru">
                                {parts.map((p, i) => {
                                    const miss = p.include && missingRequired(p).length > 0;
                                    return <button key={i} type="button" role="tab" aria-selected={i === active} onClick={() => { setActive(i); setOnly('all'); }} className={`rounded-xl border px-3 py-2 text-left text-sm cursor-pointer ${i === active ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'} ${p.include ? '' : 'opacity-50'}`}>
                                        <span className="block font-semibold text-slate-900">{p.name}</span>
                                        <span className="block text-xs text-slate-500">{ENTITY_LABEL[p.entity]} · {p.include ? (miss ? <span className="text-amber-700">chybí sloupec</span> : `${sums[i].create + sums[i].update} k importu${sums[i].error ? `, ${sums[i].error} chyb` : ''}`) : 'nepřevezme se'}</span>
                                    </button>;
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap items-end gap-3">
                        <label className="text-xs font-semibold text-slate-600">Co list obsahuje<select value={part.entity} onChange={(e) => { const en = e.target.value as Entity; update(active, { entity: en, mapping: suggestWithPreset(en, part.table.headers, part.preset, part.table.rows) }); }} className={`${inputCls} mt-1 block font-normal`}>{(Object.keys(ENTITY_LABEL) as Entity[]).map((k) => <option key={k} value={k}>{ENTITY_LABEL[k]}</option>)}</select></label>
                        <label className="text-xs font-semibold text-slate-600">Zdroj dat<select value={part.preset} onChange={(e) => { const id = e.target.value as PresetId; update(active, { preset: id, mapping: suggestWithPreset(part.entity, part.table.headers, id, part.table.rows) }); }} className={`${inputCls} mt-1 block font-normal`}>{PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
                        <p className="text-sm text-slate-500">{part.table.rows.length} řádků</p>
                        {parts.length > 1 && <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={part.include} onChange={(e) => update(active, { include: e.target.checked })} className="accent-indigo-800" /> Importovat tento list</label>}
                        {part.preset !== 'auto' && <p className="basis-full text-xs text-slate-500">{presetById(part.preset).hint} Předvolba je návrh podle běžných názvů sloupců, ne ověřený formát exportu. Zkontrolujte přiřazení sloupců níže, než import potvrdíte.</p>}
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600"><tr><th className="px-3 py-2">Sloupec v souboru</th><th className="px-3 py-2">Ukázka</th><th className="px-3 py-2">Uložit do</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">{part.table.headers.map((h, i) => (
                                <tr key={i}><td className="px-3 py-2 font-semibold text-slate-800">{h}</td><td className="max-w-xs truncate px-3 py-2 text-slate-500">{sample(i)}</td>
                                    <td className="px-3 py-2"><select value={part.mapping[i] ?? ''} onChange={(e) => update(active, { mapping: part.mapping.map((x, j) => (j === i ? e.target.value : x === e.target.value && e.target.value ? '' : x)) })} className={`${inputCls} py-1.5`} aria-label={`Sloupec ${h}`}><option value="">— nepřevzít —</option>{FIELDS[part.entity].map((f) => <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>)}</select></td></tr>))}</tbody></table>
                    </div>
                    {part.include && missingRequired(part).length > 0 && <p role="alert" className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> Přiřaďte povinné údaje: {missingRequired(part).join(', ')}.</p>}

                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
                        {entities.has('klienti') && <label className="flex items-center gap-2"><input type="checkbox" checked={fillExisting} onChange={(e) => setFillExisting(e.target.checked)} className="accent-indigo-800" /> U stávajících klientů doplnit prázdné údaje</label>}
                        {entities.has('veci') && <label className="flex items-center gap-2"><input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} className="accent-indigo-800" /> Klienty, které v adresáři nejsou, založit</label>}
                        {(entities.has('lhuty') || entities.has('kontakty') || entities.has('cas')) && <label className="flex items-center gap-2"><input type="checkbox" checked={createMissingCases} onChange={(e) => setCreateMissingCases(e.target.checked)} className="accent-indigo-800" /> Spisy, které v kanceláři nejsou, založit</label>}
                    </div>

                    {!existing && !error && <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 size={14} className="animate-spin" /> Načítám stávající klienty a spisy…</p>}
                    <div className="grid gap-2 sm:grid-cols-5">
                        {([['Nových', sum.create, 'bg-emerald-50 text-emerald-900'], ['Doplnit', sum.update, 'bg-indigo-50 text-indigo-900'], ['Přeskočit (už existují)', sum.skip, 'bg-slate-50 text-slate-900'], ['Chyby', sum.error, 'bg-rose-50 text-rose-900'], ['Varování', sum.warnings, 'bg-amber-50 text-amber-900']] as const).map(([l, n, c]) => <div key={l} className={`rounded-xl p-3 ${c}`}><p className="text-xl font-bold">{n}</p><p className="text-xs text-slate-600">{l}</p></div>)}
                    </div>
                    {(sum.newClients > 0 || sum.newCases > 0) && <p className="text-xs text-slate-600">{sum.newClients > 0 ? `Založí se také ${sum.newClients} nových klientů a spisy se s nimi propojí. ` : ''}{sum.newCases > 0 ? `Založí se také ${sum.newCases} nových spisů a řádky se k nim připojí.` : ''}</p>}

                    <div className="flex items-center gap-2 text-xs"><button type="button" onClick={() => setOnly('all')} aria-pressed={only === 'all'} className={`rounded-full px-3 py-1 font-semibold ${only === 'all' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-700'}`}>Všechny</button><button type="button" onClick={() => setOnly('error')} aria-pressed={only === 'error'} className={`rounded-full px-3 py-1 font-semibold ${only === 'error' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-700'}`}>Jen chyby</button><span className="text-slate-500">Zobrazeno prvních {Math.min(100, plan.length)}</span></div>
                    <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 text-sm">
                        {shown.map((p) => <li key={p.row.index} className="flex flex-wrap items-center gap-2 px-3 py-2"><span className="w-10 shrink-0 text-xs text-slate-400">{p.row.index + 2}.</span><span className="min-w-0 flex-1 truncate text-slate-800">{p.row.rec.name || p.row.rec.title || p.row.rec.case || '—'}{p.row.rec.reference ? <span className="ml-1.5 text-xs text-slate-500">{p.row.rec.reference}</span> : null}</span><span className="min-w-0 max-w-sm truncate text-xs text-slate-500">{p.note || p.row.issues[0]?.text}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${BADGE[p.action]}`}>{ACTION[p.action]}</span></li>)}
                        {shown.length === 0 && <li className="px-3 py-4 text-slate-500">{part.include ? 'Žádné řádky k zobrazení.' : 'Tento list se nepřevezme.'}</li>}
                    </ul>
                    {blocked.length > 0 && <p role="alert" className="text-sm text-amber-900">Než půjde import spustit, doplňte povinné sloupce u listu: {blocked.map((b) => b.p.name).join(', ')} (nebo list vypněte).</p>}
                    <div className="flex flex-wrap items-center gap-3">
                        <button type="button" onClick={() => void start()} disabled={busy || !existing || blocked.length > 0 || total === 0} className={primaryBtn}>{busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} {parts.filter((p) => p.include).length > 1 ? `Importovat vše: ${total} záznamů` : `Importovat ${total} záznamů`}</button>
                        {progress && <span role="status" className="text-sm text-slate-600">{progress}</span>}
                        {sums.some((x, i) => parts[i].include && x.error > 0) && <span className="text-xs text-slate-500">Řádky s chybou se přeskočí.</span>}
                    </div>
                </section>
            )}

            {result && (
                <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950" role="status">
                    <p className="flex items-center gap-2 text-base font-bold"><CheckCircle2 size={18} aria-hidden="true" /> Import je hotový</p>
                    <p className="mt-1">Vytvořeno {result.created}{result.updated ? `, doplněno ${result.updated}` : ''}{result.clientsCreated ? `, k tomu nových klientů ze spisů ${result.clientsCreated}` : ''}{result.casesCreated ? `, nových spisů ${result.casesCreated}` : ''}.</p>{Object.keys(result.byEntity).length > 1 && <p className="mt-1 text-xs">{(Object.entries(result.byEntity) as [Entity, number][]).map(([k, n]) => `${ENTITY_LABEL[k]}: ${n}`).join(' · ')}</p>}
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
