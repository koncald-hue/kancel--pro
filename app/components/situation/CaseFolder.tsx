'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ConflictPanel from '../lawyer/ConflictPanel';
import { partiesFromTitle } from '@/lib/conflicts';
import { useRouter } from 'next/navigation';
import { CalendarClock, CalendarPlus, FolderPlus, LayoutList, Pin, Rows3, Search, Sparkles } from 'lucide-react';
import { useAuth } from '../site/AuthContext';
import { buildIcs, collectDeadlines, describeCaseError, downloadTextFile, loadAllDeadlines, type CaseDeadline } from '@/lib/caseFile';
import { BLANK_CASE, createCase, daysUntil, loadCases, type LegalCase } from '@/lib/cases';
import { deadlineText, deadlineTone } from './CaseDeadlinesTab';
import { inputCls, primaryBtn } from './caseUi';
import SavedViews from './SavedViews';
import { CASE_TYPES } from '@/lib/caseMeta';
import { createDemoCase } from '@/lib/demoCase';
import { DEFAULT_FILTER, matchesFilter, type CaseFilter } from '@/lib/savedViews';
import { limitsFor, useLawyerTier } from '@/lib/tiers';
import UpgradeNote from './UpgradeNote';
import { addStarterTemplates, applyTemplate, defaultTemplate, loadTemplates } from '@/lib/templateApply';
import type { CaseTemplate } from '@/lib/taskTemplates';

