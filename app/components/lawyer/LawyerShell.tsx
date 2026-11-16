'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Briefcase, Clock3, Inbox, LayoutDashboard, Library, LogOut, Menu, Settings, ShieldCheck, Users, UsersRound, MessagesSquare, Landmark, Receipt, Tags, Scale, X } from 'lucide-react';
import LawyerGate, { useLawyer } from './LawyerGate';
import { useAuth } from '../site/AuthContext';
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS } from '@/lib/firm';

export type LawyerSection = 'prehled' | 'veci' | 'klienti' | 'poptavky' | 'katastr' | 'knihovna' | 'vykazy' | 'faktury' | 'cenik' | 'chat' | 'tym' | 'nastaveni';
type Item = readonly [LawyerSection, string, string, LucideIcon];

// Nástroje jsou seskupené podle toho, k čemu slouží
const GROUPS: { title: string; items: Item[] }[] = [
    { title: '', items: [['prehled', '/kancelar', 'Přehled', LayoutDashboard]] },
    { title: 'Práce', items: [['veci', '/kancelar/veci', 'Věci', Briefcase], ['klienti', '/kancelar/klienti', 'Klienti', Users], ['poptavky', '/kancelar/poptavky', 'Poptávky', Inbox], ['katastr', '/kancelar/katastr', 'Katastr', Landmark], ['knihovna', '/kancelar/knihovna', 'Knihovna', Library]] },
    { title: 'Peníze', items: [['vykazy', '/kancelar/vykazy', 'Výkazy práce', Clock3], ['faktury', '/kancelar/faktury', 'Fakturace', Receipt], ['cenik', '/kancelar/cenik', 'Ceník', Tags]] },
    { title: 'Kancelář', items: [['chat', '/kancelar/chat', 'Chat', MessagesSquare], ['tym', '/kancelar/tym', 'Tým', UsersRound]] },
];
const SETTINGS: Item = ['nastaveni', '/kancelar/nastaveni', 'Nastavení', Settings];
const ALL: Item[] = [...GROUPS.flatMap((g) => g.items), SETTINGS];

function Inner({ active, children }: { active: LawyerSection; children: React.ReactNode }) {
    const { access } = useLawyer();
    const { account, isStaff, logout } = useAuth();
    // Název kanceláře, ve které jsem členem, a moje role
    const [firm, setFirm] = useState<{ name: string; role: 'owner' | 'admin' | 'member' } | null>(null);
    useEffect(() => {
        let cancelled = false;
        supabase.rpc('firm_overview').then(({ data, error }) => { const f = (data as { firm?: { name: string; role: 'owner' | 'admin' | 'member' } } | null)?.firm; if (!cancelled && !error && f) setFirm({ name: f.name, role: f.role }); });
        return () => { cancelled = true; };
    }, []);
    const [open, setOpen] = useState(false);
    // Počet nepřečtených zpráv v chatu kanceláře (když chat ještě není zapnutý, odznak se nezobrazí)
    const [unread, setUnread] = useState(0);
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const [sum, nud] = await Promise.all([supabase.rpc('chat_summary'), supabase.rpc('my_nudges')]);
            if (cancelled || sum.error) return;
            setUnread(((sum.data ?? []) as { unread: number }[]).reduce((s, r) => s + Number(r.unread), 0) + (nud.error ? 0 : ((nud.data ?? []) as unknown[]).length));
        };
        void load();
        const id = window.setInterval(() => void load(), 30_000);
        return () => { cancelled = true; window.clearInterval(id); };
    }, []);

    const current = ALL.find(([id]) => id === active);
    // Vždy jméno přihlášeného uživatele; teprve když chybí, e-mail
    const name = access.display_name || account?.email || 'Můj pracovní prostor';
    const subtitle = firm ? `${firm.name} · ${ROLE_LABELS[firm.role].toLowerCase()}` : access.firm_name || 'Kancelář';

    const link = ([id, href, label, Icon]: Item) => (
        <Link key={id} href={href} onClick={() => setOpen(false)} aria-current={active === id ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${active === id ? 'bg-indigo-50 text-indigo-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
            <Icon size={17} aria-hidden="true" className={active === id ? 'text-indigo-700' : 'text-slate-400'} />
            <span className="flex-1">{label}</span>
            {id === 'chat' && unread > 0 && <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white" aria-label={`${unread} nepřečtených`}>{unread}</span>}
        </Link>
    );

    const sidebar = (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 px-5 py-5">
                <span className="rounded-xl bg-indigo-600 p-2 text-white"><Scale size={18} aria-hidden="true" /></span>
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{name}</p>
                    <p className="truncate text-xs text-slate-500">{subtitle}</p>
                </div>
            </div>
            <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Části kanceláře">
                {GROUPS.map((g) => (
                    <div key={g.title || 'main'}>
                        {g.title && <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{g.title}</p>}
                        <div className="space-y-0.5">{g.items.map((item) => link(item))}</div>
                    </div>
                ))}
            </nav>
            <div className="space-y-0.5 border-t border-slate-100 px-3 py-3">
                {link(SETTINGS)}
                {isStaff && <Link href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"><ShieldCheck size={17} aria-hidden="true" className="text-slate-400" /> Správa</Link>}
                <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"><LogOut size={17} aria-hidden="true" className="text-slate-400" /> Odhlásit se</button>
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
                {unread > 0 && <Link href="/kancelar/chat" className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">{unread}</Link>}
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

            <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
                <div className="mx-auto max-w-6xl">
                    <h1 className="mb-6 hidden text-2xl font-bold tracking-tight text-slate-900 lg:block">{current?.[2]}</h1>
                    {children}
                </div>
            </main>
        </div>
    );
}

export default function LawyerShell({ active, children, allowExpired = false }: { active: LawyerSection; children: React.ReactNode; allowExpired?: boolean }) {
    return <LawyerGate allowExpired={allowExpired}><Inner active={active}>{children}</Inner></LawyerGate>;
}
