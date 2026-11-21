'use client';

import { InstallBanner } from './InstallApp';
import { OfflineSync, clearOffline } from './OfflineDeadlines';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Scale, Briefcase, Building2, FileUp, Mail, Inbox, LayoutDashboard, Library, Lock, LogOut, Menu, Settings, ShieldCheck, Users, UsersRound, MessagesSquare, Landmark, Wallet, Search, ShieldAlert, X, Gavel, Eye, ListChecks, FileSpreadsheet, ChevronDown, Puzzle, Plus, BookOpen, Archive, CalendarDays, ListTodo, EyeOff, Contact, ScrollText } from 'lucide-react';
import LawyerGate, { useLawyer } from './LawyerGate';
import GlobalSearch from './GlobalSearch';
import QuickAdd from './QuickAdd';
import { unseenCount } from '@/lib/teamTasks';
import E2eeLockNotice from './E2eeLockNotice';
import DataBoxLauncher from './DataBoxLauncher';
import FeedbackButton from './FeedbackButton';
import { useAuth } from '../site/AuthContext';
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS } from '@/lib/firm';
import { LogoSvg } from '@/lib/logo';

export type LawyerSection = 'prehled' | 'veci' | 'klienti' | 'poptavky' | 'katastr' | 'insolvence' | 'rejstriky' | 'infosoud' | 'hlidac' | 'schranka' | 'knihovna' | 'vykazy' | 'faktury' | 'cenik' | 'platby' | 'export' | 'import' | 'email' | 'penize' | 'kalkulacky' | 'chat' | 'tym' | 'sablony' | 'epr' | 'stret' | 'uschovy' | 'doplnky' | 'denik' | 'anonymizer' | 'plne-moci' | 'subjekty' | 'archiv' | 'kalendar' | 'ukoly' | 'nastaveni';
type Item = readonly [LawyerSection, string, string, LucideIcon];

// Menu: nahoře to, co advokát potřebuje každý den; odborné nástroje a nastavení jsou ve sbalitelných skupinách
type Group = { title: string; items: Item[]; fold?: string };
const GROUPS: Group[] = [
    // „Dnes“ je pracovní plocha (adresa /kancelar zůstává)
    { title: '', items: [['prehled', '/kancelar', 'Dnes', LayoutDashboard]] },
    { title: 'Práce', items: [['veci', '/kancelar/veci', 'Spisy', Briefcase], ['kalendar', '/kancelar/kalendar', 'Kalendář', CalendarDays], ['ukoly', '/kancelar/ukoly', 'Úkoly', ListTodo], ['klienti', '/kancelar/klienti', 'Klienti', Users], ['email', '/kancelar/email', 'E-mail', Mail], ['poptavky', '/kancelar/poptavky', 'Poptávky', Inbox], ['denik', '/kancelar/podaci-denik', 'Podací deník', BookOpen], ['knihovna', '/kancelar/knihovna', 'Knihovna vzorů', Library]] },
    { title: 'Peníze', items: [['penize', '/kancelar/penize', 'Peníze', Wallet]] },
    { title: 'Kancelář', items: [['chat', '/kancelar/chat', 'Chat', MessagesSquare], ['tym', '/kancelar/tym', 'Tým', UsersRound]] },
    // Odborné a méně časté nástroje
    { title: 'Nástroje', fold: 'tools', items: [['hlidac', '/kancelar/hlidac', 'Hlídač', Eye], ['archiv', '/kancelar/archiv', 'Archiv spisů', Archive], ['subjekty', '/kancelar/subjekty', 'Subjekty', Contact], ['plne-moci', '/kancelar/plne-moci', 'Plné moci', ScrollText], ['anonymizer', '/kancelar/anonymizer', 'Anonymizér', EyeOff], ['stret', '/kancelar/stret-zajmu', 'Střet zájmů', Scale], ['infosoud', '/kancelar/infosoud', 'Soudní řízení', Gavel], ['epr', '/kancelar/epr', 'Platební rozkazy', FileSpreadsheet], ['katastr', '/kancelar/katastr', 'Katastr', Landmark], ['rejstriky', '/kancelar/rejstriky', 'Rejstříky', Building2], ['insolvence', '/kancelar/insolvence', 'Insolvence', ShieldAlert]] },
    { title: 'Přizpůsobit', fold: 'setup', items: [['sablony', '/kancelar/sablony', 'Šablony úkolů', ListChecks], ['import', '/kancelar/import', 'Import dat', FileUp], ['doplnky', '/kancelar/doplnky', 'Word a Outlook', Puzzle]] },
];
const FOLD_KEY = 'kancelar-menu-otevreno';
const SETTINGS: Item = ['nastaveni', '/kancelar/nastaveni', 'Nastavení', Settings];
const ALL: Item[] = [...GROUPS.flatMap((g) => g.items), SETTINGS];

