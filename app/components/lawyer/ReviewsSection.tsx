import { Star } from 'lucide-react';
import type { Review } from '@/lib/testimonials';

// Recenze uživatelů na úvodní stránce: zobrazí se jen schválené, a jen když nějaké jsou
export default function ReviewsSection({ reviews }: { reviews: Review[] }) {
    if (!reviews.length) return null;
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    return (
        <section className="px-4 py-20 sm:px-6 sm:py-24" aria-labelledby="recenze-title">
            <div className="mx-auto max-w-5xl">
                <div className="text-center">
                    <p className="text-sm font-semibold text-indigo-800">Zkušenosti uživatelů</p>
                    <h2 id="recenze-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Jak to vidí ti, kdo to zkusili</h2>
                    {reviews.length >= 3 && <p className="mt-3 text-slate-600"><span className="font-semibold text-slate-900">{avg.toFixed(1).replace('.', ',')} z 5</span> podle {reviews.length} hodnocení</p>}
                </div>
                <ul className={`mt-10 grid gap-5 ${reviews.length === 1 ? 'mx-auto max-w-xl' : reviews.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
                    {reviews.map((r) => (
                        <li key={r.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                            <div className="flex gap-0.5 text-amber-500" role="img" aria-label={`Hodnocení ${r.rating} z 5`}>
                                {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={17} fill={n <= r.rating ? 'currentColor' : 'none'} className={n <= r.rating ? '' : 'text-slate-300'} aria-hidden="true" />)}
                            </div>
                            <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-slate-700">„{r.body}“</blockquote>
                            <figcaption className="mt-5 border-t border-slate-100 pt-4">
                                <p className="font-semibold text-slate-900">{r.display_name}</p>
                                {r.role_label && <p className="text-sm text-slate-500">{r.role_label}</p>}
                            </figcaption>
                        </li>))}
                </ul>
            </div>
        </section>
    );
}
