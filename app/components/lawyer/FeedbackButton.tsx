'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { CheckCircle2, Loader2, MessageCircleWarning, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { FEEDBACK_KINDS, FEEDBACK_MAX, pageOnly, validateFeedback, type FeedbackKind } from '@/lib/feedback';
import { useLawyer } from './LawyerGate';

// Tlačítko v menu „Nahlásit problém nebo nápad“: zpráva jde přímo do Správy
export default function FeedbackButton() {
    const { userId } = useLawyer();
    const path = usePathname();
    const [open, setOpen] = useState(false);
    const [kind, setKind] = useState<FeedbackKind>('problem');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    function close() { setOpen(false); setSent(false); setError(''); setMessage(''); }
    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const problem = validateFeedback({ kind, message }); if (problem) { setError(problem); return; }
        setBusy(true); setError('');
        const { data: u } = await supabase.auth.getUser();
        const { error: err } = await supabase.from('feedback').insert({ user_id: userId, email: u.user?.email ?? '', kind, message: message.trim(), page: pageOnly(path ?? '') });
        setBusy(false);
        if (err) { setError('Zprávu se nepodařilo odeslat. Zkuste to prosím znovu.'); return; }
        setSent(true);
    }

    return (
        <>
            <button type="button" onClick={() => setOpen(true)} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"><MessageCircleWarning size={17} aria-hidden="true" className="text-slate-400" /> Nahlásit problém nebo nápad</button>
            {open && (
                <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Nahlásit problém nebo nápad" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
                    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                        <div className="flex items-start justify-between gap-3">
                            <div><h2 className="text-lg font-bold text-slate-900">Co vám vadí nebo chybí?</h2><p className="text-sm text-slate-600">Napište to, čtu každou zprávu osobně a opravujeme podle nich.</p></div>
                            <button type="button" onClick={close} aria-label="Zavřít" className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
                        </div>
                        {sent ? (
                            <div className="mt-4 text-center"><CheckCircle2 size={34} className="mx-auto text-emerald-600" aria-hidden="true" /><p className="mt-2 font-semibold text-slate-900">Děkujeme, zpráva je odeslaná.</p><button type="button" onClick={close} className="mt-4 cursor-pointer rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Zavřít</button></div>
                        ) : (
                            <form onSubmit={submit} className="mt-4 space-y-3">
                                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="O co jde">
                                    {FEEDBACK_KINDS.map((k) => <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold ${kind === k.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{k.label}</button>)}
                                </div>
                                <label className="block text-sm font-semibold text-slate-800">Vaše zpráva
                                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={FEEDBACK_MAX} rows={5} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" placeholder="Co jste chtěl(a) udělat a co se stalo? Co vám v programu chybí?" />
                                </label>
                                <p className="text-xs text-slate-500">Přiložíme jen váš e-mail a stránku, na které jste. Obsah spisů a klientů se neodesílá. Nepište prosím do zprávy údaje o klientech.</p>
                                {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm text-rose-900">{error}</p>}
                                <button type="submit" disabled={busy} className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}Odeslat</button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
