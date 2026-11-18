'use client';

import { confirmAction } from '@/lib/confirm';
import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { insertRow } from '@/lib/caseFile';
import { ghostBtn } from './caseUi';

const MESSAGES: Record<string, string> = {
    rate: 'Příliš mnoho upozornění. Zkuste to za hodinu.',
    no_email: 'U věci ani u odkazu není e-mail klienta. Doplňte ho v údajích o věci.',
    no_link: 'Klientská stránka není aktivní (odkaz je zrušený nebo vypršel).',
    mail_off: 'Odesílání e-mailů není na serveru nastavené.',
    mail_failed: 'E-mail se nepodařilo odeslat. Zkuste to znovu.',
    mfa: 'Přihlaste se znovu s kódem z aplikace.',
};

// Tlačítko „Upozornit klienta e-mailem“: klient dostane krátký e-mail bez údajů o věci. Odeslání advokát vždy potvrdí.
export default function NotifyClient({ caseId, userId, email }: { caseId: string; userId: string; email: string }) {
    const [busy, setBusy] = useState(false);
    // Týdenní přehled pro klienta (jen počty novinek a úkolů, bez obsahu); null = funkce není v databázi
    const [weekly, setWeekly] = useState<boolean | null>(null);
    useEffect(() => {
        let a = true;
        supabase.from('client_digest').select('enabled').eq('case_id', caseId).maybeSingle().then(({ data, error }) => { if (a) setWeekly(error ? null : !!data?.enabled); });
        return () => { a = false; };
    }, [caseId]);
    async function toggleWeekly(on: boolean) {
        setWeekly(on);
        const { error } = await supabase.from('client_digest').upsert({ case_id: caseId, user_id: userId, enabled: on, updated_at: new Date().toISOString() });
        if (error) { setWeekly(!on); setMsg({ ok: false, text: error.message }); }
    }
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    async function send() {
        if (!await confirmAction(`Odeslat klientovi na ${email} krátký e-mail, že ve věci je novinka?\n\nE-mail neobsahuje žádné údaje o věci ani odkaz. Klient si otevře svůj soukromý odkaz, který už má.`)) return;
        setBusy(true); setMsg(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/portal-notify', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ caseId, confirmed: true }) });
            const out = await res.json().catch(() => ({})) as { sent?: boolean; to?: string; error?: string };
            if (!res.ok || !out.sent) { setMsg({ ok: false, text: MESSAGES[out.error ?? ''] ?? 'Upozornění se nepodařilo odeslat.' }); return; }
            setMsg({ ok: true, text: `Odesláno na ${out.to}.` });
            try { await insertRow('case_entries', { case_id: caseId, user_id: userId, kind: 'event', title: 'Klient upozorněn e-mailem na novinku ve věci', body: '', happened_on: new Date().toISOString().slice(0, 10) }); } catch { /* chronologie není kritická */ }
        } catch { setMsg({ ok: false, text: 'Spojení selhalo.' }); } finally { setBusy(false); }
    }
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="nc-title">
            <h3 id="nc-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900"><BellRing size={16} className="text-indigo-800" aria-hidden="true" /> Upozornit klienta na novinku</h3>
            <p className="mt-1 text-sm text-slate-600">Zpřístupnili jste klientovi dokument, změnili stav nebo napsali zprávu? Pošlete mu krátký e-mail, ať se na svou stránku podívá. E-mail neobsahuje žádné údaje o věci.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void send()} disabled={busy || !email} className={ghostBtn}>{busy ? 'Odesílám…' : email ? `Upozornit na ${email}` : 'Chybí e-mail klienta'}</button>
                {msg && <span role={msg.ok ? 'status' : 'alert'} className={`text-sm font-semibold ${msg.ok ? 'text-emerald-800' : 'text-rose-800'}`}>{msg.text}</span>}
            </div>
            {weekly !== null && <label className="mt-3 flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-0.5" checked={weekly} disabled={!email} onChange={(e) => void toggleWeekly(e.target.checked)} /> <span>Posílat klientovi každé pondělí přehled, <span className="text-slate-500">jen pokud za týden přibyla novinka nebo má otevřený úkol. Obsahuje jen počty, žádné údaje o věci ani odkaz.</span></span></label>}
        </section>
    );
}
