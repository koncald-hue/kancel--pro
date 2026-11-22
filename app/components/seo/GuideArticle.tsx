import Link from 'next/link';
import { ArrowRight, Clock3, Lightbulb } from 'lucide-react';
import { FinalCta, SiteFooter, SiteHeader } from '@/app/components/lawyer/LandingChrome';
import { GUIDES, type Guide } from '@/lib/seo/guides';
import { landingBySlug } from '@/lib/seo/landings';
import { articleLd, breadcrumbLd, JsonLd } from '@/lib/seo/jsonLd';

const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });

// Článek v sekci Návody: obsah, shrnutí, odkaz na související funkci a další články
export default function GuideArticle({ guide }: { guide: Guide }) {
    const path = `/navody/${guide.slug}`;
    const landing = landingBySlug(guide.landing);
    const more = GUIDES.filter((g) => g.slug !== guide.slug).sort((a, b) => Number(b.category === guide.category) - Number(a.category === guide.category)).slice(0, 4);
    return (
        <div className="bg-white text-slate-800">
            <JsonLd data={[articleLd({ ...guide, path }), breadcrumbLd([['Kancelář Pro', '/'], ['Návody', '/navody'], [guide.title, path]])]} />
            <SiteHeader current="/navody" />
            <main className="mx-auto max-w-3xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
                <nav aria-label="Drobečková navigace" className="text-xs text-slate-500"><Link href="/" className="hover:text-slate-800">Kancelář Pro</Link> <span aria-hidden="true">/</span> <Link href="/navody" className="hover:text-slate-800">Návody</Link> <span aria-hidden="true">/</span> <span className="text-slate-700">{guide.category}</span></nav>
                <article>
                    <header className="mt-6">
                        <p className="text-sm font-semibold text-indigo-700">{guide.category}</p>
                        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">{guide.title}</h1>
                        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500"><span className="inline-flex items-center gap-1.5"><Clock3 size={14} aria-hidden="true" /> {guide.minutes} min čtení</span><span>Aktualizováno <time dateTime={guide.updated}>{fmt(guide.updated)}</time></span></p>
                        <p className="mt-6 text-lg leading-relaxed text-slate-700">{guide.lead}</p>
                    </header>

                    <nav aria-label="Obsah článku" className="mt-8 rounded-xl bg-slate-50 p-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Obsah</p>
                        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                            {guide.sections.map((s, i) => <li key={s.h}><a href={`#cast-${i + 1}`} className="text-indigo-800 hover:underline">{s.h}</a></li>)}
                        </ol>
                    </nav>

                    <div className="mt-10 space-y-10">
                        {guide.sections.map((s, i) => (
                            <section key={s.h} id={`cast-${i + 1}`} className="scroll-mt-24">
                                <h2 className="text-2xl font-bold tracking-tight text-slate-900">{s.h}</h2>
                                {s.p.map((t) => <p key={t.slice(0, 40)} className="mt-3 text-[17px] leading-relaxed text-slate-700">{t}</p>)}
                                {s.points && <ul className="mt-3 list-disc space-y-2 pl-5 text-[17px] leading-relaxed text-slate-700">{s.points.map((pt) => <li key={pt}>{pt}</li>)}</ul>}
                            </section>
                        ))}
                    </div>

                    <aside className="mt-12 rounded-2xl border border-amber-200 bg-amber-50/60 p-6" aria-label="Shrnutí">
                        <p className="flex items-center gap-2 font-semibold text-slate-900"><Lightbulb size={18} className="text-amber-600" aria-hidden="true" /> Shrnutí</p>
                        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-slate-700">{guide.takeaways.map((t) => <li key={t}>{t}</li>)}</ul>
                    </aside>

                    <p className="mt-8 text-xs leading-relaxed text-slate-500">Článek je obecnou informací ke dni aktualizace a nenahrazuje právní posouzení konkrétní věci. Vždy vycházejte z aktuálního znění předpisů a z poučení v rozhodnutí.</p>
                </article>

                {landing && (
                    <Link href={`/${landing.slug}`} className="mt-10 flex items-center justify-between gap-4 rounded-2xl bg-indigo-700 p-6 text-white hover:bg-indigo-800">
                        <span><span className="block text-xs font-semibold uppercase tracking-wide text-indigo-200">Kancelář Pro</span><span className="mt-1 block text-lg font-semibold leading-snug">{landing.h1}</span></span>
                        <ArrowRight size={22} className="shrink-0" aria-hidden="true" />
                    </Link>
                )}

                <section className="mt-14" aria-labelledby="dalsi-navody">
                    <h2 id="dalsi-navody" className="text-xl font-bold text-slate-900">Další návody</h2>
                    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                        {more.map((g) => <li key={g.slug}><Link href={`/navody/${g.slug}`} className="block h-full rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/40"><span className="text-xs font-semibold text-indigo-700">{g.category}</span><span className="mt-1 block font-semibold leading-snug text-slate-900">{g.title}</span></Link></li>)}
                    </ul>
                </section>
            </main>
            <FinalCta />
            <SiteFooter />
        </div>
    );
}
