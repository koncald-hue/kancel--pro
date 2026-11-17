'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, ListPlus, Loader2, Scale, ShieldCheck, Copy, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ghostBtn, primaryBtn, type TabProps } from './caseUi';
import { safeUrl } from '@/lib/safeUrl';

type Defense = {
    classification: string;
    must_prove: string[];
    angles: { title: string; explanation: string; check: string }[];
    procedural_checks: string[];
    evidence: string[];
    plan: { step: string; when: string; detail: string }[];
    risks: string[];
    questions: string[];
    judikatura: { id: string; why: string }[];
    search_terms: string[];
    when_lawyer: string;
};

type Law = { id: string; court: string; ref: string; ecli: string; decided_on: string | null; title: string; holding: string; url: string };

const DATABASES = [
    ['Ústavní soud (NALUS)', 'https://nalus.usoud.cz'],
    ['Nejvyšší soud', 'https://www.nsoud.cz'],
    ['Nejvyšší správní soud', 'https://www.nssoud.cz'],
] as const;

function Block({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <div className="mt-2">{children}</div>
        </section>
    );
}

const Bullets = ({ items }: { items: string[] }) => <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">{items.map((i) => <li key={i}>{i}</li>)}</ul>;

// Strategie obrany: podklad podle údajů ve spisu a ověřená judikatura z knihovny týmu
export default function CaseDefenseTab({ item, bundle, lawyer, patchItem, fail }: TabProps) {
    // Bez popisu a chronologie by AI jen hádala, proto se k přípravě nejdřív vyzve k doplnění údajů
    const hasFacts = !!(item.situation?.trim() || item.summary?.trim() || bundle.entries.length > 0);
    const [defense, setDefense] = useState<Defense | null>(null);
    const [savedAt, setSavedAt] = useState<string | null>(null);
    const [laws, setLaws] = useState<Law[]>([]);
    const [loading, setLoading] = useState(false);
    const [ready, setReady] = useState(false);
    const [enabled, setEnabled] = useState(true);
    const [added, setAdded] = useState(false);
    const [copied, setCopied] = useState('');

    async function loadLaws(ids: string[]) {
        if (!ids.length) { setLaws([]); return; }
        const { data } = await supabase.from('case_law').select('id, court, ref, ecli, decided_on, title, holding, url').in('id', ids).eq('verified', true);
        setLaws((data ?? []) as Law[]);
    }

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data, error } = await supabase.from('cases').select('defense, defense_at').eq('id', item.id).maybeSingle();
            if (cancelled) return;
            if (error) { setEnabled(false); setReady(true); return; }
            const saved = (data?.defense as Defense | null) ?? null;
            setDefense(saved);
            setSavedAt((data?.defense_at as string | null) ?? null);
            if (saved) await loadLaws(saved.judikatura.map((j) => j.id));
            if (!cancelled) setReady(true);
        })().catch(() => { if (!cancelled) { setEnabled(false); setReady(true); } });
        return () => { cancelled = true; };
    }, [item.id]);

    async function generate() {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Přihlášení vypršelo. Přihlaste se prosím znovu.');
            const res = await fetch('/api/defense', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ caseId: item.id }) });
            if (res.status === 429) throw new Error('Dnes jste už strategii připravovali několikrát. Bezplatný účet má 2 přípravy denně, advokáti 12. Zkuste to prosím zítra.');
            if (!res.ok) throw new Error('Strategii se teď nepodařilo připravit. Zkuste to prosím později.');
            const out = await res.json() as { defense: Defense; savedAt: string };
            setDefense(out.defense);
            setSavedAt(out.savedAt);
            setAdded(false);
            await loadLaws(out.defense.judikatura.map((j) => j.id));
        } catch (err) { fail(err); } finally { setLoading(false); }
    }

    const copy = (term: string) => { void navigator.clipboard?.writeText(term); setCopied(term); window.setTimeout(() => setCopied(''), 1500); };

    function addPlanToSteps() {
        if (!defense) return;
        const have = new Set(item.steps.map((s) => s.text));
        const fresh = defense.plan.map((p) => `${p.step}${p.when ? ` (${p.when})` : ''}`).filter((t) => !have.has(t)).map((text) => ({ text, done: false }));
        if (fresh.length) patchItem({ steps: [...item.steps, ...fresh] });
        setAdded(true);
    }

    if (!ready) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (!enabled) return <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">Obrana ještě není v databázi zapnutá (chybí spuštění SQL defense.sql).</p>;

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 sm:p-6">
                <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-indigo-100 p-2.5 text-indigo-900"><ShieldCheck size={22} aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold text-slate-900">Strategie obrany</h2>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">Podle popisu, chronologie a lhůt ve spisu připravíme: co musí prokázat druhá strana, kde hledat slabiny, jak postupovat krok za krokem a jaká judikatura se hodí.</p>
                        {!lawyer && <p className="mt-2 text-xs text-slate-500">Bezplatný účet: 2 přípravy denně.</p>}
                        <p className="mt-2 text-xs text-slate-500">K přípravě se odešle popis případu a chronologie, nikoli nahrané soubory. Čím úplnější spis, tím užitečnější výsledek.</p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                            <button type="button" onClick={() => void generate()} disabled={loading || !hasFacts} className={primaryBtn}>{loading ? <><Loader2 size={16} className="animate-spin" /> Připravuji (asi 20 s)…</> : defense ? 'Připravit znovu' : 'Připravit strategii obrany'}</button>
                            {!hasFacts && <span className="text-xs font-semibold text-indigo-900">Nejdřív doplňte popis věci nebo aspoň jednu událost v Chronologii.</span>}
                            {savedAt && <span className="text-xs text-slate-500">Naposledy {new Date(savedAt).toLocaleString('cs-CZ')}</span>}
                        </div>
                    </div>
                </div>
            </div>

            {defense && (
                <>
                    {defense.classification && <p className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{defense.classification}</p>}

                    {defense.plan.length > 0 && (
                        <Block title="Postup krok za krokem">
                            <ol className="space-y-3">
                                {defense.plan.map((p, i) => (
                                    <li key={`${p.step}-${i}`} className="flex gap-3">
                                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-900">{i + 1}</span>
                                        <div className="text-sm leading-relaxed text-slate-700"><p className="font-semibold text-slate-900">{p.step}{p.when && <span className="ml-2 font-normal text-indigo-800">· {p.when}</span>}</p><p>{p.detail}</p></div>
                                    </li>
                                ))}
                            </ol>
                            <button type="button" onClick={addPlanToSteps} disabled={added} className={`${ghostBtn} mt-4`}>{added ? <><Check size={15} /> Přidáno do kroků spisu</> : <><ListPlus size={15} /> Přidat do kroků ve spisu</>}</button>
                        </Block>
                    )}

                    {defense.must_prove.length > 0 && <Block title="Co musí prokázat druhá strana nebo úřad"><Bullets items={defense.must_prove} /></Block>}

                    {defense.angles.length > 0 && (
                        <Block title="Možné argumenty obrany">
                            <ul className="space-y-3">
                                {defense.angles.map((a) => (
                                    <li key={a.title} className="rounded-xl border border-slate-200 p-3.5">
                                        <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                                        <p className="mt-1 text-sm leading-relaxed text-slate-700">{a.explanation}</p>
                                        {a.check && <p className="mt-1.5 text-xs text-indigo-900"><strong>Ověřte:</strong> {a.check}</p>}
                                    </li>
                                ))}
                            </ul>
                        </Block>
                    )}

                    {defense.procedural_checks.length > 0 && <Block title="Formální body ke kontrole"><Bullets items={defense.procedural_checks} /></Block>}
                    {defense.evidence.length > 0 && <Block title="Jaké doklady a důkazy shromáždit"><Bullets items={defense.evidence} /></Block>}
                    {defense.risks.length > 0 && <Block title="Slabá místa a rizika"><Bullets items={defense.risks} /></Block>}
                    {defense.questions.length > 0 && <Block title="Co by pomohlo doplnit do spisu"><Bullets items={defense.questions} /></Block>}

                    <Block title="Judikatura">
                        {laws.length > 0 ? (
                            <ul className="space-y-3">
                                {laws.map((l) => (
                                    <li key={l.id} className="rounded-xl border border-slate-200 p-3.5">
                                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900"><Scale size={15} className="text-indigo-800" />{l.court}, {l.ref}{l.decided_on && <span className="font-normal text-slate-500">({new Date(l.decided_on).toLocaleDateString('cs-CZ')})</span>}</p>
                                        <p className="mt-1 text-sm text-slate-700">{l.holding}</p>
                                        <p className="mt-1 text-xs text-indigo-900">{defense.judikatura.find((j) => j.id === l.id)?.why}</p>
                                        {safeUrl(l.url) && <a href={safeUrl(l.url)} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-900 underline">Rozhodnutí v databázi soudu <ExternalLink size={12} /></a>}
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-sm text-slate-600">V ověřené knihovně zatím není rozhodnutí, které by k tomuto případu sedělo. Nic nevymýšlíme: citujeme jen judikaturu, kterou náš tým ověřil.</p>}
                        <div className="mt-4 border-t border-slate-100 pt-4">
                            <p className="text-sm font-semibold text-slate-900">Hledejte sami v oficiálních databázích</p>
                            {defense.search_terms.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {defense.search_terms.map((t) => <button key={t} type="button" onClick={() => copy(t)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:border-indigo-400 cursor-pointer">{copied === t ? <Check size={12} /> : <Copy size={12} />} {t}</button>)}
                                </div>
                            )}
                            <div className="mt-2 flex flex-wrap gap-3 text-sm">{DATABASES.map(([name, url]) => <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-indigo-900 underline">{name} <ExternalLink size={12} /></a>)}</div>
                            <p className="mt-2 text-xs text-slate-500">Klikněte na frázi pro zkopírování a vložte ji do vyhledávání soudu. Rozhodnutí vždy zkontrolujte přímo v databázi.</p>
                        </div>
                    </Block>

                    {defense.when_lawyer && <p className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-relaxed text-rose-950"><AlertTriangle size={17} className="mt-0.5 shrink-0" /> {defense.when_lawyer}</p>}
                    <p className="text-xs leading-relaxed text-slate-500">Jde o automaticky vytvořený orientační podklad, nikoli právní radu ani záruku úspěchu. Zkontrolujte ho s dokumenty ve spisu a u vážných věcí (trestní řízení, soud, vyšší částky) se poraďte s advokátem nebo bezplatnou právní poradnou.</p>
                </>
            )}
        </div>
    );
}