function Inner({ active, children }: { active: LawyerSection; children: React.ReactNode }) {
    const { access, locked } = useLawyer();
    const { account, isStaff, logout } = useAuth();
    const [lockNote, setLockNote] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    // Zkratka Ctrl/Cmd+K nebo lomítko (mimo psaní do pole) otevře hledání
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
            if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey)) { e.preventDefault(); setSearchOpen(true); }
            else if (e.key.toLowerCase() === 'n' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && !document.querySelector('[role=dialog]')) { e.preventDefault(); setAddOpen(true); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
    // Název kanceláře, ve které jsem členem, a moje role
    const [firm, setFirm] = useState<{ name: string; role: 'owner' | 'admin' | 'member' } | null>(null);
    useEffect(() => {
        let cancelled = false;
        supabase.rpc('firm_overview').then(({ data, error }) => { const f = (data as { firm?: { name: string; role: 'owner' | 'admin' | 'member' } } | null)?.firm; if (!cancelled && !error && f) setFirm({ name: f.name, role: f.role }); });
        return () => { cancelled = true; };
    }, []);
    const [open, setOpen] = useState(false);
    // Sbalené skupiny menu: pamatuje si je prohlížeč; skupina s otevřenou stránkou je rozbalená vždy
    const [unfolded, setUnfolded] = useState<string[]>([]);
    useEffect(() => { try { const v = JSON.parse(localStorage.getItem(FOLD_KEY) ?? '[]'); if (Array.isArray(v)) { const t = window.setTimeout(() => setUnfolded(v.filter((x) => typeof x === 'string')), 0); return () => window.clearTimeout(t); } } catch { /* nic */ } }, []);
    const toggleFold = (id: string) => setUnfolded((list) => { const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]; try { localStorage.setItem(FOLD_KEY, JSON.stringify(next)); } catch { /* nic */ } return next; });
    // Počet nepřečtených zpráv v chatu kanceláře (když chat ještě není zapnutý, odznak se nezobrazí)
    const [unread, setUnread] = useState(0);
    // Nové úkoly od kolegů (ještě neotevřené)
    const [newTasks, setNewTasks] = useState(0);
    const me = account?.id;
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const [sum, nud, tasks] = await Promise.all([supabase.rpc('chat_summary'), supabase.rpc('my_nudges'), me ? unseenCount(me) : Promise.resolve(0)]);
            if (cancelled) return;
            setNewTasks(tasks);
            if (sum.error) return;
            setUnread(((sum.data ?? []) as { unread: number }[]).reduce((s, r) => s + Number(r.unread), 0) + (nud.error ? 0 : ((nud.data ?? []) as unknown[]).length));
        };
        void load();
        const id = window.setInterval(() => void load(), 30_000);
        return () => { cancelled = true; window.clearInterval(id); };
    }, [me, active]);

    // Výkazy, fakturace, ceník a kalkulačky patří pod jednu položku „Peníze“
    const navActive: LawyerSection = ['vykazy', 'faktury', 'cenik', 'platby', 'export', 'kalkulacky', 'penize'].includes(active) ? 'penize' : active;
    const current = ALL.find(([id]) => id === navActive);
    // Vždy jméno přihlášeného uživatele; teprve když chybí, e-mail
    const name = access.display_name || account?.email || 'Můj pracovní prostor';
    const subtitle = firm ? `${firm.name} · ${ROLE_LABELS[firm.role].toLowerCase()}` : access.firm_name || 'Kancelář';

    const link = ([id, href, label, Icon]: Item) => (
        <Link key={id} href={href} onClick={() => setOpen(false)} aria-current={navActive === id ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${navActive === id ? 'bg-indigo-50 text-indigo-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
            <Icon size={17} aria-hidden="true" className={navActive === id ? 'text-indigo-700' : 'text-slate-400'} />
            <span className="flex-1">{label}</span>
            {id === 'ukoly' && newTasks > 0 && <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[11px] font-bold text-white" aria-label={`${newTasks} nových úkolů`}>{newTasks}</span>}
            {id === 'chat' && unread > 0 && <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[11px] font-bold text-white" aria-label={`${unread} nepřečtených`}>{unread}</span>}
        </Link>
    );

    const sidebar = (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 px-5 py-5">
                <LogoSvg size={36} radius={9} />
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{name}</p>
                    <p className="truncate text-xs text-slate-500">{subtitle}</p>
                </div>
            </div>
            <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Části kanceláře">
                {GROUPS.map((g) => {
                    const shown = !g.fold || unfolded.includes(g.fold) || g.items.some(([id]) => id === navActive);
                    return (
                        <div key={g.title || 'main'}>
                            {g.title && (g.fold
                                ? <button type="button" onClick={() => toggleFold(g.fold!)} aria-expanded={shown} className="flex w-full items-center gap-1 px-3 pb-1.5 text-left text-xs font-bold uppercase tracking-[0.14em] text-slate-400 hover:text-slate-600 cursor-pointer">{g.title}<span className="ml-auto font-semibold normal-case tracking-normal">{shown ? '' : `${g.items.length}`}</span><ChevronDown size={13} aria-hidden="true" className={`transition ${shown ? 'rotate-180' : ''}`} /></button>
                                : <p className="px-3 pb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{g.title}</p>)}
                            {shown && <div className="space-y-0.5">{g.items.map((item) => link(item))}</div>}
                        </div>
                    );
                })}
            </nav>
            <div className="space-y-0.5 border-t border-slate-100 px-3 py-3">
                {link(SETTINGS)}
                <FeedbackButton />
                {isStaff && <Link href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"><ShieldCheck size={17} aria-hidden="true" className="text-slate-400" /> Správa</Link>}
                <button type="button" onClick={() => { clearOffline(); logout(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"><LogOut size={17} aria-hidden="true" className="text-slate-400" /> Odhlásit se</button>
                {access.status === 'trial' && access.until && <p className="mx-3 mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-950">Zkušební přístup do {new Date(`${access.until}T12:00:00`).toLocaleDateString('cs-CZ')}</p>}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 lg:flex">
            <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>

            <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
                <button type="button" onClick={() => setOpen(true)} aria-label="Otevřít nabídku" aria-expanded={open} className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-100"><Menu size={20} /></button>
                <p className="flex-1 truncate text-sm font-bold text-slate-900">{current?.[2] ?? 'Kancelář'}</p>
                {!locked && <button type="button" onClick={() => setAddOpen(true)} aria-label="Rychle zapsat" className="rounded-lg bg-indigo-600 p-1.5 text-white hover:bg-indigo-700"><Plus size={18} /></button>}
                <button type="button" onClick={() => setSearchOpen(true)} aria-label="Hledat" className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-100"><Search size={18} /></button>
                {unread > 0 && <Link href="/kancelar/chat" className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">{unread}</Link>}
            </div>
            {open && (
                <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Nabídka">
                    <button type="button" aria-label="Zavřít nabídku" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-900/50" />
                    <aside className="relative h-full w-72 max-w-[85%] bg-white shadow-2xl">
                        <button type="button" onClick={() => setOpen(false)} aria-label="Zavřít" className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
                        {sidebar}
                    </aside>
                </div>
            )}

            <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
            {!locked && <QuickAdd open={addOpen} onClose={() => setAddOpen(false)} />}
            {!locked && <DataBoxLauncher />}

            <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-8 sm:pt-8">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-6 hidden items-center justify-between gap-4 lg:flex">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{current?.[2]}</h1>
                        <div className="flex items-center gap-2">
                        {!locked && <button type="button" onClick={() => setAddOpen(true)} title="Klávesa N" className="flex items-center gap-1.5 rounded-xl bg-indigo-700 px-3.5 py-2 text-sm font-bold text-white shadow-xs hover:bg-indigo-800 cursor-pointer"><Plus size={15} aria-hidden="true" /> Zapsat</button>}
                        <button type="button" onClick={() => setSearchOpen(true)} aria-label="Hledat v celé kanceláři" className="flex w-72 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-left text-sm text-slate-500 shadow-xs hover:border-indigo-300 cursor-pointer"><Search size={15} aria-hidden="true" /><span className="flex-1">Hledat…</span><kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 text-[11px] font-semibold text-slate-500">Ctrl/⌘ K</kbd></button>
                        </div>
                    </div>
                    <E2eeLockNotice />
                    {!locked && <InstallBanner />}
                    {!locked && <OfflineSync />}
                    {locked && (
                        <div role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                            <Lock size={18} className="shrink-0" aria-hidden="true" />
                            <p className="min-w-0 flex-1 leading-relaxed"><strong>Přístup je zamčený.</strong> Předplatné skončilo nebo bylo zrušeno. Svá uložená data si můžete prohlížet a stahovat, ale všechny funkce jsou vypnuté, dokud předplatné nezaplatíte.{lockNote && <span className="mt-1 block font-semibold">Tuto akci nelze provést, dokud je přístup zamčený.</span>}</p>
                            {active !== 'nastaveni' && <Link href="/kancelar/nastaveni" className="rounded-lg bg-amber-900 px-4 py-2 text-sm font-bold text-white hover:bg-amber-950">Obnovit předplatné</Link>}
                        </div>
                    )}
                    <div
                        onSubmitCapture={locked && active !== 'nastaveni' ? (e) => { e.preventDefault(); e.stopPropagation(); setLockNote(true); } : undefined}
                        onClickCapture={locked && active !== 'nastaveni' ? (e) => { const el = (e.target as HTMLElement).closest('input[type=file], label:has(input[type=file]), button[type=submit]'); if (el && !(el.closest('[data-unlocked]'))) { e.preventDefault(); e.stopPropagation(); setLockNote(true); } } : undefined}
                    >
                    {children}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function LawyerShell({ active, children, allowExpired = false }: { active: LawyerSection; children: React.ReactNode; allowExpired?: boolean }) {
    return <LawyerGate allowExpired={allowExpired}><Inner active={active}>{children}</Inner></LawyerGate>;
}
