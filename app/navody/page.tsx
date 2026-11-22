import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock3 } from 'lucide-react';
import { FinalCta, SiteFooter, SiteHeader } from '@/app/components/lawyer/LandingChrome';
import { GUIDES, type Guide } from '@/lib/seo/guides';
import { breadcrumbLd, JsonLd } from '@/lib/seo/jsonLd';

export const metadata: Metadata = {
    title: 'Návody pro advokáty: lhůty, tarif, úschovy, AML | Kancelář Pro',
    description: 'Praktické návody pro advokáty a koncipienty: počítání lhůt, datové schránky, advokátní tarif, úschovy, AML, střet zájmů, GDPR a vedení kanceláře.',
    alternates: { canonical: '/navody' },
};

const CATEGORIES: Guide['category'][] = ['Lhůty a doručování', 'Odměna a fakturace', 'Stavovské povinnosti', 'Ochrana dat', 'Vedení kanceláře'];

export default function Page() {
    return (
        <div className="bg-white text-slate-800">
            <JsonLd data={breadcrumbLd([['Kancelář Pro', '/'], ['Návody', '/navody']])} />
            <SiteHeader current="/navody" />
            <main className="mx-auto max-w-5xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
                <p className="text-sm font-semibold text-indigo-700">Návody</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Návody pro advokáty a koncipienty</h1>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">Praktické shrnutí pravidel, se kterými se advokát potkává každý týden: lhůty, doručování, odměna, úschovy, AML, mlčenlivost a vedení kanceláře. Stručně, s příklady a s odkazy na předpisy.</p>

                <div className="mt-12 space-y-12">
                    {CATEGORIES.map((cat) => {
                        const items = GUIDES.filter((g) => g.category === cat);
                        if (!items.length) return null;
                        return (
                            <section key={cat} aria-labelledby={`k-${cat}`}>
                                <h2 id={`k-${cat}`} className="text-lg font-bold text-slate-900">{cat}</h2>
                                <ul className="mt-4 grid gap-4 md:grid-cols-2">
                                    {items.map((g) => (
                                        <li key={g.slug}>
                                            <Link href={`/navody/${g.slug}`} className="group flex h-full flex-col rounded-2xl border border-slate-200 p-5 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100">
                                                <span className="text-lg font-semibold leading-snug text-slate-900 group-hover:text-indigo-800">{g.title}</span>
                                                <span className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{g.description}</span>
                                                <span className="mt-4 flex items-center justify-between text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><Clock3 size={13} aria-hidden="true" /> {g.minutes} min</span><span className="inline-flex items-center gap-1 font-semibold text-indigo-700">Číst <ArrowRight size={13} aria-hidden="true" /></span></span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        );
                    })}
                </div>
            </main>
            <FinalCta />
            <SiteFooter />
        </div>
    );
}
