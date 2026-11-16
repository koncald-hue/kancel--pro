'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpenCheck, BadgeCheck, BookUser, CalendarClock, CalendarPlus, Check, Clock, FileSignature, FileText, FolderOpen, LayoutDashboard, Pin, PinOff, ShieldCheck, Share2, Landmark, Link2, MailCheck, Trash2, Users, Wallet } from 'lucide-react';
import { useAuth } from '../site/AuthContext';
import { supabase } from '@/lib/supabase';
import { hasLawyerAccess, useLawyerAccess } from '@/lib/lawyer';
import { buildIcs, collectDeadlines, describeCaseError, downloadTextFile, loadBundle, removeCaseStorage, type CaseBundle } from '@/lib/caseFile';
import { daysUntil, deleteCase, loadCase, updateCase, type LegalCase } from '@/lib/cases';
import CaseOverviewTab from './CaseOverviewTab';
import CaseKatastrTab from './CaseKatastrTab';
import CaseDataMessagesTab from './CaseDataMessagesTab';
import CaseResearchTab from './CaseResearchTab';
import CaseFinanceTab from './CaseFinanceTab';
import CaseSignTab from './CaseSignTab';
import CaseIdentityTab from './CaseIdentityTab';
import ClientInsolvencyBanner from './ClientInsolvencyBanner';
import CaseFilesTab from './CaseFilesTab';
import CaseDeadlinesTab, { deadlineText, deadlineTone } from './CaseDeadlinesTab';
import CaseTimelineTab from './CaseTimelineTab';
import CaseContactsTab from './CaseContactsTab';
import CaseDefenseTab from './CaseDefenseTab';
import CaseExportPanel from './CaseExportPanel';
import CaseClientTab from './CaseClientTab';
import CaseSharePanel from './CaseSharePanel';
import { loadShare, ROLE_LABEL, type ShareRole, type ShareRow } from '@/lib/caseShare';
import { ghostBtn, type TabProps } from './caseUi';

