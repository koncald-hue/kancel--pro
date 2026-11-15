import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Správa | Kancelář', robots: { index: false } };

export default function Page() {
    return (
        <div className="mx-auto max-w-3xl px-4 py-12">
            <h1 className="text-2xl font-bold text-slate-900">Správa</h1>
            <p className="mt-2 text-sm text-slate-600">Jen pro provozovatele služby: ověřování advokátů, platby, statistiky a judikatura.</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                <li><Link href="/admin/advokati" className="block rounded-2xl border border-slate-200 bg-white p-5 font-semibold text-slate-900 hover:border-indigo-400">Advokáti, ověření a platby</Link></li>
                <li><Link href="/admin/statistiky" className="block rounded-2xl border border-slate-200 bg-white p-5 font-semibold text-slate-900 hover:border-indigo-400">Statistiky</Link></li>
                <li><Link href="/admin/judikatura" className="block rounded-2xl border border-slate-200 bg-white p-5 font-semibold text-slate-900 hover:border-indigo-400">Knihovna judikatury</Link></li>
            </ul>
        </div>
    );
}
