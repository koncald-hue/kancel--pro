'use client';

import Link from 'next/link';
import { Briefcase, Clock3, Inbox, LayoutDashboard, Library, Settings, Users, UsersRound, Landmark, Scale } from 'lucide-react';
import LawyerGate, { useLawyer } from './LawyerGate';
import { useAuth } from '../site/AuthContext';

const SECTIONS = [
    ['prehled', '/kancelar', 'Přehled', LayoutDashboard],
    ['poptavky', '/kancelar/poptavky', 'Poptávky', Inbox],
    ['veci', '/kancelar/veci', 'Věci', Briefcase],
    ['klienti', '/kancelar/klienti', 'Klienti', Users],
    ['vykazy', '/kancelar/vykazy', 'Výkazy práce', Clock3],
    ['katastr', '/kancelar/katastr', 'Katastr', Landmark],
    ['knihovna', '/kancelar/knihovna', 'Knihovna', Library],
    ['tym', '/kancelar/tym', 'Tým', UsersRound],
    ['nastaveni', '/kancelar/nastaveni', 'Nastavení', Settings],
] as const;

export type LawyerSection = (typeof SECTIONS)[number][0];

function Inner({ active, children }: { active: LawyerSection; children: React.ReactNode }) {
    const { access } = useLawyer();
    const { isStaff, logout } = useAuth();
    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-slate-900 p-2.5 text-indigo-300"><Scale size={20} aria-hidden="true" /></span>
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-800">Kancelář</p>
                        <p className="text-lg font-bold text-slate-900">{access.firm_name || 'Můj pracovní prostor'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                    {isStaff && <Link href="/admin" className="font-semibold text-indigo-800 underline">Správa</Link>}
                    <button type="button" onClick={logout} className="text-slate-500 underline hover:text-slate-800">Odhlásit se</button>
                </div>
                {access.status === 'trial' && access.until && <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-950">Zkušební přístup do {new Date(`${access.until}T12:00:00`).toLocaleDateString('cs-CZ')}</span>}
            </div>
            <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Části kanceláře">
                {SECTIONS.map(([id, href, label, Icon]) => (
                    <Link key={id} href={href} aria-current={active === id ? 'page' : undefined} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold ${active === id ? 'border-indigo-800 text-indigo-900' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
                        <Icon size={16} aria-hidden="true" /> {label}
                    </Link>
                ))}
            </nav>
            <div className="mt-6">{children}</div>
        </div>
    );
}

export default function LawyerShell({ active, children, allowExpired = false }: { active: LawyerSection; children: React.ReactNode; allowExpired?: boolean }) {
    return <LawyerGate allowExpired={allowExpired}><Inner active={active}>{children}</Inner></LawyerGate>;
}
