import Link from 'next/link';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import { FinalCta, SiteFooter, SiteHeader, StartButton } from '@/app/components/lawyer/LandingChrome';
import { LANDINGS, type Landing } from '@/lib/seo/landings';
import { GUIDES } from '@/lib/seo/guides';
import { breadcrumbLd, faqLd, JsonLd } from '@/lib/seo/jsonLd';

// Vstupní stránka na hledaný výraz: úvod, oddíly, časté otázky, související návody a další funkce
export default function LandingTemplate({ page }: { page: Landing }) {
    const guides = page.guides.map((s) => GUIDES.find((g) => g.slug === s)).filter((g) => !!g);
    const others = LANDINGS.filter((l) => l.slug !== page.slug);
    return (
        <div className="bg-white text-slate-800">
            <JsonLd data={[faqLd(page.faq), breadcrumbLd([['Kancelář Pro', '/'], [page.kicker, `/${page.slug}`]])]} />
            <SiteHeader />
            <main>
                <section className="border-b border-slate-100 bg-gradient-to-b from-indigo-50/60 to-white px-4 pb-14 pt-14 sm:px-6 sm:pt-20">
                    <div className="mx-auto max-w-3xl">
                        <nav aria-label="Drobečková navigace" className="text-xs text-slate-500"><Link href="/" className="hover:text-slate-800">Kancelář Pro</Link> <span aria-hidden="true">/</span> <span className="text-slate-700">{page.kicker}</span></nav>
                        <p className="mt-6 text-sm font-semibold text-indigo-700">{page.kicker}</p>
                        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-[2.6rem]">{page.h1}</h1>
                        <p className="mt-5 text-lg leading-relaxed text-slate-600">{page.intro}</p>
                        <div className="mt-8 flex flex-wrap items-center gap-3">
                            <StartButton />
                            {page.feature && <Link href={`/funkce#${page.feature}`} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-3 text-[15px] font-semibold text-indigo-800 hover:bg-indigo-50">Ukázka funkce <ArrowRight size={16} aria-hidden="true" /></Link>}
                        </div>
                        <p className="mt-3 text-xs text-slate-500">14 dní zdarma, bez karty a bez závazku.</p>
                    </div>
                </section>

                <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
                    <div className="space-y-12">
                        {page.sections.map((s) => (
                            <section key={s.h}>
                                <h2 className="text-2xl font-bold tracking-tight text-slate-900">{s.h}</h2>
                                {s.p.map((t) => <p key={t.slice(0, 40)} className="mt-3 text-base leading-relaxed text-slate-700">{t}</p>)}
                                {s.points && (
                                    <ul className="mt-4 space-y-2.5">
                                        {s.points.map((pt) => <li key={pt} className="flex gap-3 text-[15px] text-slate-700"><Check size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />{pt}</li>)}
                                    </ul>
                                )}
                            </section>
                        ))}
                    </div>

                    <section className="mt-16" aria-labelledby="faq">
                        <h2 id="faq" className="text-2xl font-bold tracking-tight text-slate-900">Časté otázky</h2>
                        <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200">
                            {page.faq.map((f) => (
                                <details key={f.q} className="group px-5 py-4">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900">{f.q}<ChevronDown size={18} className="shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden="true" /></summary>
                                    <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{f.a}</p>
                                </details>
                            ))}
                        </div>
                    </section>

                    {guides.length > 0 && (
                        <section className="mt-16" aria-labelledby="navody">
                            <h2 id="navody" className="text-2xl font-bold tracking-tight text-slate-900">Návody k tématu</h2>
                            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                                {guides.map((g) => (
                                    <li key={g.slug}><Link href={`/navody/${g.slug}`} className="block h-full rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/40"><span className="text-xs font-semibold text-indigo-700">{g.category}</span><span className="mt-1 block font-semibold leading-snug text-slate-900">{g.title}</span></Link></li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>

                <FinalCta />

                <section className="border-t border-slate-100 px-4 py-10 sm:px-6" aria-labelledby="dalsi">
                    <div className="mx-auto max-w-5xl">
                        <h2 id="dalsi" className="text-sm font-semibold uppercase tracking-wide text-slate-500">Co dalšího Kancelář Pro umí</h2>
                        <ul className="mt-3 flex flex-wrap gap-2">
                            {others.map((l) => <li key={l.slug}><Link href={`/${l.slug}`} className="inline-block rounded-full border border-slate-200 px-3.5 py-1.5 text-sm text-slate-700 hover:border-indigo-300 hover:text-indigo-800">{l.kicker}</Link></li>)}
                            <li><Link href="/navody" className="inline-block rounded-full border border-slate-200 px-3.5 py-1.5 text-sm text-slate-700 hover:border-indigo-300 hover:text-indigo-800">Návody pro advokáty</Link></li>
                        </ul>
                    </div>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
}
