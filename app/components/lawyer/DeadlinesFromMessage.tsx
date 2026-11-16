'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, FileSearch, Loader2, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { insertRow } from '@/lib/caseFile';
import type { LegalCase } from '@/lib/cases';
import { saveMessageToCase } from '@/lib/dataMessages';
import { extractText } from '@/lib/docText';
import type { Downloaded, Record_ } from '@/lib/isds';
import { UNIT_LABELS, computeAbsolute, computeEnd, czDate, deliveryOf, explain, parseDateInput, pragueDate, unitText, type Unit } from '@/lib/lhuty';
import { TRIGGER_LABELS, analyzeText, type Analysis, type Candidate } from '@/lib/lhutyExtract';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';

type FileResult = { name: string; status: 'ok' | 'noText' | 'unsupported' | 'error'; analysis?: Analysis; reason?: string };
type Row = { key: string; sel: boolean; c: Candidate; title: string; n: string; unit: Unit; event: string; absolute: string; manual: boolean };

const fromBase64 = (b64: string, mime: string) => { const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new Blob([bytes], { type: mime || 'application/octet-stream' }); };
const CONF_TONE = { vysoka: 'bg-emerald-100 text-emerald-900', stredni: 'bg-amber-100 text-amber-900', nizka: 'bg-rose-100 text-rose-900' } as const;
const CONF_LABEL = { vysoka: 'jistější nález', stredni: 'zkontrolujte', nizka: 'nejistý nález' } as const;

