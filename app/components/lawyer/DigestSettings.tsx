'use client';

import { useEffect, useState } from 'react';
import { Eye, Loader2, MailCheck, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ghostBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

const ERR: Record<string, string> = { mail_off: 'Odesílání e-mailů zatím není na serveru nastavené.', rate: 'Příliš mnoho pokusů, zkuste to za hodinu.', mail_failed: 'E-mail se nepodařilo odeslat.', mfa: 'Přihlaste se znovu druhým faktorem.' };

// Týdenní souhrn e-mailem: zapnutí, míra podrobnosti, náhled a zkušební odeslání na vlastní adresu
export default function DigestSettings() {
    const { userId } = useLawyer();
    const [s, setS] = useState<{ weekly: boolean; details: boolean } | null>(null);
    const [missing, setMissing] = useState(false);
    const [preview, setPreview] = useState<{ subject: string; text: string; worth: boolean } | null>(null);
    const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');

    useEffect(() => {
        let a = true;
        supabase.from('digest_settings').select('weekly, details').eq('user_id', userId).maybeSingle().then(({ data, error }) => {
            if (!a) return;
            if (error) { setMissing(/digest_settings|schema cache|does not exist/i.test(error.message)); setS({ weekly: false, details: false }); return; }
            setS({ weekly: !!data?.weekly, details: !!data?.details });
        });
        return () => { a = false; };
    }, [userId]);

    async function save(next: { weekly: boolean; details: boolean }) {
        setS(next); setMsg('');
        const { error } = await supabase.from('digest_settings').upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() });
        setMsg(error ? error.message : next.weekly ? 'Uloženo. Souhrn přijde v pondělí ráno, pokud je co hlásit.' : 'Souhrn je vypnutý.');
    }
    async function call(send: boolean) {
        setBusy(send ? 'send' : 'preview'); setMsg('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const r = await fetch('/api/digest', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ send, details: s?.details === true }) });
            const out = await r.json().catch(() => ({})) as { subject?: string; text?: string; worth?: boolean; to?: string; error?: string };
            if (!r.ok) { setMsg(ERR[out.error ?? ''] ?? 'Nepodařilo se.'); return; }
            if (send) setMsg(`Zkušební souhrn odeslán na ${out.to}.`); else setPreview({ subject: out.subject ?? '', text: out.text ?? '', worth: !!out.worth });
        } catch { setMsg('Spojení selhalo.'); } finally { setBusy(''); }
    }

    if (!s) return null;
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Týdenní souhrn">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><MailCheck size={18} className="text-indigo-700" aria-hidden="true" /> Týdenní souhrn e-mailem</h2>
            <p className="mt-1 text-sm text-slate-600">Každé pondělí ráno: lhůty a úkoly po termínu a na příštích 7 dní, novinky ve spisech, nevyfakturovaná práce, faktury po splatnosti, nové poptávky, pošta bez doručenky, spisy k vyřazení a koho zastupujete. Když není co hlásit, nic nepřijde.</p>
            {missing ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Zapne se po spuštění migrace 20261118_19.</p> : (
                <>
                    <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><input type="checkbox" checked={s.weekly} onChange={(e) => void save({ ...s, weekly: e.target.checked })} /> Posílat mi týdenní souhrn</label>
                    <label className="mt-2 flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-0.5" checked={s.details} onChange={(e) => void save({ ...s, details: e.target.checked })} /> <span>Uvádět i názvy spisů a lhůt. <span className="text-slate-500">Bez zaškrtnutí obsahuje e-mail jen počty, protože prochází přes poskytovatele rozesílky e-mailů.</span></span></label>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => void call(false)} disabled={!!busy} className={ghostBtn}>{busy === 'preview' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Náhled</button>
                        <button type="button" onClick={() => void call(true)} disabled={!!busy} className={ghostBtn}>{busy === 'send' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Poslat zkušební souhrn mně</button>
                    </div>
                    {msg && <p role="status" className="mt-2 text-sm text-slate-700">{msg}</p>}
                    {preview && <div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="text-sm font-semibold text-slate-900">{preview.subject}</p>{!preview.worth && <p className="text-xs text-slate-500">Tento týden by se souhrn neposlal, protože není co hlásit.</p>}<pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-slate-700">{preview.text}</pre></div>}
                </>
            )}
        </section>
    );
}
