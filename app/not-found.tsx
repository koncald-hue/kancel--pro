import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/app/components/lawyer/LandingChrome';

export default function NotFound() {
    return (
        <>
            <SiteHeader />
            <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
                <p className="text-sm font-semibold text-indigo-700">Chyba 404</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Tuhle stránku jsme nenašli</h1>
                <p className="mt-3 text-slate-600">Odkaz je možná starý nebo se v něm stala překlepem chyba. Vraťte se na úvod, nebo se podívejte na ceník.</p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Link href="/" className="rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800">Na úvodní stránku</Link>
                    <Link href="/cenik" className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">Ceník</Link>
                </div>
            </main>
            <SiteFooter />
        </>
    );
}