// Přehled všech případů (spisů) přihlášeného uživatele
export default function CaseFolder({ variant = 'citizen' }: { variant?: 'citizen' | 'office' }) {
    const isOffice = variant === 'office';
    const casePath = (id: string) => (isOffice ? `/kancelar/veci/${id}` : `/moje-pripady/${id}`);
    const router = useRouter();
    const { account, authReady, openLogin, isStaff } = useAuth();
    // Advokátský režim odemyká tabulku, hromadný export lhůt a neomezené spisy
    const lawyerTier = useLawyerTier(account?.id, isStaff);
    const lawyer = isOffice || lawyerTier;
    const limits = limitsFor(lawyer);
    const [cases, setCases] = useState<LegalCase[] | null>(null);
    const [customs, setCustoms] = useState<CaseDeadline[]>([]);
    const [error, setError] = useState('');
    const [title, setTitle] = useState('');
    const [fx, setFx] = useState<CaseFilter>(DEFAULT_FILTER);
    const query = fx.q, filter = fx.status;
    const setQuery = (q: string) => setFx((f) => ({ ...f, q }));
    const setFilter = (status: 'open' | 'done') => setFx((f) => ({ ...f, status }));
    const [creating, setCreating] = useState(false);
    const [demoBusy, setDemoBusy] = useState(false);
    const [templates, setTemplates] = useState<CaseTemplate[]>([]);
    const [tplId, setTplId] = useState('');
    useEffect(() => { if (isOffice) loadTemplates().then((l) => { setTemplates(l); setTplId(defaultTemplate(l)?.id ?? ''); }).catch(() => undefined); }, [isOffice]);
    // Přehled pro advokáty: tabulka s klientem, značkou a úřadem místo karet
    const [officeSaved, setOffice] = useState(() => { try { return localStorage.getItem('casesOfficeView') === '1'; } catch { return false; } });
    const office = isOffice || (lawyer && officeSaved);
    const setView = (on: boolean) => { setOffice(on); try { localStorage.setItem('casesOfficeView', on ? '1' : '0'); } catch { /* pohled se jen nezapamatuje */ } };

    const accountId = account?.id;
    useEffect(() => {
        if (!accountId) return;
        let cancelled = false;
        loadCases()
            .then(async (data) => {
                if (cancelled) return;
                setCases(data);
                // Vlastní lhůty se načítají zvlášť; když chybí tabulky, přehled funguje i bez nich
                try { const all = await loadAllDeadlines(); if (!cancelled) setCustoms(all); } catch { /* spis ještě nemusí být zapnutý */ }
            })
            .catch((err) => { if (!cancelled) setError(describeCaseError(err)); });
        return () => { cancelled = true; };
    }, [accountId]);

    async function create() {
        if (!account || !title.trim()) return;
        setCreating(true);
        try {
            const created = await createCase(account.id, { ...BLANK_CASE, title: title.trim().slice(0, 100) });
            const tpl = templates.find((t) => t.id === tplId);
            if (tpl) await applyTemplate(tpl, created.id, account.id, null).catch(() => undefined);
            router.push(casePath(created.id));
        } catch (err) { setError(describeCaseError(err)); setCreating(false); }
    }

    function exportAllIcs() {
        const items = enrichedAll.flatMap(({ c }) => collectDeadlines(c, customs.filter((d) => d.case_id === c.id)).filter((d) => !d.done && daysUntil(d.date) >= 0).map((d) => ({ uid: `${c.id}-${d.key}`, title: `${c.title}: ${d.title}`, iso: d.iso })));
        if (!items.length) { setError('Nejsou žádné nadcházející lhůty k exportu.'); return; }
        downloadTextFile('lhuty-vsechny-pripady.ics', buildIcs('Všechny případy', items), 'text/calendar');
    }

    if (!authReady) return <p className="max-w-3xl mx-auto px-4 py-12 text-sm text-slate-500" role="status">Načítám…</p>;

    if (!account) {
        return (
            <div className="max-w-xl mx-auto px-4 py-16 text-center">
                <h1 className="text-3xl font-bold text-slate-900">Moje případy</h1>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">Po přihlášení si můžete vést kompletní spis: soubory ve složkách, chronologii, poznámky, kontakty a hlídání lhůt s odpočtem.</p>
                <button type="button" onClick={() => openLogin('login')} className="mt-6 rounded-xl bg-indigo-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-900 cursor-pointer">Přihlásit se</button>
            </div>
        );
    }

    const enrichedAll = (cases ?? []).filter((c) => c.status === 'open').map((c) => ({ c }));
    const enriched = (cases ?? []).map((c) => {
        const next = collectDeadlines(c, customs.filter((d) => d.case_id === c.id)).filter((d) => !d.done && daysUntil(d.date) >= 0)[0] ?? null;
        return { c, next };
    });
    const clientNames = [...new Set((cases ?? []).map((c) => c.client_name ?? '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs'));
    const shown = enriched
        .filter(({ c, next }) => matchesFilter(c, next ? daysUntil(next.date) : null, { ...fx, q: fx.q.trim() }))
        .sort((a, b) => Number(b.c.pinned) - Number(a.c.pinned) || (a.next ? a.next.date.getTime() : Infinity) - (b.next ? b.next.date.getTime() : Infinity));
    const upcoming = enriched.filter(({ c, next }) => c.status === 'open' && next).map(({ c, next }) => ({ c, d: next! })).sort((a, b) => a.d.date.getTime() - b.d.date.getTime()).slice(0, 4);

    return (
        <div className={isOffice ? '' : 'max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14'}>
            {isOffice ? (
                <h2 className="text-2xl font-bold text-slate-900">Spisy</h2>
            ) : (
                <>
                    <h1 className="text-3xl font-bold text-slate-900">Moje případy</h1>
                    <p className="mt-1 text-sm text-slate-600">Kompletní spis ke každému spisu: soubory, lhůty, chronologie a kontakty. Vidíte ho jen vy.</p>
                </>
            )}

            {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}

            <form onSubmit={(e) => { e.preventDefault(); void create(); }} className="mt-6 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isOffice ? 'Název nového spisu (např. Novák proti Dvořákovi)' : 'Název nového spisu (např. Pokuta za rychlost, Spor s e-shopem)'} maxLength={100} className={inputCls} aria-label="Název nového spisu" />
                {isOffice && templates.length > 0 && <select value={tplId} onChange={(e) => setTplId(e.target.value)} aria-label="Šablona úkolů" className={`${inputCls} sm:max-w-56`}><option value="">Bez šablony úkolů</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
                <button type="submit" disabled={!title.trim() || creating || (cases?.length ?? 0) >= limits.cases} className={`${primaryBtn} justify-center whitespace-nowrap`}><FolderPlus size={16} /> {isOffice ? 'Založit spis' : 'Založit spis'}</button>
            </form>
            {isOffice && (() => { const sides = partiesFromTitle(title); return sides.length === 2 ? <div className="mt-2 space-y-2"><ConflictPanel parties={[{ name: sides[1] }]} role="protistrana" compact /><ConflictPanel parties={[{ name: sides[0] }]} role="klient" compact /></div> : null; })()}
            {isOffice && account && (
                <p className="mt-2 text-xs text-slate-500">Chcete si Kancelář prohlédnout na hotovém příkladu? <button type="button" disabled={demoBusy} onClick={() => { setDemoBusy(true); createDemoCase(account.id, 1500).then((id) => router.push(casePath(id))).catch((e) => { setError(describeCaseError(e)); setDemoBusy(false); }); }} className="cursor-pointer font-semibold text-indigo-800 underline disabled:opacity-60">{demoBusy ? 'Zakládám…' : 'Založit ukázkový spis'}</button></p>
            )}
            {isOffice && templates.length === 0 && <p className="mt-2 text-xs text-slate-500">Tip: <button type="button" onClick={() => account && void addStarterTemplates(account.id).then((l) => { setTemplates(l); setTplId(defaultTemplate(l)?.id ?? ''); }).catch(() => undefined)} className="cursor-pointer font-semibold text-indigo-900 underline">Přidat vzorové šablony úkolů</button> a nový spis dostane úkoly s termíny sama (plná moc, podklady od klienta, příprava jednání). <Link href="/kancelar/sablony" className="underline">Upravit šablony</Link></p>}
            {isOffice && templates.length > 0 && tplId && <p className="mt-2 text-xs text-slate-500">K nové spisy se automaticky přidají úkoly ze šablony „{templates.find((t) => t.id === tplId)?.name}“. Jinou nebo žádnou vyberete v seznamu u názvu.</p>}
            {!isOffice && <p className="mt-2 text-xs text-slate-500">Nevíte, jak začít? <Link href="/situace" className="font-semibold text-indigo-900 underline">Popište situaci a spis se předvyplní</Link> kroky, lhůtami i vzory dokumentů.</p>}

            {!lawyer && (cases?.length ?? 0) >= limits.cases && <div className="mt-3"><UpgradeNote>Bezplatný účet má {limits.cases} případy. Smažte vyřešený případ, nebo využijte neomezené spisy v</UpgradeNote></div>}

            {upcoming.length > 0 && (
                <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4" aria-label="Nejbližší lhůty">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarClock size={16} className="text-indigo-800" /> Nejbližší lhůty</p>
                        {lawyer && <button type="button" onClick={exportAllIcs} className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-900 underline cursor-pointer"><CalendarPlus size={13} /> Všechny lhůty do kalendáře (.ics)</button>}
                    </div>
                    <ul className="mt-2 space-y-1.5">
                        {upcoming.map(({ c, d }) => (
                            <li key={`${c.id}-${d.key}`} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                                <Link href={casePath(c.id)} className="text-slate-800 hover:underline"><span className="font-semibold">{c.title}</span> · {d.title}</Link>
                                <span className={`text-xs font-bold ${deadlineTone(daysUntil(d.date), false)}`}>{deadlineText(daysUntil(d.date))}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-2">
                {([['open', 'Otevřené'], ['done', 'Vyřešené']] as const).map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full border px-3.5 py-1 text-xs font-semibold cursor-pointer ${filter === value ? 'border-indigo-700 bg-indigo-100 text-indigo-950' : 'border-slate-200 bg-white text-slate-700'}`}>{label} ({enriched.filter((x) => x.c.status === value).length})</button>
                ))}
                {!isOffice && lawyer && <div className="ml-auto flex gap-1.5" role="group" aria-label="Zobrazení">
                    <button type="button" onClick={() => setView(false)} aria-pressed={!office} title="Karty" className={`rounded-lg border p-1.5 cursor-pointer ${!office ? 'border-indigo-700 bg-indigo-100 text-indigo-950' : 'border-slate-200 bg-white text-slate-600'}`}><Rows3 size={16} /></button>
                    <button type="button" onClick={() => setView(true)} aria-pressed={office} title="Přehled pro advokáty (tabulka)" className={`rounded-lg border p-1.5 cursor-pointer ${office ? 'border-indigo-700 bg-indigo-100 text-indigo-950' : 'border-slate-200 bg-white text-slate-600'}`}><LayoutList size={16} /></button>
                </div>}
                {(cases?.length ?? 0) > 3 && (
                    <div className={`relative min-w-48 flex-1 sm:max-w-64 ${isOffice ? 'ml-auto' : ''}`}>
                        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hledat případ…" className={`${inputCls} pl-9`} aria-label="Hledat případ" />
                    </div>
                )}
            </div>

            {isOffice && account && (
                <>
                    <div className="mt-3 grid grid-cols-2 items-center gap-2 text-xs sm:flex sm:flex-wrap">
                        <select value={fx.client} onChange={(e) => setFx((f) => ({ ...f, client: e.target.value }))} aria-label="Klient" className={`${inputCls} py-1 text-xs sm:!w-auto`}><option value="">Všichni klienti</option>{clientNames.map((n) => <option key={n} value={n}>{n}</option>)}</select>
                        <select value={fx.within} onChange={(e) => setFx((f) => ({ ...f, within: Number(e.target.value) as CaseFilter['within'] }))} aria-label="Nejbližší lhůta" className={`${inputCls} py-1 text-xs sm:!w-auto`}><option value={0}>Lhůta kdykoli</option><option value={7}>Lhůta do 7 dní</option><option value={30}>Lhůta do 30 dní</option></select>
                        <select value={fx.type} onChange={(e) => setFx((f) => ({ ...f, type: e.target.value }))} aria-label="Druh případu" className={`${inputCls} py-1 text-xs sm:!w-auto`}><option value="">Všechny druhy</option>{CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                        <select value={fx.kind} onChange={(e) => setFx((f) => ({ ...f, kind: e.target.value as CaseFilter['kind'] }))} aria-label="Druh" className={`${inputCls} py-1 text-xs sm:!w-auto`}><option value="all">Spisy i podspisy</option><option value="main">Jen hlavní spisu</option><option value="sub">Jen podspisy</option></select>
                    </div>
                    <SavedViews userId={account.id} filter={fx} onApply={setFx} />
                </>
            )}

            {cases === null && !error && <p className="mt-6 text-sm text-slate-500" role="status">Načítám případy…</p>}
            {cases && shown.length === 0 && (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
                    {cases.length === 0 ? 'Zatím tu nic nemáte. Založte první spis výše.' : 'Nic nenalezeno.'}
                </div>
            )}

            {office ? (
                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr><th className="px-4 py-2.5">Spis</th><th className="px-3 py-2.5">Klient</th><th className="px-3 py-2.5">Sp. zn.</th><th className="px-3 py-2.5">Úřad / soud</th><th className="px-3 py-2.5">Lhůta</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {shown.map(({ c, next }) => (
                                <tr key={c.id} className="hover:bg-indigo-50/50">
                                    <td className="px-4 py-2.5 font-semibold text-slate-900"><Link href={casePath(c.id)} className="hover:text-indigo-800 hover:underline">{c.pinned && <Pin size={12} className="mr-1 inline text-indigo-700" />}{c.title}{c.user_id && c.user_id !== accountId && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold uppercase text-indigo-900">Sdíleno s vámi</span>}</Link>{c.parent_id && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 align-middle text-[11px] font-bold uppercase text-slate-700">Podspis</span>}{(c.case_type || (c.labels ?? []).length > 0) && <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] font-semibold text-slate-500">{c.case_type}{(c.labels ?? []).map((l) => <span key={l} className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-950">{l}</span>)}</span>}</td>
                                    <td className="px-3 py-2.5 text-slate-700">{c.client_name || '–'}</td>
                                    <td className="px-3 py-2.5 text-slate-700">{c.reference || '–'}</td>
                                    <td className="px-3 py-2.5 text-slate-700">{c.authority || '–'}</td>
                                    <td className={`px-3 py-2.5 text-xs font-bold ${next ? deadlineTone(daysUntil(next.date), false) : 'text-slate-400'}`}>{next ? `${next.date.toLocaleDateString('cs-CZ')} · ${deadlineText(daysUntil(next.date))}` : '–'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
            <ul className="mt-4 space-y-3">
                {shown.map(({ c, next }) => {
                    const done = c.steps.filter((s) => s.done).length;
                    const percent = c.steps.length ? Math.round((done / c.steps.length) * 100) : 0;
                    return (
                        <li key={c.id}>
                            <Link href={casePath(c.id)} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-400 sm:p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">{c.pinned && <Pin size={14} className="text-indigo-700" aria-label="Připnuto" />}{c.title}{c.parent_id && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-700">Podspis</span>}{c.user_id && c.user_id !== accountId && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold uppercase text-indigo-900">Sdíleno s vámi</span>}</h2>
                                    {next && <span className={`shrink-0 text-xs font-bold ${deadlineTone(daysUntil(next.date), false)}`}>{deadlineText(daysUntil(next.date))}</span>}
                                </div>
                                {(c.client_name || c.reference || c.authority || c.case_type || c.responsible) && <p className="mt-1 text-xs font-semibold text-slate-500">{[c.client_name, c.reference, c.authority, c.case_type, c.responsible ? `vede ${c.responsible}` : ''].filter(Boolean).join(' · ')}</p>}
                                {(c.labels ?? []).length > 0 && <ul className="mt-1.5 flex flex-wrap gap-1">{(c.labels ?? []).map((l) => <li key={l} className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-950">{l}</li>)}</ul>}
                                {c.summary && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{c.summary}</p>}
                                {c.steps.length > 0 && (
                                    <div className="mt-3 flex items-center gap-3">
                                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${percent}%` }} /></div>
                                        <span className="text-xs text-slate-500">{done}/{c.steps.length} kroků</span>
                                    </div>
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
            )}
            {cases && cases.length > 0 && <p className="mt-6 flex items-center gap-2 text-xs text-slate-500"><Sparkles size={13} className="text-indigo-700" /> Tip: do spisu si můžete nahrát soubory a fotky, vést chronologii a exportovat lhůty do kalendáře.</p>}
        </div>
    );
}
