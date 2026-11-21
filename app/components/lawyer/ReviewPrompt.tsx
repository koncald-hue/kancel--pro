'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { REVIEW_BODY_MAX, REVIEW_BODY_MIN, shouldAskReview, suggestName, validateReview, type ReviewDraft, type ReviewStatus } from '@/lib/testimonials';
import { useLawyer } from './LawyerGate';

const SNOOZE_KEY = 'kp-review-snoozed';
const readSnooze = (): number | null => { try { const v = Number(localStorage.getItem(SNOOZE_KEY)); return v > 0 ? v : null; } catch { return null; } };
const writeSnooze = () => { try { localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch { /* bez uložení se karta ukáže znovu */ } };

// Po několika dnech zkoušení se uživatel zeptá na hodnocení. Po schválení týmem se zobrazí na úvodní stránce.
export default function ReviewPrompt() {
    const { access, userId } = useLawyer();
    const [state, setState] = useState<'hidden' | 'ask' | 'sent'>('hidden');
    const [existing, setExisting] = useState<ReviewStatus | null>(null);
    const [d, setD] = useState<ReviewDraft>({ rating: 0, body: '', display_name: suggestName(access.display_name), role_label: '', consent: false });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let alive = true;
        (async () => {
            const [{ data: u }, r] = await Promise.all([supabase.auth.getUser(), supabase.from('testimonials').select('status').eq('user_id', userId).maybeSingle()]);
            if (!alive || r.error) return; // bez spuštěného recenze.sql se nic neukazuje
            if (r.data) { setExisting((r.data as { status: ReviewStatus }).status); return; }
            if (shouldAskReview({ registeredAt: u.user?.created_at ?? null, hasReview: false, snoozedAt: readSnooze() })) setState('ask');
        })().catch(() => undefined);
        return () => { alive = false; };
    }, [userId]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const problem = validateReview(d); if (problem) { setError(problem); return; }
        setBusy(true); setError('');
        const { error: err } = await supabase.from('testimonials').insert({ user_id: userId, rating: d.rating, body: d.body.trim(), display_name: d.display_name.trim(), role_label: d.role_label.trim(), consent: true });
        setBusy(false);
        if (err) { setError('Hodnocení se nepodařilo odeslat. Zkuste to prosím znovu.'); return; }
        setState('sent');
    }

    if (existing || state === 'hidden') return null;
    if (state === 'sent') return <p role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900"><CheckCircle2 size={18} aria-hidden="true" /> Děkujeme za hodnocení. Po kontrole se objeví na úvodní stránce.</p>;
    const field = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-700/40';
    return (
        <section aria-labelledby="review-title" className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5">
            <h2 id="review-title" className="text-base font-bold text-slate-900">Jak se vám s Kanceláří Pro pracuje?</h2>
            <p className="mt-1 text-sm text-slate-600">Vaše zkušenost pomůže dalším advokátům rozhodnout se. Zabere to minutu. Zveřejníme ji až po vašem souhlasu a po kontrole.</p>
            <form onSubmit={submit} className="mt-4 space-y-3">
                <div role="radiogroup" aria-label="Hodnocení" className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={d.rating === n} aria-label={`${n} z 5`} onClick={() => setD({ ...d, rating: n })} className="cursor-pointer rounded p-0.5 text-amber-500"><Star size={26} fill={n <= d.rating ? 'currentColor' : 'none'} className={n <= d.rating ? '' : 'text-slate-300'} aria-hidden="true" /></button>)}
                </div>
                <label className="block text-sm font-semibold text-slate-700">Vaše zkušenost<textarea value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} rows={4} maxLength={REVIEW_BODY_MAX} placeholder="Co vám Kancelář usnadnila? Co se vám líbí a co by mohlo být lepší?" className={`${field} mt-1 font-normal`} /><span className="text-xs font-normal text-slate-500">{d.body.trim().length}/{REVIEW_BODY_MAX} znaků, aspoň {REVIEW_BODY_MIN}</span></label>
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">Jméno, které se zobrazí<input value={d.display_name} onChange={(e) => setD({ ...d, display_name: e.target.value })} maxLength={80} className={`${field} mt-1 font-normal`} /></label>
                    <label className="block text-sm font-semibold text-slate-700">Popis (nepovinné)<input value={d.role_label} onChange={(e) => setD({ ...d, role_label: e.target.value })} maxLength={80} placeholder="např. advokátka, Plzeň" className={`${field} mt-1 font-normal`} /></label>
                </div>
                <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={d.consent} onChange={(e) => setD({ ...d, consent: e.target.checked })} className="mt-0.5 h-4 w-4 accent-indigo-800" /> <span>Souhlasím se zveřejněním tohoto hodnocení, svého jména a popisu na webu kancelarpro.cz. Souhlas mohu kdykoli odvolat smazáním hodnocení.</span></label>
                {error && <p role="alert" className="rounded-lg bg-rose-50 p-2.5 text-sm text-rose-900">{error}</p>}
                <div className="flex flex-wrap items-center gap-3">
                    <button type="submit" disabled={busy} className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-900 disabled:opacity-60">{busy && <Loader2 size={15} className="animate-spin" />} Odeslat hodnocení</button>
                    <button type="button" onClick={() => { writeSnooze(); setState('hidden'); }} className="cursor-pointer text-sm font-semibold text-slate-500 hover:text-slate-800">Později</button>
                </div>
            </form>
        </section>
    );
}
