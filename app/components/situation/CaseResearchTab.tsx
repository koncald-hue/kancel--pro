'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpenCheck, Check, ExternalLink, FileText, KeyRound, Link2, Loader2, Lock, NotebookText, Quote, Scale, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { insertRow } from '@/lib/caseFile';
import { useMasterKey } from '@/lib/useE2ee';
import { disconnect, legalApi, loadConnection, startConnect, validToken, type Connection } from '@/lib/legalClient';
import { anonymize, MAX_DOCS, type Evaluation, type NameRule, type Source } from '@/lib/legalResearch';
import { MAX_TOTAL_CHARS, extOf, extractText, isExtractable } from '@/lib/docText';
import { ghostBtn, inputCls, primaryBtn, type TabProps } from './caseUi';

type Result = { question: string; queries: string[]; provisions: string[]; sources: Source[]; summaries: string[]; evaluation: Evaluation | null; ai: boolean };
type Saved = { id: string; question: string; result: Result; created_at: string };

type Picked = { name: string; hint: string; status: 'loading' | 'ok' | 'error'; text?: string; truncated?: boolean; reason?: string };
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('cs-CZ');
const TONE: Record<string, string> = { silný: 'bg-emerald-100 text-emerald-900', střední: 'bg-amber-100 text-amber-900', slabý: 'bg-rose-100 text-rose-900', vysoká: 'bg-emerald-100 text-emerald-900', nízká: 'bg-slate-100 text-slate-700' };

