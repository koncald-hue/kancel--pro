'use client';

import { useMemo, useState } from 'react';
import { Copy, EyeOff, Undo2 } from 'lucide-react';
import { anonymizeText, restoreText, suggestNames, TOTAL } from '@/lib/anonymizer';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';

// Anonymizér: zakryje osobní údaje před vložením textu do AI nebo před sdílením, a umí je vrátit zpět v odpovědi.
// Všechno se počítá v prohlížeči, nic se neodesílá ani neukládá.
export default function Anonymizer() {
    const [src, setSrc] = useState('');
    const [people, setPeople] = useState<string[]>([]);
    const [manual, setManual] = useState('');
    const [reply, setReply] = useState('');
    const [copied, setCopied] = useState('');
    const suggestions = useMemo(() => suggestNames(src).filter((n) => !people.includes(n)), [src, people]);
    const result = useMemo(() => anonymizeText(src, people), [src, people]);
    const restored = useMemo(() => restoreText(reply, result.map), [reply, result.map]);
    const total = TOTAL(result.counts);

    async function copy(text: string, key: string) {
        try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 2000); } catch { setCopied(''); }
    }
    const addManual = () => { const v = manual.trim(); if (v && !people.includes(v)) setPeople([...people, v]); setManual(''); };

    return (
        <div className="mx-auto max-w-4xl space-y-5">
            <header>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><EyeOff size={22} className="text-indigo-800" /> Anonymizér</h1>
                <p className="mt-1 text-sm text-slate-600">Vložte text, zakryjeme rodná čísla, účty, e-maily, telefony, adresy a jména, která potvrdíte. Text s značkami pak můžete bezpečně vložit do AI. Odpověď si tu vrátíte zpět se skutečnými jmény. Všechno probíhá jen ve vašem prohlížeči, nic se neodesílá ani neukládá.</p>
            </header>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <label htmlFor="anon-src" className="text-sm font-semibold text-slate-800">Původní text</label>
                <textarea id="anon-src" value={src} onChange={(e) => setSrc(e.target.value)} rows={8} className={`${inputCls} mt-2`} placeholder="Vložte text smlouvy, žaloby, e-mailu…" />

                <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-800">Jména osob</p>
                    <p className="text-xs text-slate-500">Jména nejde poznat s jistotou, proto je potvrďte. Skloňování (Novák, Novákovi…) se hlídá.</p>
                    {people.length > 0 && <ul className="mt-2 flex flex-wrap gap-2">{people.map((p) => <li key={p}><button type="button" onClick={() => setPeople(people.filter((x) => x !== p))} className="cursor-pointer rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-950" aria-label={`Odebrat ${p}`}>{p} ×</button></li>)}</ul>}
                    {suggestions.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-xs text-slate-500">Nalezeno v textu:</span>{suggestions.map((n) => <button key={n} type="button" onClick={() => setPeople([...people, n])} className="cursor-pointer rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50">+ {n}</button>)}</div>}
                    <div className="mt-2 flex gap-2">
                        <input value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManual(); } }} className={`${inputCls} max-w-xs`} placeholder="Jméno a příjmení" aria-label="Přidat jméno" />
                        <button type="button" onClick={addManual} className={ghostBtn}>Přidat</button>
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-live="polite">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-bold text-slate-900">Anonymizovaný text</h2>
                    <button type="button" onClick={() => void copy(result.text, 'out')} disabled={!src} className={primaryBtn}><Copy size={14} /> {copied === 'out' ? 'Zkopírováno' : 'Zkopírovat'}</button>
                </div>
                <p className="mt-1 text-xs text-slate-500">{src ? `Zakryto ${total} údajů${total ? ': ' + Object.entries(result.counts).map(([k, v]) => `${k} ${v}`).join(', ') : ''}.` : 'Zatím žádný text.'} Před vložením do AI si výsledek přečtěte, nejde o stoprocentní záruku.</p>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm text-slate-800">{result.text || ' '}</pre>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Undo2 size={16} className="text-indigo-800" /> Vrátit zpět</h2>
                <p className="mt-1 text-xs text-slate-500">Vložte odpověď od AI se značkami, doplníme skutečná jména a údaje. Funguje, dokud máte tuto stránku otevřenou a původní text vložený nahoře.</p>
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={5} className={`${inputCls} mt-2`} aria-label="Odpověď se značkami" />
                {reply && <>
                    <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm text-slate-800">{restored}</pre>
                    <button type="button" onClick={() => void copy(restored, 'back')} className={`${ghostBtn} mt-2`}><Copy size={14} /> {copied === 'back' ? 'Zkopírováno' : 'Zkopírovat'}</button>
                </>}
            </section>
        </div>
    );
}
