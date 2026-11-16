'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpenCheck, BookUser, CalendarClock, CalendarPlus, Check, Clock, FileText, FolderOpen, LayoutDashboard, Pin, PinOff, ShieldCheck, Share2, Landmark, Link2, MailCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../site/AuthContext';
import { supabase } from '@/lib/supabase';
import { hasLawyerAccess, useLawyerAccess } from '@/lib/lawyer';
import { buildIcs, collectDeadlines, describeCaseError, downloadTextFile, loadBundle, removeCaseStorage, type CaseBundle } from '@/lib/caseFile';
import { daysUntil, deleteCase, loadCase, updateCase, type LegalCase } from '@/lib/cases';
import CaseOverviewTab from './CaseOverviewTab';
import CaseKatastrTab from './CaseKatastrTab';
import CaseDataMessagesTab from './CaseDataMessagesTab';
import CaseResearchTab from './CaseResearchTab';
import CaseFilesTab from './CaseFilesTab';
import CaseDeadlinesTab, { deadlineText, deadlineTone } from './CaseDeadlinesTab';
import CaseTimelineTab from './CaseTimelineTab';
import CaseContactsTab from './CaseContactsTab';
import CaseDefenseTab from './CaseDefenseTab';
import CaseExportPanel from './CaseExportPanel';
import CaseClientTab from './CaseClientTab';
import { ghostBtn, type TabProps } from './caseUi';

type TabId = 'prehled' | 'katastr' | 'obrana' | 'klient' | 'soubory' | 'lhuty' | 'chronologie' | 'kontakty' | 'datovky' | 'resers';