// Právní rešerše ve věci: dotaz do právní databáze DirectCase (vlastní účet advokáta), anonymizovaný vstup, ověřené citace
export default function CaseResearchTab({ item, bundle, userId, fail }: TabProps) {
    const master = useMasterKey();
    const [conn, setConn] = useState<Connection | null | 'broken' | undefined>(undefined);
    const [connError, setConnError] = useState('');
    const [question, setQuestion] = useState('');
    const [facts, setFacts] = useState(() => [item.situation, item.summary].filter(Boolean).join('\n\n').slice(0, 4000));
    const [consent, setConsent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<Result | null>(null);
    const [saved, setSaved] = useState<Saved[] | null | undefined>(undefined);
    const [picked, setPicked] = useState<Record<string, Picked>>({});

    // Jména ve věci, která se před odesláním nahradí (klient a kontakty)
    const names: NameRule[] = useMemo(() => [
        ...(item.client_name ? [{ name: item.client_name, label: 'klient' }] : []),
        ...bundle.contacts.filter((c) => c.name).map((c, i) => ({ name: c.name, label: `${c.role || 'osoba'} ${String.fromCharCode(65 + (i % 26))}`.toLowerCase() })),
    ], [item.client_name, bundle.contacts]);
    const anon = useMemo(() => anonymize(facts, names), [facts, names]);
    const anonQuestion = useMemo(() => anonymize(question, names), [question, names]);
    // Vybrané dokumenty: text se anonymizuje a pod obecným názvem („Dokument 1 (PDF)“) odchází bez skutečného jména souboru
    const docs = useMemo(() => {
        let budget = MAX_TOTAL_CHARS;
        return Object.values(picked).filter((p) => p.status === 'ok' && p.text).map((p, i) => {
            const a = anonymize(p.text ?? '', names);
            const text = a.text.slice(0, Math.max(budget, 0));
            budget -= text.length;
            return { label: `Dokument ${i + 1} (${p.hint})`, name: p.name, text, replaced: a.replaced, cut: text.length < a.text.length || !!p.truncated };
        });
    }, [picked, names]);
    const pickedCount = Object.keys(picked).length;

    async function toggleDoc(key: string, name: string, hint: string, load: () => Promise<{ ok: true; text: string; truncated?: boolean } | { ok: false; reason: string }>) {
        if (picked[key]) { setPicked((p) => { const n = { ...p }; delete n[key]; return n; }); return; }
        if (pickedCount >= MAX_DOCS) { setError(`Vybrat jde nejvýše ${MAX_DOCS} dokumentů.`); return; }
        setError('');
        setPicked((p) => ({ ...p, [key]: { name, hint, status: 'loading' } }));
        const r = await load();
        setPicked((p) => (p[key] ? { ...p, [key]: r.ok ? { name, hint, status: 'ok', text: r.text, truncated: r.truncated } : { name, hint, status: 'error', reason: r.reason } } : p));
    }
    const loadFile = (path: string, name: string) => async () => {
        const { data, error: err } = await supabase.storage.from('case-files').download(path);
        if (err || !data) return { ok: false as const, reason: 'Soubor se nepodařilo stáhnout.' };
        return extractText(data, name);
    };

    const loadSaved = useCallback(async () => {
        const { data, error: err } = await supabase.from('case_research').select('*').eq('case_id', item.id).order('created_at', { ascending: false });
        if (err) { setSaved(null); return; }
        setSaved((data ?? []) as Saved[]);
    }, [item.id]);
    useEffect(() => { let alive = true; Promise.resolve().then(() => { if (alive) void loadSaved(); }); return () => { alive = false; }; }, [loadSaved]);

    useEffect(() => {
        if (!master) return;
        let alive = true;
        loadConnection(master).then((c) => { if (alive) setConn(c); }).catch((e) => { if (alive) { setConn(null); setConnError(/legal_connections|schema cache|does not exist/i.test(String(e?.message)) ? 'Právní rešerše zatím nejsou v databázi zapnuté (chybí spuštění souboru pravni-rese.sql).' : String(e?.message ?? 'Chyba.')); } });
        return () => { alive = false; };
    }, [master]);

    async function connect() {
        setError('');
        try { window.location.href = await startConnect(`${window.location.pathname}`); } catch (e) { setError(e instanceof Error ? e.message : 'Připojení se nepodařilo.'); }
    }

    async function run() {
        if (!master || !conn || conn === 'broken') return;
        setBusy(true); setError(''); setResult(null);
        try {
            const { token, connection } = await validToken(master, userId, conn);
            if (connection !== conn) setConn(connection);
            const r = await legalApi({ action: 'research', accessToken: token, question: anonQuestion.text, facts: anon.text, documents: docs.map((d) => ({ label: d.label, text: d.text })), consent: true });
            if (r.status === 401) throw new Error('Přihlášení k DirectCase vypršelo nebo bylo odmítnuto. Připojte se znovu.');
            if (!r.ok) throw new Error(typeof r.json.message === 'string' ? r.json.message : r.status === 429 ? 'Příliš mnoho rešerší, zkuste to později.' : 'Rešerše se nepodařila.');
            setResult(r.json as unknown as Result);
        } catch (e) { setError(e instanceof Error ? e.message : 'Rešerše se nepodařila.'); }
        setBusy(false);
    }

    async function save() {
        if (!result) return;
        try {
            await insertRow('case_research', { case_id: item.id, user_id: userId, question: result.question.slice(0, 1500), result });
            await loadSaved();
        } catch (e) { fail(e); }
    }
    async function removeSaved(id: string) {
        if (!window.confirm('Smazat uloženou rešerši?')) return;
        const { error: err } = await supabase.from('case_research').delete().eq('id', id);
        if (err) fail(new Error(err.message)); else setSaved((l) => (l ?? []).filter((x) => x.id !== id));
    }

    const sourceChip = (id: string, r: Result) => <a key={id} href={`#res-${id}`} className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-bold text-indigo-900 hover:bg-indigo-100" title={r.sources.find((s) => s.id === id)?.title}>{id}</a>;

    if (!master) return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <KeyRound size={24} className="text-indigo-700" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-bold text-slate-900">Nejdřív odemkněte šifrovací heslo</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Přihlášení k právní databázi se ukládá zašifrované vaším šifrovacím heslem. Odemkněte ho v Nastavení.</p>
            <a href="/kancelar/nastaveni" className={`${primaryBtn} mt-4`}>Otevřít Nastavení</a>
        </div>
    );
    if (conn === undefined) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;

    return (
        <div className="space-y-5">
            {connError && <p role="alert" className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">{connError}</p>}

            {(conn === null || conn === 'broken') ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-6">
                    <BookOpenCheck size={26} className="text-indigo-700" aria-hidden="true" />
                    <h2 className="mt-3 text-lg font-bold text-slate-900">Právní rešerše s judikaturou</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Kancelář vyhledá judikaturu Ústavního, Nejvyššího a dalších soudů a znění předpisů v právní databázi <strong>DirectCase</strong> a vyhodnotí je k vaší věci. Každý argument má odkaz na zdroj a citace se ověřují. Potřebujete vlastní účet DirectCase (část dotazů je zdarma, dál podle jejich ceníku).</p>
                    {conn === 'broken' && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">Uložené přihlášení se nepodařilo dešifrovat. Odemkněte správné šifrovací heslo, nebo se připojte znovu.</p>}
                    <button type="button" onClick={() => void connect()} className={`${primaryBtn} mt-4`}><Link2 size={15} /> Připojit účet DirectCase</button>
                    {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
                </section>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950"><Check size={15} aria-hidden="true" /><span className="flex-1">Právní databáze DirectCase je připojená.</span><button type="button" onClick={() => { if (window.confirm('Odpojit DirectCase?')) void disconnect().then(() => setConn(null)); }} className={ghostBtn}>Odpojit</button></div>

                    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Nová rešerše">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Scale size={18} className="text-indigo-700" /> Nová rešerše</h2>
                        <label className="block text-xs font-semibold text-slate-600">Právní otázka *<textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} maxLength={1500} placeholder="např. Kdy začíná běžet subjektivní promlčecí lhůta u práva na vydání bezdůvodného obohacení, když ochuzený o plnění nevěděl?" className={`${inputCls} mt-1 font-normal`} /></label>
                        <label className="block text-xs font-semibold text-slate-600">Skutkový popis (předvyplněno z věci, upravte)<textarea value={facts} onChange={(e) => setFacts(e.target.value)} rows={5} maxLength={6000} className={`${inputCls} mt-1 font-normal`} /></label>
                        <fieldset className="rounded-xl border border-slate-200 p-3">
                            <legend className="px-1 text-xs font-semibold text-slate-600">Podklady ze spisu (nepovinné, vybrané dokumenty se zanalyzují a anonymizují)</legend>
                            {bundle.entries.length === 0 && bundle.files.length === 0 ? <p className="text-xs text-slate-500">Ve věci zatím nejsou žádné zápisy ani soubory.</p> : (
                                <ul className="max-h-56 space-y-1 overflow-y-auto">
                                    {bundle.entries.map((e) => { const key = `e:${e.id}`; const p = picked[key]; return (
                                        <li key={key}><label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={!!p} onChange={() => void toggleDoc(key, e.title, 'zápis', async () => ({ ok: true, text: `${e.title}\n${e.body}`.slice(0, 8000) }))} className="mt-1 h-4 w-4 accent-indigo-800" /><NotebookText size={14} className="mt-1 shrink-0 text-slate-400" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{e.title || '(zápis)'}<span className="ml-1.5 text-xs text-slate-400">zápis</span></span></label></li>
                                    ); })}
                                    {bundle.files.filter((f) => !f.enc).map((f) => { const key = `f:${f.id}`; const p = picked[key]; const ok = isExtractable(f.name); return (
                                        <li key={key}><label className={`flex items-start gap-2 text-sm ${ok ? 'cursor-pointer text-slate-700' : 'cursor-not-allowed text-slate-400'}`}><input type="checkbox" checked={!!p} disabled={!ok} onChange={() => void toggleDoc(key, f.name, extOf(f.name) === 'docx' ? 'Word' : extOf(f.name).toUpperCase(), loadFile(f.path, f.name))} className="mt-1 h-4 w-4 accent-indigo-800" /><FileText size={14} className="mt-1 shrink-0 text-slate-400" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{f.name}{!ok && <span className="ml-1.5 text-xs">nelze přečíst</span>}{p?.status === 'loading' && <Loader2 size={12} className="ml-1.5 inline animate-spin" />}{p?.status === 'error' && <span className="ml-1.5 text-xs font-semibold text-rose-700">{p.reason}</span>}</span></label></li>
                                    ); })}
                                </ul>
                            )}
                            <p className="mt-2 text-[11px] text-slate-500">Čtou se jen soubory txt, Word a PDF s textem (do {MAX_DOCS} dokumentů, celkem asi {Math.round(MAX_TOTAL_CHARS / 1000)} tisíc znaků). Soubory se čtou ve vašem prohlížeči a do DirectCase i AI odejde jen anonymizovaný text pod názvem „Dokument 1“, bez jmen souborů. Šifrované soubory z klientského odkazu se nečtou.</p>
                        </fieldset>
                        <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" open>
                            <summary className="flex cursor-pointer items-center gap-2 font-semibold text-slate-800"><Lock size={14} aria-hidden="true" /> Co se odešle (po anonymizaci)</summary>
                            <p className="mt-2 whitespace-pre-line rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-700">{(anonQuestion.text || '(otázka)') + '\n\n' + (anon.text || '(skutkový popis)')}</p>
                            {docs.map((d) => (
                                <details key={d.label} className="mt-2 rounded-lg bg-white p-3 text-xs"><summary className="cursor-pointer font-semibold text-slate-800">{d.label} <span className="font-normal text-slate-500">({d.name}, {d.text.length} znaků{d.cut ? ', zkráceno' : ''})</span></summary><p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-line leading-relaxed text-slate-700">{d.text}</p>{Object.keys(d.replaced).length > 0 && <p className="mt-1 text-slate-500">Nahrazeno: {Object.entries(d.replaced).map(([k, v]) => `${k} (${v}×)`).join(', ')}</p>}</details>
                            ))}
                            <p className="mt-2 text-xs text-slate-500">{Object.keys({ ...anon.replaced, ...anonQuestion.replaced }).length ? `Nahrazeno: ${Object.entries({ ...anon.replaced }).map(([k, v]) => `${k} (${v}×)`).join(', ')}. ` : ''}Automatická anonymizace nezachytí vše (např. adresy nebo neobvyklá jména). Text si před odesláním přečtěte a případně upravte.</p>
                        </details>
                        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-800" /><span>Souhlasím s odesláním tohoto anonymizovaného textu (včetně vybraných podkladů ze spisu) do právní databáze DirectCase a službě umělé inteligence. Odpovídám za to, že neobsahuje údaje, které nesmím sdílet.</span></label>
                        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
                        <button type="button" onClick={() => void run()} disabled={busy || !consent || question.trim().length < 10} className={primaryBtn}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} {busy ? 'Hledám a vyhodnocuji (až 1 minuta)…' : 'Vyhledat a vyhodnotit'}</button>
                    </section>

                    {result && (
                        <Report result={result} chip={(id) => sourceChip(id, result)} actions={<button type="button" onClick={() => void save()} className={primaryBtn}><Check size={15} /> Uložit rešerši do věci</button>} />
                    )}
                </>
            )}

            {saved && saved.length > 0 && (
                <section aria-label="Uložené rešerše"><h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Uložené rešerše</h2>
                    <ul className="mt-2 space-y-3">{saved.map((s) => (
                        <li key={s.id}><details className="rounded-2xl border border-slate-200 bg-white p-4"><summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-900"><span className="min-w-0 flex-1 truncate">{s.question}</span><span className="text-xs font-normal text-slate-500">{fmtDate(s.created_at)}</span><button type="button" onClick={(e) => { e.preventDefault(); void removeSaved(s.id); }} aria-label="Smazat rešerši" className="rounded p-1 text-rose-700 hover:bg-rose-50"><Trash2 size={14} /></button></summary><div className="mt-3"><Report result={s.result} chip={(id) => sourceChip(id, s.result)} /></div></details></li>
                    ))}</ul>
                </section>
            )}
        </div>
    );
}

