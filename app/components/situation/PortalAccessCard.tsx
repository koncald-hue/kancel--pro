'use client';

import { confirmAction } from '@/lib/confirm';
import { useEffect, useState } from 'react';
import { KeyRound, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isEmail } from '@/lib/mail';
import { ghostBtn, inputCls, primaryBtn } from './caseUi';

type Props = { linkId: string; factor: string | undefined; codeEmail: string | undefined; suggestedEmail: string; onChange: (change: { second_factor: 'none' | 'email'; code_email: string }) => Promise<void> };

// Přístup klienta: samotný odkaz, nebo odkaz + jednorázový kód z e-mailu (druhý faktor)
export default function PortalAccessCard({ linkId, factor, codeEmail, suggestedEmail, onChange }: Props) {
    const migrated = factor !== undefined;
    const on = factor === 'email';
    const [email, setEmail] = useState(codeEmail || suggestedEmail || '');
    const [mail, setMail] = useState<boolean | null>(null);
    const [sessions, setSessions] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');

    useEffect(() => {
        let alive = true;
        fetch('/api/config').then((r) => r.json()).then((c: { mail?: boolean }) => { if (alive) setMail(!!c.mail); }).catch(() => { if (alive) setMail(false); });
        if (on) supabase.from('portal_sessions').select('id', { count: 'exact', head: true }).eq('link_id', linkId).not('verified_at', 'is', null).gt('session_expires_at', new Date().toISOString()).then(({ count, error }) => { if (alive) setSessions(error ? null : count ?? 0); });
        return () => { alive = false; };
    }, [linkId, on]);

    async function save(next: boolean) {
        setBusy(true); setNote('');
        try { await onChange({ second_factor: next ? 'email' : 'none', code_email: next ? email.trim() : codeEmail ?? '' }); setNote(next ? 'Zapnuto. Klient při příštím otevření zadá kód z e-mailu.' : 'Vypnuto. Ke stránce opět stačí samotný odkaz.'); }
        finally { setBusy(false); }
    }
    async function logoutAll() {
        if (!(await confirmAction('Odhlásit klienta ze všech zařízení? Při dalším otevření odkazu se bude muset znovu ověřit kódem z e-mailu.', { danger: false, confirmLabel: 'Odhlásit' }))) return;
        setBusy(true);
        const { error } = await supabase.from('portal_sessions').delete().eq('link_id', linkId);
        setBusy(false);
        if (!error) { setSessions(0); setNote('Klient je odhlášený ze všech zařízení. Při dalším otevření zadá nový kód.'); }
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="pa-title">
            <h3 id="pa-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900"><KeyRound size={16} className="text-indigo-800" aria-hidden="true" /> Přístup klienta</h3>
            <p className="mt-1 text-sm text-slate-600">{on ? <>Ke stránce je potřeba <strong>odkaz a kód z e-mailu</strong>. Kód chodí na adresu, kterou jste zadali vy.</> : <>Teď stačí <strong>samotný odkaz</strong>: kdo ho má (třeba z přeposlaného e-mailu), vidí spis. Vyplněné jméno ani souhlas klienta totožnost neověřují.</>}</p>
            {!migrated ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-950">Ověření kódem vyžaduje SQL migraci supabase/migrations/20261117_02_portal-kod-z-emailu.sql.</p>
                : mail === false ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-950">Odesílání e-mailů není na serveru nastavené (MAIL_FROM a klíč Brevo/Resend), proto kód zapnout nejde.</p>
                    : (
                        <div className="mt-3 space-y-3">
                            {!on && (
                                <label className="block text-sm font-semibold text-slate-800">E-mail klienta pro kódy
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} className={`${inputCls} mt-1 max-w-sm`} />
                                    <span className="mt-1 block text-xs font-normal text-slate-500">Zkontrolujte, že adresa patří klientovi. Klient ji sám změnit nemůže.</span>
                                </label>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                                {on ? <button type="button" onClick={() => void save(false)} disabled={busy} className={ghostBtn}>Vypnout ověření kódem</button>
                                    : <button type="button" onClick={() => void save(true)} disabled={busy || !isEmail(email) || mail === null} className={primaryBtn}>Zapnout ověření kódem</button>}
                                {on && <button type="button" onClick={() => void logoutAll()} disabled={busy} className={ghostBtn}><LogOut size={14} aria-hidden="true" /> Odhlásit klienta ze všech zařízení{sessions ? ` (${sessions})` : ''}</button>}
                            </div>
                            {on && <p className="text-xs text-slate-500">Kód chodí na {codeEmail}. Změna adresy: vypněte a znovu zapněte s novou adresou.</p>}
                        </div>
                    )}
            {note && <p role="status" className="mt-2 text-xs font-semibold text-emerald-800">{note}</p>}
        </section>
    );
}