// Návrh lhůt z datové zprávy: text z příloh se přečte v prohlížeči, nalezené lhůty se spočítají podle zákona a advokát je zkontroluje a potvrdí.
// Nic se neukládá samo. U každé lhůty je doslovný citát z dokumentu a vysvětlení výpočtu.
export default function DeadlinesFromMessage({ record, msg, downloadedNow, cases, userId, caseId, onSaved }: { record: Record_; msg: Downloaded; downloadedNow: boolean; cases: LegalCase[]; userId: string; caseId: string; onSaved: () => void }) {
    const today = pragueDate(new Date().toISOString());
    const delivery = useMemo(() => deliveryOf({ status: record.status, delivered: record.delivered, accepted: record.accepted, downloadedNow, today }), [record.status, record.delivered, record.accepted, downloadedNow, today]);
    const [deliveryText, setDeliveryText] = useState(czDate(delivery.date || today));
    const [files, setFiles] = useState<FileResult[] | null>(null);
    const [rows, setRows] = useState<Row[]>([]);
    const [confirm, setConfirm] = useState(false);
    const [manualRead, setManualRead] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState('');

    const deliveryIso = parseDateInput(deliveryText);
    const changed = !!deliveryIso && !!delivery.date && deliveryIso !== delivery.date;

    // Analýza příloh
    useEffect(() => {
        let alive = true;
        (async () => {
            const results: FileResult[] = [];
            const all: Row[] = [];
            for (const f of msg.files) {
                const r = await extractText(fromBase64(f.base64, f.mime), f.name, 80_000);
                if (!r.ok) { results.push({ name: f.name, status: /Tento typ/.test(r.reason) ? 'unsupported' : /žádný text/.test(r.reason) ? 'noText' : 'error', reason: r.reason }); continue; }
                const analysis = analyzeText(r.text, f.name);
                results.push({ name: f.name, status: 'ok', analysis });
                for (const c of analysis.candidates) all.push({ key: c.id, sel: c.confidence === 'vysoka', c, title: c.label, n: String(c.n ?? ''), unit: c.unit ?? 'den', event: c.trigger === 'doruceni' ? '' : '', absolute: c.date ? czDate(c.date) : '', manual: false });
            }
            if (alive) { setFiles(results); setRows(all); }
        })();
        return () => { alive = false; };
    }, [msg.files]);

    const patch = (key: string, p: Partial<Row>) => setRows((l) => l.map((r) => (r.key === key ? { ...r, ...p } : r)));
    const eventOf = (r: Row) => (r.c.trigger === 'doruceni' && !r.event ? deliveryIso : parseDateInput(r.event));
    function endOf(r: Row) {
        if (r.c.kind === 'absolutni') { const d = parseDateInput(r.absolute); return d ? computeAbsolute(d) : null; }
        const ev = eventOf(r); const n = Number(r.n);
        return ev && Number.isInteger(n) && n > 0 && n <= 1000 ? computeEnd(ev, n, r.unit) : null;
    }
    const picked = rows.filter((r) => r.sel);
    const computed = picked.map((r) => ({ r, e: endOf(r) }));
    const allValid = computed.every((x) => x.e) && computed.length > 0;
    const unreadable = (files ?? []).filter((f) => f.status !== 'ok');
    const needManual = unreadable.length > 0;
    const canSave = !!caseId && confirm && (!needManual || manualRead) && allValid && !busy && (delivery.certain || changed);

    function addManual() {
        const c: Candidate = { id: `manual#${Date.now()}`, label: 'Lhůta (ručně)', kind: 'relativni', n: 15, unit: 'den', trigger: 'doruceni', quote: '', confidence: 'stredni', warnings: [], source: 'ručně' };
        setRows((l) => [...l, { key: c.id, sel: true, c, title: c.label, n: '15', unit: 'den', event: '', absolute: '', manual: true }]);
    }

    async function save() {
        setBusy(true); setError(''); setDone('');
        try {
            await saveMessageToCase(userId, caseId, 'received', { id: record.id, sender: record.sender, recipient: record.recipient, annotation: record.annotation, delivered: record.delivered, accepted: record.accepted, status: record.status });
            let saved = 0; let dup = 0;
            for (const { r, e } of computed) {
                if (!e) continue;
                const n = Number(r.n);
                const deliveryNote = r.c.kind === 'absolutni' ? `Konec lhůty určuje rozhodnutí (${czDate(e.event)}).` : r.c.trigger === 'doruceni' && !r.event ? `${delivery.explanation}${changed ? ' Datum doručení bylo upraveno ručně.' : ''}` : `Počátek lhůty (${TRIGGER_LABELS[r.c.trigger]}) zadán ručně: ${czDate(e.event)}.`;
                const basis = r.c.kind === 'absolutni' ? `${deliveryNote}${e.shiftedFrom ? ` Den ${czDate(e.raw)} je nepracovní (${e.reasons.join('; ')}), posledním dnem je ${czDate(e.end)}.` : ''} Doporučeno podat nejpozději ${czDate(e.internal)}.` : explain(e, n, r.unit, deliveryNote);
                const title = `${r.title.trim() || 'Lhůta'}${r.c.kind === 'absolutni' ? '' : ` (${unitText(n, r.unit)})`} – datová zpráva`.slice(0, 120);
                try { await insertRow('case_deadlines', { case_id: caseId, user_id: userId, title, due_date: e.end, basis: basis.slice(0, 1500), quote: r.c.quote.slice(0, 1500), source_dm: record.id, internal_date: e.internal }); saved += 1; }
                catch (err) { if (err instanceof Error && /duplicate|unique|23505/i.test(err.message)) dup += 1; else throw err; }
            }
            if (saved) { try { await insertRow('case_entries', { case_id: caseId, user_id: userId, kind: 'event', title: `Lhůty z datové zprávy: ${record.annotation || 'bez věci'}`.slice(0, 200), body: computed.map(({ r, e }) => `${r.title}: ${e ? czDate(e.end) : ''}`).join('; ').slice(0, 900), happened_on: today }); } catch { /* chronologie není kritická */ } }
            await supabase.from('data_message_checks').upsert({ user_id: userId, dm_id: record.id, deadlines: saved + dup, checked_at: new Date().toISOString(), note: '' }, { onConflict: 'user_id,dm_id' });
            setDone(`Uloženo lhůt: ${saved}${dup ? `, ${dup} už ve věci bylo` : ''}. Najdete je v záložce Lhůty věci.`);
            onSaved();
        } catch (e) { setError(e instanceof Error ? e.message : 'Uložení se nepovedlo.'); }
        setBusy(false);
    }

    async function markNone() {
        setBusy(true); setError('');
        const { error: err } = await supabase.from('data_message_checks').upsert({ user_id: userId, dm_id: record.id, deadlines: 0, checked_at: new Date().toISOString(), note: 'Zkontrolováno, žádná lhůta.' }, { onConflict: 'user_id,dm_id' });
        setBusy(false);
        if (err) { setError(err.message); return; }
        setDone('Zpráva je označená jako zkontrolovaná (bez lhůty).');
        onSaved();
    }

    const caseTitle = cases.find((c) => c.id === caseId)?.title;
    return (
        <section className="mt-5 space-y-3 rounded-2xl border-2 border-indigo-300 bg-white p-4" aria-label="Lhůty z datové zprávy">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><CalendarClock size={18} className="text-indigo-700" aria-hidden="true" /> Lhůty z této zprávy</h3>
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-950"><ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> <span><strong>Pomocný nástroj, ne náhrada kontroly.</strong> Aplikace čte text příloh a nemusí najít všechny lhůty. Vždy si sami přečtěte poučení a ověřte každou lhůtu i její počátek, odpovědnost za dodržení lhůt nese advokát.</span></p>

            <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Rozhodné datum doručení</p>
                <div className="mt-1 flex flex-wrap items-center gap-2"><input value={deliveryText} onChange={(e) => setDeliveryText(e.target.value)} inputMode="numeric" aria-label="Datum doručení" aria-invalid={!deliveryIso} className={`${inputCls} max-w-[11rem]`} />{delivery.certain ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900">podle záznamu o doručení</span> : <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-900">zatím neurčité</span>}{changed && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">upraveno ručně</span>}</div>
                <p className="mt-1.5 text-xs text-slate-600">{delivery.explanation}</p>
                {delivery.warnings.map((w, i) => <p key={i} className="mt-1 flex items-start gap-1.5 text-xs text-amber-900"><AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> {w}</p>)}
                {!deliveryIso && <p className="mt-1 text-xs font-semibold text-rose-800">Datum zadejte ve tvaru D. M. RRRR.</p>}
            </div>

            {files === null ? <p className="flex items-center gap-2 text-sm text-slate-600" role="status"><Loader2 size={14} className="animate-spin" /> Čtu přílohy a hledám lhůty…</p> : (
                <>
                    <ul className="space-y-1 text-xs">
                        {files.map((f) => <li key={f.name} className={`flex items-start gap-1.5 ${f.status === 'ok' ? 'text-slate-600' : 'font-semibold text-rose-800'}`}><FileSearch size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> <span><strong>{f.name}</strong>: {f.status === 'ok' ? `přečteno${f.analysis?.docType ? ` (${f.analysis.docType})` : ''}, nalezeno lhůt: ${f.analysis?.candidates.length ?? 0}` : `NEPŘEČTENO. ${f.reason ?? ''} Lhůty v této příloze nejsou vyhodnocené, přečtěte ji ručně.`}</span></li>)}
                    </ul>
                    {unreadable.length > 0 && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-900">Pozor: {unreadable.length} z {files.length} příloh se nepodařilo přečíst. Lhůty v nich aplikace neposoudila.</p>}
                    {files.flatMap((f) => f.analysis?.notes ?? []).map((n, i) => <p key={i} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{n}</p>)}
                    {files.flatMap((f) => (f.analysis?.poucení ?? []).map((p) => ({ f: f.name, p }))).map((x, i) => <details key={i} className="rounded-lg border border-slate-200 p-3 text-xs"><summary className="cursor-pointer font-semibold text-slate-800">Poučení v dokumentu ({x.f}), přečtěte</summary><p className="mt-1.5 whitespace-pre-line leading-relaxed text-slate-700">{x.p}</p></details>)}

                    {rows.length > 0 && (
                        <ul className="space-y-3">
                            {rows.map((r) => { const e = endOf(r); const n = Number(r.n); return (
                                <li key={r.key} className={`rounded-xl border p-3 ${r.sel ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200'}`}>
                                    <div className="flex flex-wrap items-start gap-2">
                                        <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={r.sel} onChange={(ev) => patch(r.key, { sel: ev.target.checked })} className="h-4 w-4 accent-indigo-800" aria-label="Uložit tuto lhůtu" /></label>
                                        <input value={r.title} onChange={(ev) => patch(r.key, { title: ev.target.value })} maxLength={90} aria-label="Název lhůty" className={`${inputCls} min-w-[12rem] flex-1 font-semibold`} />
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${CONF_TONE[r.c.confidence]}`}>{r.manual ? 'ručně' : CONF_LABEL[r.c.confidence]}</span>
                                        {r.manual && <button type="button" onClick={() => setRows((l) => l.filter((x) => x.key !== r.key))} aria-label="Odebrat" className="rounded p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={14} /></button>}
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-end gap-3 text-xs">
                                        {r.c.kind === 'relativni' ? (
                                            <>
                                                <label className="font-semibold text-slate-600">Délka<span className="mt-1 flex gap-1"><input value={r.n} onChange={(ev) => patch(r.key, { n: ev.target.value.replace(/\D/g, '') })} inputMode="numeric" aria-label="Počet" className={`${inputCls} w-16`} /><select value={r.unit} onChange={(ev) => patch(r.key, { unit: ev.target.value as Unit })} aria-label="Jednotka" className={`${inputCls} w-28`}>{(Object.keys(UNIT_LABELS) as Unit[]).map((u) => <option key={u} value={u}>{UNIT_LABELS[u][2]}</option>)}</select></span></label>
                                                <label className="font-semibold text-slate-600">Počátek ({TRIGGER_LABELS[r.c.trigger]})<input value={r.c.trigger === 'doruceni' && !r.event ? (deliveryIso ? czDate(deliveryIso) : '') : r.event} onChange={(ev) => patch(r.key, { event: ev.target.value })} placeholder="D. M. RRRR" inputMode="numeric" aria-label="Datum počátku lhůty" className={`${inputCls} mt-1 w-36`} /></label>
                                            </>
                                        ) : <label className="font-semibold text-slate-600">Termín určený rozhodnutím<input value={r.absolute} onChange={(ev) => patch(r.key, { absolute: ev.target.value })} placeholder="D. M. RRRR" inputMode="numeric" aria-label="Termín" className={`${inputCls} mt-1 w-36`} /></label>}
                                        <div className="min-w-[12rem] flex-1 rounded-lg bg-white p-2.5">
                                            {e ? <><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Konec lhůty</p><p className="text-base font-bold text-indigo-900">{e.weekday} {czDate(e.end)}</p>{e.shiftedFrom && <p className="text-[11px] text-amber-900">posun z {czDate(e.shiftedFrom)}: {e.reasons.join('; ')}</p>}<p className="text-[11px] text-slate-500">Podat nejpozději {czDate(e.internal)}{r.c.kind === 'relativni' && Number.isFinite(n) ? ` (délka ${unitText(n, r.unit)})` : ''}</p></> : <p className="text-xs font-semibold text-rose-800">Doplňte počátek a délku, konec se nespočítá.</p>}
                                        </div>
                                    </div>
                                    {r.c.warnings.map((w, i) => <p key={i} className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-900"><AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> {w}</p>)}
                                    {r.c.quote && <blockquote className="mt-2 border-l-2 border-indigo-300 pl-2 text-xs italic leading-relaxed text-slate-600">{r.c.quote}<span className="not-italic text-slate-400"> ({r.c.source})</span></blockquote>}
                                </li>
                            ); })}
                        </ul>
                    )}
                    <button type="button" onClick={addManual} className={ghostBtn}><Plus size={14} /> Přidat lhůtu ručně</button>

                    <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                        <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-800" /><span>Přečetl(a) jsem poučení a dokument, lhůty a jejich počátek jsem zkontroloval(a) a potvrzuji je.</span></label>
                        {needManual && <label className="flex cursor-pointer items-start gap-2 text-sm font-semibold text-rose-900"><input type="checkbox" checked={manualRead} onChange={(e) => setManualRead(e.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-700" /><span>Nepřečtené přílohy ({unreadable.map((f) => f.name).join(', ')}) jsem zkontroloval(a) ručně.</span></label>}
                        {!caseId && <p className="text-xs font-semibold text-rose-800">Nahoře vyberte věc, do které se lhůty uloží.</p>}
                        {!delivery.certain && !changed && <p className="text-xs font-semibold text-rose-800">Zpráva ještě není doručená. Lhůta zatím neběží. Zadejte datum doručení ručně, pokud je jisté.</p>}
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => void save()} disabled={!canSave} className={primaryBtn}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Uložit vybrané lhůty{caseTitle ? ` do věci „${caseTitle}“` : ''} ({picked.length})</button>
                            <button type="button" onClick={() => void markNone()} disabled={!confirm || busy || picked.length > 0 || (needManual && !manualRead)} className={ghostBtn} title={picked.length ? 'Zrušte výběr lhůt' : undefined}>Zpráva bez lhůty: označit jako zkontrolovanou</button>
                        </div>
                    </div>
                </>
            )}
            {done && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{done}</p>}
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
        </section>
    );
}