function Report({ result, chip, actions }: { result: Result; chip: (id: string) => React.ReactNode; actions?: React.ReactNode }) {
    const ev = result.evaluation;
    return (
        <section className="space-y-4 rounded-2xl border border-indigo-200 bg-white p-5" aria-label="Výsledek rešerše">
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-950"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> Pracovní podklad pro advokáta, ne právní stanovisko. Citace pocházejí z právní databáze, před použitím je ověřte v plném znění rozhodnutí.</p>
            {ev ? (
                <>
                    {ev.summary && <div><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Shrnutí</h3><p className="mt-1 text-sm leading-relaxed text-slate-800">{ev.summary}</p></div>}
                    {ev.fileFacts?.length > 0 && (
                        <div><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Skutková zjištění ze spisu</h3>
                            <ul className="mt-1 space-y-1 text-sm text-slate-700">{ev.fileFacts.map((f, i) => <li key={i} className="flex flex-wrap items-center gap-1.5">{f.text} {f.sources.map(chip)}</li>)}</ul>
                        </div>
                    )}
                    {ev.arguments.length > 0 && (
                        <div><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Argumenty</h3>
                            <ul className="mt-2 space-y-2">{ev.arguments.map((a, i) => (
                                <li key={i} className={`rounded-xl border p-3 text-sm ${a.stance === 'pro' ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}`}>
                                    <p className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${a.stance === 'pro' ? 'bg-emerald-200 text-emerald-950' : 'bg-rose-200 text-rose-950'}`}>{a.stance === 'pro' ? 'Pro' : 'Proti'}</span><strong className="text-slate-900">{a.claim}</strong>{a.strength && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE[a.strength] ?? 'bg-slate-100'}`}>{a.strength}</span>}</p>
                                    <p className="mt-1 text-slate-700">{a.explanation}</p>
                                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">{a.unsupported ? <span className="font-semibold text-rose-800">Bez opory ve vyhledaných zdrojích, ověřte samostatně.</span> : <>Zdroje: {a.sources.map(chip)}</>}</p>
                                </li>
                            ))}</ul>
                        </div>
                    )}
                    {ev.caselaw.length > 0 && (
                        <div><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Nejdůležitější rozhodnutí</h3>
                            <ul className="mt-2 space-y-2">{ev.caselaw.map((c, i) => { const s = result.sources.find((x) => x.id === c.source); return (
                                <li key={i} className="rounded-xl border border-slate-200 p-3 text-sm"><p className="flex flex-wrap items-center gap-2"><strong className="text-slate-900">{s?.title}</strong>{c.relevance && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE[c.relevance] ?? 'bg-slate-100'}`}>{c.relevance} relevance</span>}{chip(c.source)}</p><p className="mt-1 text-slate-700">{c.why}</p>{c.quote && <blockquote className="mt-2 flex gap-2 border-l-2 border-indigo-300 pl-3 text-xs italic text-slate-600"><Quote size={12} className="mt-0.5 shrink-0" aria-hidden="true" />{c.quote}</blockquote>}</li>
                            ); })}</ul>
                        </div>
                    )}
                    {([['Rizika a slabá místa', ev.risks], ['Co ještě doplnit', ev.openQuestions], ['Další kroky', ev.nextSteps]] as const).map(([title, list]) => list.length > 0 && <div key={title}><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">{list.map((x, i) => <li key={i}>{x}</li>)}</ul></div>)}
                </>
            ) : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{result.sources.length ? 'Vyhodnocení umělou inteligencí není k dispozici, zobrazují se jen nalezené zdroje.' : 'Nic relevantního se nenašlo. Zkuste otázku přeformulovat.'}</p>}
            {result.summaries.length > 0 && <details className="rounded-xl bg-slate-50 p-3 text-sm"><summary className="cursor-pointer font-semibold text-slate-800">Souhrn přímo z DirectCase</summary><div className="mt-2 space-y-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">{result.summaries.map((t, i) => <p key={i}>{t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')}</p>)}</div></details>}
            <div><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Zdroje ({result.sources.length})</h3>
                <ul className="mt-2 space-y-2">{result.sources.map((s) => (
                    <li key={s.id} id={`res-${s.id}`} className="scroll-mt-20 rounded-xl border border-slate-200 p-3 text-sm"><p className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-bold text-indigo-900">{s.id}</span><strong className="text-slate-900">{s.title}</strong><span className="text-xs text-slate-500">{[s.kind === 'zakon' ? 'předpis' : s.kind === 'spis' ? 'podklad ze spisu' : s.court, s.date && new Date(s.date).toLocaleDateString('cs-CZ')].filter(Boolean).join(' · ')}</span>{s.url && <a href={s.url} target="_blank" rel="noreferrer noopener" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-indigo-800 hover:underline"><ExternalLink size={12} /> Otevřít</a>}</p>{s.excerpts.map((e, i) => <p key={i} className="mt-1.5 text-xs leading-relaxed text-slate-600">„{e}“</p>)}</li>
                ))}</ul>
            </div>
            {actions && <div>{actions}</div>}
        </section>
    );
}
