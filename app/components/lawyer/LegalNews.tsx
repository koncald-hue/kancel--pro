'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Newspaper, RefreshCw } from 'lucide-react';
import { KIND_LABEL, daysFromToday, type NewsItem, type NewsKind } from '@/lib/news';

type Tab = 'zmeny' | 'predpisy' | 'svet';
const TABS: [Tab, string][] = [['zmeny', 'Změny zákonů'], ['predpisy', 'Nové předpisy'], ['svet', 'Právní svět']];
const KIND_TONE: Record<NewsKind, string> = { predpis: 'bg-sky-100 text-sky-800', zneni: 'bg-amber-100 text-amber-900', ucinne: 'bg-emerald-100 text-emerald-900', svet: 'bg-slate-100 text-slate-700' };
const fmt = (iso: string) => new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
const short = (t: string) => t.replace(/^\d{1,2}\.\d{1,2}\.\d{4}\s*-\s*/, '');

function When({ it }: { it: NewsItem }) {
    if (!it.effective) return <span className="text-xs text-slate-400">{fmt(it.date)}</span>;
    const d = daysFromToday(it.effective);
    const text = d > 0 ? `účinné za ${d} ${d === 1 ? 'den' : d < 5 ? 'dny' : 'dní'}` : d === 0 ? 'účinné dnes' : `účinné od ${fmt(it.effective)}`;
    return <span className={`text-xs font-semibold ${d > 0 && d <= 14 ? 'text-amber-800' : 'text-slate-500'}`}>{text}</span>;
}

// Právní novinky sestavené počítačem z veřejných zdrojů: změny zákonů, nové předpisy a zprávy ze světa práva
export default function LegalNews() {
    const [items, setItems] = useState<NewsItem[] | null | undefined>(undefined);
    const [updated, setUpdated] = useState('');
    const [tab, setTab] = useState<Tab>('zmeny');
    const [more, setMore] = useState(false);
    const load = () => fetch('/api/news').then((r) => (r.ok ? r.json() : Promise.reject())).then((d: { items: NewsItem[]; updatedAt: string }) => { setItems(d.items); setUpdated(d.updatedAt); }).catch(() => setItems((cur) => cur ?? null));
    useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, []);

    if (items === undefined) return null;
    const pick = (t: Tab) => (items ?? []).filter((i) => (t === 'zmeny' ? i.kind === 'zneni' || i.kind === 'ucinne' : t === 'predpisy' ? i.kind === 'predpis' : i.kind === 'svet'));
    const list = pick(tab).sort((a, b) => (tab === 'zmeny' ? (b.effective ?? b.date.slice(0, 10)).localeCompare(a.effective ?? a.date.slice(0, 10)) : b.date.localeCompare(a.date)));
    const shown = more ? list : list.slice(0, 6);
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Právní novinky">
            <div className="flex flex-wrap items-center gap-3">
                <h2 className="flex flex-1 items-center gap-2 text-lg font-bold text-slate-900"><Newspaper size={18} className="text-indigo-800" aria-hidden="true" /> Právní novinky</h2>
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="tablist" aria-label="Druh novinek">
                    {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setMore(false); }} className={`rounded-lg px-3 py-1 text-xs font-semibold cursor-pointer ${tab === id ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>{label}</button>)}
                </div>
            </div>
            {items === null ? <p className="mt-3 text-sm text-slate-500">Novinky se teď nepodařilo načíst. Zkuste to za chvíli.</p> : (
                <>
                    <ul className="mt-3 divide-y divide-slate-100">
                        {shown.map((it) => (
                            <li key={it.id} className="py-3">
                                <a href={it.url} target="_blank" rel="noopener noreferrer" className="group block">
                                    <span className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${KIND_TONE[it.kind]}`}>{KIND_LABEL[it.kind]}</span><When it={it} /><span className="text-xs text-slate-400">· {it.source}</span></span>
                                    <span className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-slate-900 group-hover:text-indigo-800 group-hover:underline">{short(it.title)}<ExternalLink size={12} className="mt-1 shrink-0 text-slate-300" aria-label="otevře se na webu zdroje" /></span>
                                    {it.summary && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{it.summary}</span>}
                                </a>
                            </li>
                        ))}
                        {shown.length === 0 && <li className="py-4 text-sm text-slate-500">Zatím nic nového.</li>}
                    </ul>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                        {list.length > 6 ? <button type="button" onClick={() => setMore((m) => !m)} className="font-semibold text-indigo-800 hover:underline cursor-pointer">{more ? 'Zobrazit méně' : `Zobrazit dalších ${list.length - 6}`}</button> : <span />}
                        <span className="flex items-center gap-1.5">Sestaveno automaticky z veřejných zdrojů (Sbírka zákonů, epravo.cz, Advokátní deník){updated ? `, ${new Date(updated).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}` : ''}<button type="button" onClick={() => void load()} aria-label="Obnovit" className="rounded p-1 hover:bg-slate-100 cursor-pointer"><RefreshCw size={11} /></button></span>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-400">Přehled je jen upozornění a odkaz na zdroj, nikoli právní informace. Znění předpisů si před použitím ověřte ve Sbírce zákonů.</p>
                </>
            )}
        </section>
    );
}