export default function CaseDetail({ variant = 'citizen' }: { variant?: 'citizen' | 'office' }) {
    const isOffice = variant === 'office';
    // Z pracovního prostoru se vracíme do Věcí, z občanského profilu do Moje případy
    const listPath = isOffice ? '/kancelar/veci' : '/moje-pripady';
    const router = useRouter();
    const pathname = usePathname();
    const caseId = pathname.split('/').filter(Boolean).pop() ?? '';
    const { account, authReady, openLogin, isStaff } = useAuth();
    // Záložka Klient patří do kanceláře: vidí ji jen advokáti s přístupem (a tým)
    const [lawyerVersion, setLawyerVersion] = useState(0);
    const lawyer = useLawyerAccess(account?.id, lawyerVersion);
    const isLawyer = isStaff || hasLawyerAccess(lawyer.access);
    const [item, setItem] = useState<LegalCase | null>(null);
    const [bundle, setBundleState] = useState<CaseBundle | null>(null);
    const [tab, setTab] = useState<TabId>('prehled');
    const [error, setError] = useState('');
    const [missing, setMissing] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [unread, setUnread] = useState(0);

    const accountId = account?.id;
    useEffect(() => {
        if (!accountId || !caseId) return;
        let cancelled = false;
        Promise.all([loadCase(caseId), loadBundle(caseId)])
            .then(([found, data]) => { if (cancelled) return; if (!found) setMissing(true); else { setItem(found); setBundleState(data); } })
            .catch((err) => { if (!cancelled) setError(describeCaseError(err)); });
        return () => { cancelled = true; };
    }, [accountId, caseId]);

    // Počet nepřečtených zpráv od klienta; když tabulka chybí (nespuštěné SQL), badge se prostě nezobrazí
    useEffect(() => {
        if (!accountId || !caseId) return;
        let cancelled = false;
        supabase.from('client_messages').select('id', { count: 'exact', head: true }).eq('case_id', caseId).eq('from_client', true).eq('read', false)
            .then(({ count }) => { if (!cancelled) setUnread(count ?? 0); });
        return () => { cancelled = true; };
    }, [accountId, caseId]);

    if (!authReady) return <p className="max-w-4xl mx-auto px-4 py-12 text-sm text-slate-500" role="status">Načítám…</p>;
    if (!account) {
        return (
            <div className="max-w-xl mx-auto px-4 py-16 text-center">
                <h1 className="text-3xl font-bold text-slate-900">Spis případu</h1>
                <p className="mt-3 text-sm text-slate-600">Pro otevření spisu se přihlaste.</p>
                <button type="button" onClick={() => openLogin('login')} className="mt-6 rounded-xl bg-indigo-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-900 cursor-pointer">Přihlásit se</button>
            </div>
        );
    }
    if (missing) return <div className="max-w-xl mx-auto px-4 py-16 text-center text-sm text-slate-600">Tento případ jsme nenašli. <Link href="/moje-pripady" className="font-semibold text-indigo-900 underline">Zpět na moje případy</Link></div>;
    if (!item || !bundle) return <div className="max-w-4xl mx-auto px-4 py-12">{error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p> : <p className="text-sm text-slate-500" role="status">Načítám spis…</p>}</div>;

    const fail = (err: unknown) => setError(describeCaseError(err));
    const patchItem = (change: Partial<LegalCase>) => {
        setItem((current) => (current ? { ...current, ...change } : current));
        updateCase(item.id, change).catch(fail);
    };
    const setBundle: TabProps['setBundle'] = (update) => setBundleState((b) => (b ? update(b) : b));

    const deadlines = collectDeadlines(item, bundle.deadlines);
    const open = deadlines.filter((d) => !d.done && daysUntil(d.date) >= 0);
    const next = open[0];

    const exportIcs = () => {
        if (!open.length) { setError('Nejsou žádné nadcházející lhůty k exportu.'); return; }
        downloadTextFile('lhuty-spis.ics', buildIcs(item.title, open.map((d) => ({ uid: `${item.id}-${d.key}`, title: d.title, iso: d.iso }))), 'text/calendar');
    };

    const remove = async () => {
        if (!window.confirm(`Opravdu smazat celý spis „${item.title}“ včetně souborů? Nelze vrátit zpět.`)) return;
        try {
            await removeCaseStorage(bundle.files);
            await deleteCase(item.id);
            router.push(listPath);
        } catch (err) { fail(err); }
    };

    const tabs: { id: TabId; label: string; icon: typeof FileText; count?: number }[] = [
        { id: 'prehled', label: 'Přehled', icon: LayoutDashboard },
        ...(isLawyer ? [{ id: 'klient' as TabId, label: 'Klient', icon: Link2, count: unread }] : []),
        ...(isLawyer ? [{ id: 'katastr' as TabId, label: 'Katastr', icon: Landmark }] : []),
        ...(isLawyer ? [{ id: 'datovky' as TabId, label: 'Datové zprávy', icon: MailCheck }] : []),
        ...(isLawyer ? [{ id: 'resers' as TabId, label: 'Rešerše', icon: BookOpenCheck }] : []),
        { id: 'obrana', label: 'Obrana', icon: ShieldCheck },
        { id: 'soubory', label: 'Soubory', icon: FolderOpen, count: bundle.files.length },
        { id: 'lhuty', label: 'Lhůty', icon: CalendarClock, count: open.length },
        { id: 'chronologie', label: 'Chronologie', icon: Clock, count: bundle.entries.length },
        { id: 'kontakty', label: 'Kontakty', icon: BookUser, count: bundle.contacts.length },
    ];
    const tabProps: TabProps = { item, bundle, userId: account.id, lawyer: isLawyer, patchItem, setBundle, fail };

    return (
        <div className={isOffice ? '' : 'max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12'}>
            <Link href={listPath} className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-800 hover:underline"><ArrowLeft size={15} /> {isOffice ? 'Věci' : 'Moje případy'}</Link>

            <header className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-800">Spis případu{item.status === 'done' && ' · vyřešeno'}</p>
                        <input
                            key={item.id}
                            defaultValue={item.title}
                            onBlur={(e) => { const value = e.target.value.trim(); if (value && value !== item.title) patchItem({ title: value.slice(0, 100) }); else e.target.value = item.title; }}
                            maxLength={100}
                            aria-label="Název případu"
                            className="mt-1 w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-2xl font-bold text-slate-900 hover:border-slate-200 focus:border-indigo-600 focus:outline-none"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => patchItem({ pinned: !item.pinned })} aria-pressed={item.pinned} className={ghostBtn}>{item.pinned ? <PinOff size={15} /> : <Pin size={15} />} {item.pinned ? 'Odepnout' : 'Připnout'}</button>
                        <button type="button" onClick={exportIcs} className={ghostBtn}><CalendarPlus size={15} /> Kalendář</button>
                        <button type="button" onClick={() => setExportOpen((v) => !v)} aria-expanded={exportOpen} className={ghostBtn}><Share2 size={15} /> {isLawyer ? 'Předat spis' : 'Souhrn k tisku'}</button>
                    </div>
                </div>
                {next && (
                    <p className={`mt-3 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold ${deadlineTone(daysUntil(next.date), false)}`}>
                        Nejbližší lhůta: {next.title} · {deadlineText(daysUntil(next.date))}
                    </p>
                )}
            </header>

            {exportOpen && <CaseExportPanel item={item} bundle={bundle} deadlines={deadlines} lawyer={isLawyer} onClose={() => setExportOpen(false)} fail={fail} />}

            {error && <p role="alert" className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}<button type="button" onClick={() => setError('')} className="font-semibold underline cursor-pointer">Zavřít</button></p>}

            <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Části spisu">
                {tabs.map(({ id, label, icon: Icon, count }) => (
                    <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold cursor-pointer ${tab === id ? 'border-indigo-800 text-indigo-900' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
                        <Icon size={16} /> {label}{count ? <span className="rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600">{count}</span> : null}
                    </button>
                ))}
            </nav>

            <div className="mt-5" role="tabpanel">
                {tab === 'prehled' && <CaseOverviewTab {...tabProps} />}
                {tab === 'katastr' && <CaseKatastrTab {...tabProps} />}
                {tab === 'datovky' && <CaseDataMessagesTab {...tabProps} />}
                {tab === 'resers' && <CaseResearchTab {...tabProps} />}
                {tab === 'obrana' && <CaseDefenseTab {...tabProps} />}
                {tab === 'soubory' && <CaseFilesTab {...tabProps} />}
                {tab === 'lhuty' && <CaseDeadlinesTab {...tabProps} />}
                {tab === 'chronologie' && <CaseTimelineTab {...tabProps} />}
                {tab === 'klient' && <CaseClientTab {...tabProps} verified={isStaff || lawyer.access?.verification_status === 'verified'} access={lawyer.access} refreshAccess={() => setLawyerVersion((v) => v + 1)} />}
                {tab === 'kontakty' && <CaseContactsTab {...tabProps} />}
            </div>

            <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
                <button type="button" onClick={() => patchItem({ status: item.status === 'done' ? 'open' : 'done' })} className={ghostBtn}><Check size={15} /> {item.status === 'done' ? 'Znovu otevřít případ' : 'Označit jako vyřešený'}</button>
                <button type="button" onClick={() => void remove()} className="inline-flex items-center gap-1.5 text-sm text-rose-700 hover:underline cursor-pointer"><Trash2 size={14} /> Smazat celý spis</button>
            </footer>
        </div>
    );
}
