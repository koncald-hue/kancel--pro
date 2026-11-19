'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarClock, FileText, Newspaper, RefreshCw, ScrollText } from 'lucide-react';
import { ago, daysFromToday, lawType, parseLawTitle, type NewsItem, type NewsKind } from '@/lib/news';
import { safeUrl } from '@/lib/safeUrl';

type Tab = 'zmeny' | 'predpisy' | 'svet';
const MONTHS = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
const KIND_BAR: Record<NewsKind, string> = { predpis: 'bg-sky-500', zneni: 'bg-amber-500', ucinne: 'bg-emerald-500', svet: 'bg-indigo-500' };
const KIND_TONE: Record<NewsKind, string> = { predpis: 'bg-sky-50 text-sky-800', zneni: 'bg-amber-50 text-amber-900', ucinne: 'bg-emerald-50 text-emerald-900', svet: 'bg-indigo-50 text-indigo-800' };
const plural = (n: number) => (n === 1 ? 'den' : n < 5 ? 'dny' : 'dní');

// Dlaždice s datem účinnosti
function DateTile({ iso, hot }: { iso: string; hot: boolean }) {
    const d = new Date(`${iso}T12:00:00`);
    return <span className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${hot ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700'}`}><span className="text-xl font-bold">{d.getDate()}</span><span className="mt-1 text-[11px] font-semibold uppercase tracking-wide opacity-80">{MONTHS[d.getMonth()]}</span></span>;
}

function Law({ it }: { it: NewsItem }) {
    const law = parseLawTitle(it.title);
    const type = lawType(law.name);
    const eff = it.effective; const left = eff ? daysFromToday(eff) : null;
    return (
        <li>
            <a href={safeUrl(it.url)} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-4 rounded-xl p-3 transition hover:bg-slate-50">
                {eff ? <DateTile iso={eff} hot={left !== null && left >= 0 && left <= 14} /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><ScrollText size={22} aria-hidden="true" /></span>}
                <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                        {type && <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${KIND_TONE[it.kind]}`}>{type}</span>}
                        {law.number && <span className="font-mono text-xs font-semibold text-slate-500">{law.number}</span>}
                        {left !== null && <span className={`text-xs font-semibold ${left >= 0 && left <= 14 ? 'text-amber-700' : 'text-slate-500'}`}>{left > 0 ? `účinné za ${left} ${plural(left)}` : left === 0 ? 'účinné dnes' : 'už účinné'}</span>}
                    </span>
                    <span className="mt-1.5 block text-base font-semibold leading-snug text-slate-900 group-hover:text-indigo-800">{law.name || it.title}</span>
                    {law.amendedBy && <span className="mt-1 block text-xs text-slate-500">Změněno předpisem {law.amendedBy}</span>}
                </span>
                <ArrowUpRight size={16} className="mt-1 shrink-0 text-slate-300 transition group-hover:text-indigo-600" aria-label="otevře se na webu zdroje" />
            </a>
        </li>
    );
}

function Article({ it, big }: { it: NewsItem; big?: boolean }) {
    return (
        <a href={safeUrl(it.url)} target="_blank" rel="noopener noreferrer" className={`group relative block overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-indigo-300 hover:shadow-md ${big ? 'p-6' : 'p-4'}`}>
            <span className={`absolute inset-y-0 left-0 w-1 ${KIND_BAR[it.kind]}`} aria-hidden="true" />
            <span className="flex flex-wrap items-center gap-2 text-xs"><span className={`rounded-full px-2 py-0.5 font-bold ${KIND_TONE[it.kind]}`}>{it.source}</span><span className="text-slate-400">{ago(it.date)}</span></span>
            <span className={`mt-2 block font-bold leading-snug text-slate-900 group-hover:text-indigo-800 ${big ? 'text-xl' : 'text-[15px]'}`}>{it.title}</span>
            {it.summary && <span className={`mt-2 block leading-relaxed text-slate-600 ${big ? 'text-sm' : 'line-clamp-2 text-xs'}`}>{it.summary}</span>}
            {big && <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-700">Číst na webu zdroje <ArrowUpRight size={14} aria-hidden="true" /></span>}
        </a>
    );
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
    const all = items ?? [];
    const pick = (t: Tab) => all.filter((i) => (t === 'zmeny' ? i.kind === 'zneni' || i.kind === 'ucinne' : t === 'predpisy' ? i.kind === 'predpis' : i.kind === 'svet'));
    // Změny: nejdřív to, co začne platit nejdřív; potom nedávno účinné
    const soon = (i: NewsItem) => (i.effective ? daysFromToday(i.effective) : -999);
    const sorted = (t: Tab) => [...pick(t)].sort((a, b) => (t === 'zmeny' ? (soon(a) >= 0 && soon(b) >= 0 ? soon(a) - soon(b) : soon(a) >= 0 ? -1 : soon(b) >= 0 ? 1 : soon(b) - soon(a)) : b.date.localeCompare(a.date)));
    const list = sorted(tab);
    const TABS: [Tab, string, typeof FileText][] = [['zmeny', 'Změny zákonů', CalendarClock], ['predpisy', 'Nové předpisy', ScrollText], ['svet', 'Právní svět', Newspaper]];
    const shown = more ? list : list.slice(0, tab === 'svet' ? 4 : 6);

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Právní novinky">
            <div className="bg-gradient-to-r from-indigo-50 via-white to-amber-50/60 px-5 pb-4 pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Newspaper size={18} className="text-indigo-700" aria-hidden="true" /> Právní novinky</h2>
                        <p className="mt-0.5 text-sm text-slate-600">Co se mění v zákonech a co je nového ve světě práva.</p>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">Automaticky z veřejných zdrojů{updated ? `, ${new Date(updated).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}` : ''}<button type="button" onClick={() => void load()} aria-label="Obnovit" className="rounded p-1 hover:bg-slate-100 cursor-pointer"><RefreshCw size={11} /></button></span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Druh novinek">
                    {TABS.map(([id, label, Icon]) => (
                        <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setMore(false); }} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition cursor-pointer ${tab === id ? 'border-indigo-700 bg-indigo-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                            <Icon size={14} aria-hidden="true" /> {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-3 pb-4 pt-3 sm:px-5">
                {items === null ? <p className="p-3 text-sm text-slate-500">Novinky se teď nepodařilo načíst. Zkuste to za chvíli.</p> : shown.length === 0 ? <p className="p-3 text-sm text-slate-500">Zatím nic nového.</p> : tab === 'svet' ? (
                    <div className="grid items-start gap-3 lg:grid-cols-[1.3fr_1fr]">
                        <Article it={shown[0]} big />
                        <div className="space-y-3">{shown.slice(1).map((it) => <Article key={it.id} it={it} />)}</div>
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100">{shown.map((it) => <Law key={it.id} it={it} />)}</ul>
                )}
                {list.length > shown.length || more ? <div className="mt-2 text-center"><button type="button" onClick={() => setMore((m) => !m)} className="rounded-full px-4 py-1.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-50 cursor-pointer">{more ? 'Zobrazit méně' : 'Zobrazit další'}</button></div> : null}
                <p className="mt-3 px-1 text-xs leading-relaxed text-slate-400">Zdroje: Sbírka zákonů (zakonyprolidi.cz), epravo.cz, Advokátní deník. Přehled je jen upozornění a odkaz na zdroj, nikoli právní informace. Znění předpisů si před použitím ověřte ve Sbírce zákonů.</p>
            </div>
        </section>
    );
}
