'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, BookOpen, Calculator, ClipboardList, LayoutGrid, Users } from 'lucide-react';
import { useAuth } from '../site/AuthContext';

const NAV = [
    ['/admin', 'Přehled', LayoutGrid],
    ['/admin/advokati', 'Uživatelé a předplatné', Users],
    ['/admin/ucetnictvi', 'Účetnictví', Calculator],
    ['/admin/statistiky', 'Statistiky', BarChart3],
    ['/admin/zaznam', 'Záznam a poznámky', ClipboardList],
    ['/admin/judikatura', 'Judikatura', BookOpen],
] as const;

// Rám správy provozovatele: jen pro tým (is_staff), jednotná navigace mezi částmi
export default function AdminShell({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
    const { isStaff, authReady } = useAuth();
    const path = usePathname();
    if (!authReady) return <p className="mx-auto max-w-3xl px-4 py-12 text-sm text-slate-500" role="status">Načítám…</p>;
    if (!isStaff) return <p className="mx-auto max-w-3xl px-4 py-12 text-sm text-slate-600">Tato stránka je jen pro tým provozovatele.</p>;
    return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <nav aria-label="Správa" className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
                {NAV.map(([href, label, Icon]) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${path === href ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}><Icon size={15} aria-hidden="true" />{label}</Link>)}
                <Link href="/kancelar" className="ml-auto flex shrink-0 items-center rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:text-slate-900">← Kancelář</Link>
            </nav>
            {title && <h1 className="text-2xl font-bold text-slate-900">{title}</h1>}
            {intro && <p className="mt-1 max-w-3xl text-sm text-slate-600">{intro}</p>}
            <div className={title ? 'mt-5' : ''}>{children}</div>
        </div>
    );
}