type TabId = 'prehled' | 'katastr' | 'obrana' | 'klient' | 'soubory' | 'lhuty' | 'chronologie' | 'kontakty' | 'datovky' | 'resers' | 'finance' | 'podpisy' | 'identifikace';

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
    const [lastTab, setLastTab] = useState<Record<string, TabId>>({});
    const [error, setError] = useState('');
    const [missing, setMissing] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [shareRows, setShareRows] = useState<ShareRow[]>([]);
    const [unread, setUnread] = useState(0);

    const accountId = account?.id;
    useEffect(() => {
        if (!accountId || !caseId || !isLawyer) return;
        let cancelled = false;
        loadShare(caseId).then((r) => { if (!cancelled) setShareRows(r); }).catch(() => undefined);
        return () => { cancelled = true; };
    }, [accountId, caseId, isLawyer, shareOpen]);
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

    type TabDef = { id: TabId; label: string; icon: typeof FileText; count?: number };
    const T: Record<TabId, TabDef> = {
        prehled: { id: 'prehled', label: 'Přehled', icon: LayoutDashboard },
        klient: { id: 'klient', label: 'Klientská stránka', icon: Link2, count: unread },
        podpisy: { id: 'podpisy', label: 'Podpisy', icon: FileSignature },
        identifikace: { id: 'identifikace', label: 'Identifikace (AML)', icon: BadgeCheck },
        soubory: { id: 'soubory', label: 'Soubory', icon: FolderOpen, count: bundle.files.length },
        datovky: { id: 'datovky', label: 'Datové zprávy', icon: MailCheck },
        lhuty: { id: 'lhuty', label: 'Lhůty', icon: CalendarClock, count: open.length },
        chronologie: { id: 'chronologie', label: 'Chronologie', icon: Clock, count: bundle.entries.length },
        kontakty: { id: 'kontakty', label: 'Kontakty', icon: BookUser, count: bundle.contacts.length },
        resers: { id: 'resers', label: 'Rešerše', icon: BookOpenCheck },
        obrana: { id: 'obrana', label: 'Obrana', icon: ShieldCheck },
        katastr: { id: 'katastr', label: 'Katastr', icon: Landmark },
        finance: { id: 'finance', label: 'Peníze', icon: Wallet },
    };
    // Advokát vidí šest hlavních záložek a v nich podzáložky; občan zůstává u krátkého plochého seznamu
    type Group = { id: string; label: string; icon: typeof FileText; items: TabDef[]; count?: number };
    // Kolega u sdílené věci vidí soubory, lhůty, chronologii a kontakty; klientská stránka, podpisy, peníze a rešerše patří vlastníkovi
    const isOwner = !item.user_id || item.user_id === account.id;
    const myRole = shareRows.find((r) => r.user_id === account.id)?.role;
    const shared: Group[] = [
        { id: 'prehled', label: 'Přehled', icon: LayoutDashboard, items: [T.prehled] },
        { id: 'dokumenty', label: 'Dokumenty', icon: FolderOpen, items: [T.soubory], count: bundle.files.length },
        { id: 'prubeh', label: 'Průběh', icon: CalendarClock, items: [T.lhuty, T.chronologie, T.kontakty], count: open.length },
    ];
    const groups: Group[] = isLawyer && !isOwner ? shared : isLawyer ? [
        { id: 'prehled', label: 'Přehled', icon: LayoutDashboard, items: [T.prehled] },
        { id: 'klient', label: 'Klient', icon: Link2, items: [T.klient, T.podpisy, T.identifikace], count: unread },
        { id: 'dokumenty', label: 'Dokumenty', icon: FolderOpen, items: [T.soubory, T.datovky], count: bundle.files.length },
        { id: 'prubeh', label: 'Průběh', icon: CalendarClock, items: [T.lhuty, T.chronologie, T.kontakty], count: open.length },
        { id: 'prace', label: 'Právní práce', icon: BookOpenCheck, items: [T.resers, T.obrana, T.katastr] },
        { id: 'penize', label: 'Peníze', icon: Wallet, items: [T.finance] },
    ] : [T.prehled, T.obrana, T.soubory, T.lhuty, T.chronologie, T.kontakty].map((t) => ({ id: t.id, label: t.label, icon: t.icon, items: [t], count: t.count }));
    const activeGroup = groups.find((g) => g.items.some((i) => i.id === tab)) ?? groups[0];
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
                        {isLawyer && <button type="button" onClick={() => setShareOpen((v) => !v)} aria-expanded={shareOpen} className={ghostBtn}><Users size={15} /> Sdílení{shareRows.filter((r) => !r.is_owner).length ? ` (${shareRows.filter((r) => !r.is_owner).length})` : ''}</button>}
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

            {isLawyer && !isOwner && <p className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950">Tuto věc vám sdílí {shareRows.find((r) => r.is_owner)?.name || 'kolega'}. Vaše role: <strong>{ROLE_LABEL[(myRole ?? 'viewer') as ShareRole]}</strong>.</p>}
            {shareOpen && isLawyer && <CaseSharePanel item={item} userId={account.id} onClose={() => setShareOpen(false)} onLeft={() => router.push(listPath)} fail={fail} />}
            {exportOpen && <CaseExportPanel item={item} bundle={bundle} deadlines={deadlines} lawyer={isLawyer} onClose={() => setExportOpen(false)} fail={fail} />}

            {error && <p role="alert" className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}<button type="button" onClick={() => setError('')} className="font-semibold underline cursor-pointer">Zavřít</button></p>}

            {isLawyer && item.client_id && <ClientInsolvencyBanner clientId={item.client_id} />}
            <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Části spisu">
                {groups.map((g) => (
                    <button key={g.id} type="button" role="tab" aria-selected={activeGroup.id === g.id} onClick={() => setTab(lastTab[g.id] && g.items.some((i) => i.id === lastTab[g.id]) ? lastTab[g.id] : g.items[0].id)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold cursor-pointer ${activeGroup.id === g.id ? 'border-indigo-800 text-indigo-900' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
                        <g.icon size={16} /> {g.label}{g.count ? <span className="rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600">{g.count}</span> : null}
                    </button>
                ))}
            </nav>
            {activeGroup.items.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label={activeGroup.label}>
                    {activeGroup.items.map(({ id, label, icon: Icon, count }) => (
                        <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setLastTab((l) => ({ ...l, [activeGroup.id]: id })); }} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold cursor-pointer ${tab === id ? 'border-indigo-800 bg-indigo-800 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
                            <Icon size={14} aria-hidden="true" /> {label}{count ? <span className={`rounded-full px-1.5 text-[11px] ${tab === id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{count}</span> : null}
                        </button>
                    ))}
                </div>
            )}

            <div className="mt-5" role="tabpanel">
                {tab === 'prehled' && <CaseOverviewTab {...tabProps} />}
                {tab === 'katastr' && <CaseKatastrTab {...tabProps} />}
                {tab === 'datovky' && <CaseDataMessagesTab {...tabProps} />}
                {tab === 'resers' && <CaseResearchTab {...tabProps} />}
                {tab === 'finance' && <CaseFinanceTab {...tabProps} />}
                {tab === 'podpisy' && <CaseSignTab {...tabProps} />}
                {tab === 'identifikace' && <CaseIdentityTab {...tabProps} />}
                {tab === 'obrana' && <CaseDefenseTab {...tabProps} />}
                {tab === 'soubory' && <CaseFilesTab {...tabProps} />}
                {tab === 'lhuty' && <CaseDeadlinesTab {...tabProps} />}
                {tab === 'chronologie' && <CaseTimelineTab {...tabProps} />}
                {tab === 'klient' && <CaseClientTab {...tabProps} verified={isStaff || lawyer.access?.verification_status === 'verified'} access={lawyer.access} refreshAccess={() => setLawyerVersion((v) => v + 1)} />}
                {tab === 'kontakty' && <CaseContactsTab {...tabProps} />}
            </div>

            <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
                <button type="button" onClick={() => patchItem({ status: item.status === 'done' ? 'open' : 'done' })} className={ghostBtn}><Check size={15} /> {item.status === 'done' ? 'Znovu otevřít případ' : 'Označit jako vyřešený'}</button>
                {isOwner && <button type="button" onClick={() => void remove()} className="inline-flex items-center gap-1.5 text-sm text-rose-700 hover:underline cursor-pointer"><Trash2 size={14} /> Smazat celý spis</button>}
            </footer>
        </div>
    );
}
