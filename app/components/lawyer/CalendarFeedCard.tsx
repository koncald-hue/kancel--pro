'use client';

import { confirmAction } from '@/lib/confirm';
import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Check, Copy, Loader2, RefreshCw, Smartphone, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { generateToken } from '@/lib/portal';
import { ghostBtn, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

type Feed = { token: string; include_titles: boolean };

// Karta v Nastavení: kalendář lhůt do telefonu odkazem (Apple Kalendář, Google, Outlook). Kalendář se sám aktualizuje.
export default function CalendarFeedCard() {
    const { userId } = useLawyer();
    const [feed, setFeed] = useState<Feed | null | undefined>(undefined);
    const [setup, setSetup] = useState(true);
    const [busy, setBusy] = useState('');
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        const { data, error: e } = await supabase.from('calendar_feeds').select('token, include_titles').eq('user_id', userId).maybeSingle();
        if (e) { setSetup(!/calendar_feeds|schema cache|does not exist/i.test(e.message)); setFeed(null); if (/calendar_feeds|schema cache|does not exist/i.test(e.message)) setError('Kalendář lhůt zatím není v databázi zapnutý (chybí spuštění souboru kalendar-feed.sql).'); return; }
        setFeed((data as Feed | null) ?? null);
    }, [userId]);
    useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const url = feed ? `${origin}/api/calendar/${feed.token}.ics` : '';
    const webcal = url.replace(/^https?:/, 'webcal:');

    async function create() { setBusy('c'); setError(''); const { error: e } = await supabase.from('calendar_feeds').upsert({ user_id: userId, token: generateToken(), include_titles: feed?.include_titles ?? false }); if (e) setError(e.message); await load(); setBusy(''); }
    async function remove() { if (!await confirmAction('Zrušit odkaz? Kalendář v telefonu přestane fungovat.')) return; setBusy('d'); await supabase.from('calendar_feeds').delete().eq('user_id', userId); await load(); setBusy(''); }
    async function titles(v: boolean) { if (!feed) return; setFeed({ ...feed, include_titles: v }); await supabase.from('calendar_feeds').update({ include_titles: v }).eq('user_id', userId); }
    async function copy() { await navigator.clipboard?.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }

    if (feed === undefined) return null;
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Kalendář lhůt do telefonu">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><CalendarDays size={18} className="text-indigo-800" aria-hidden="true" /> Kalendář lhůt do telefonu</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Všechny lhůty z vašich věcí se objeví v kalendáři v telefonu nebo v počítači (Apple Kalendář, Google, Outlook) a samy se aktualizují. Upozornění přijde týden předem, den předem a v den lhůty v 8:00.</p>
            {!setup ? <p role="alert" className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-slate-700">{error}</p> : feed === null ? (
                <button type="button" onClick={() => void create()} disabled={busy === 'c'} className={`${primaryBtn} mt-4`}>{busy === 'c' ? <Loader2 size={15} className="animate-spin" /> : <Smartphone size={15} />} Vytvořit odkaz na kalendář</button>
            ) : (
                <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                        <a href={webcal} className={primaryBtn}><CalendarDays size={15} /> Přidat do kalendáře</a>
                        <button type="button" onClick={() => void copy()} className={ghostBtn}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Zkopírováno' : 'Zkopírovat odkaz'}</button>
                    </div>
                    <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Adresa kalendáře" className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600" />
                    <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={feed.include_titles} onChange={(e) => void titles(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-800" /> <span>Psát do kalendáře i název věci. <span className="text-xs text-slate-500">Ve výchozím stavu se zobrazí jen název lhůty, aby se jména klientů nedostala do kalendáře, který může být sdílený nebo zálohovaný jinde.</span></span></label>
                    <details className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><summary className="cursor-pointer font-semibold">Jak to přidat</summary>
                        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed"><li><strong>iPhone a Mac:</strong> klikněte na „Přidat do kalendáře“ a potvrďte odběr. Nebo v Nastavení → Kalendář → Účty → Přidat účet → Jiný → Přidat odebíraný kalendář a vložte odkaz.</li><li><strong>Google Kalendář:</strong> v počítači Další kalendáře (+) → Z adresy URL, vložte odkaz. Google ho obnovuje podle vlastního rozvrhu, někdy až za několik hodin.</li><li><strong>Outlook:</strong> Přidat kalendář → Odebírat z webu, vložte odkaz.</li></ul></details>
                    <div className="flex flex-wrap items-center gap-3">
                        <button type="button" onClick={() => void create()} disabled={busy === 'c'} className={ghostBtn}><RefreshCw size={14} /> Vytvořit nový odkaz</button>
                        <button type="button" onClick={() => void remove()} disabled={busy === 'd'} className="inline-flex items-center gap-1.5 text-sm text-rose-700 hover:underline cursor-pointer"><Trash2 size={14} /> Zrušit odkaz</button>
                    </div>
                    <p className="text-xs text-slate-500">Odkaz je tajný: kdo ho zná, vidí vaše lhůty. Nikomu ho neposílejte. Při podezření na únik vytvořte nový, starý hned přestane fungovat.</p>
                </div>
            )}
            {setup && error && <p role="alert" className="mt-3 text-sm text-rose-800">{error}</p>}
        </section>
    );
}
