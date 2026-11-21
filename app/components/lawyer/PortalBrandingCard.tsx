'use client';

import { useState } from 'react';
import { Palette } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ACCENTS, accentOf, greetingOf, type AccentKey } from '@/lib/portalBrand';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

// Vzhled klientské stránky: barva z pevné nabídky a krátké uvítání, které klient uvidí u vaší vizitky
export default function PortalBrandingCard() {
    const { access } = useLawyer();
    const a = access as unknown as { portal_accent?: string; portal_greeting?: string };
    const [accent, setAccent] = useState<AccentKey>(accentOf(a.portal_accent));
    const [greeting, setGreeting] = useState(greetingOf(a.portal_greeting));
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    async function save() {
        setBusy(true); setMsg('');
        const { error } = await supabase.rpc('save_portal_branding', { p_accent: accent, p_greeting: greeting });
        setBusy(false);
        setMsg(error ? (/save_portal_branding|schema cache/i.test(error.message) ? 'Vyžaduje SQL migraci 20261118_07.' : error.message) : 'Uloženo. Klienti uvidí změnu při dalším otevření stránky.');
    }
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="brand-title">
            <h3 id="brand-title" className="flex items-center gap-2 text-lg font-bold text-slate-900"><Palette size={18} className="text-indigo-800" aria-hidden="true" /> Vzhled klientské stránky</h3>
            <p className="mt-1 text-sm text-slate-600">Barva a krátké uvítání, které klient uvidí u vaší vizitky.</p>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Barva">
                {(Object.keys(ACCENTS) as AccentKey[]).map((k) => <button key={k} type="button" aria-pressed={accent === k} onClick={() => setAccent(k)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold cursor-pointer ${accent === k ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}><span className="h-3.5 w-3.5 rounded-full" style={{ background: ACCENTS[k].hex }} aria-hidden="true" />{ACCENTS[k].label}</button>)}
            </div>
            <label className="mt-3 block text-sm font-semibold text-slate-800">Uvítání (nejvýše 300 znaků)
                <textarea value={greeting} onChange={(e) => setGreeting(e.target.value.slice(0, 300))} rows={3} className={`${inputCls} mt-1`} placeholder="Např. Dobrý den, tady uvidíte stav svého spisu a můžete mi posílat podklady. Odpovídám obvykle do dvou pracovních dnů." />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void save()} disabled={busy} className={primaryBtn}>{busy ? 'Ukládám…' : 'Uložit'}</button><button type="button" onClick={() => { setAccent('indigo'); setGreeting(''); }} className={ghostBtn}>Výchozí</button>{msg && <span role="status" className="text-sm text-slate-700">{msg}</span>}</div>
        </section>
    );
}
