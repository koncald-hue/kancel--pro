'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Check, Link2, Mail } from 'lucide-react';
import { Window } from './LandingMockups';

// Krátká ukázka v pohybu: datová zpráva, spočtená lhůta, odkaz klientovi. Jména a údaje jsou smyšlené.
const STEPS = [
    { icon: Mail, title: 'Přišla datová zpráva', text: 'Rozsudek, Okresní soud Plzeň-město, 12 C 345/2026. Doručeno dnes.' },
    { icon: CalendarClock, title: 'Lhůta se spočítala sama', text: 'Odvolání do 15 dní od doručení. Poslední den: 24. 11. 2026 (pondělí).' },
    { icon: Link2, title: 'Klient dostal odkaz', text: 'Petr Novák si v telefonu otevře svou věc, nahraje podklady a napíše vám. Bez registrace.' },
] as const;

export default function LandingFlow() {
    const [tick, setTick] = useState(0);
    const [still, setStill] = useState(false);
    useEffect(() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) { Promise.resolve().then(() => { setStill(true); setTick(2); }); return; }
        const t = setInterval(() => setTick((n) => n + 1), 2600);
        return () => clearInterval(t);
    }, []);
    const shown = still ? STEPS.length : [1, 2, 3, 3][tick % 4];
    return (
        <Window title="Věc · Novák proti Dvořákovi">
            <ol className="space-y-3 p-5" aria-label="Ukázka postupu">
                {STEPS.map((s, i) => {
                    const on = i < shown || (shown === STEPS.length) || i === shown - 1;
                    const Icon = s.icon;
                    return (
                        <li key={s.title} className={`flex gap-3 rounded-xl border p-3 transition-all duration-500 ${i < shown ? 'translate-y-0 border-slate-200 bg-white opacity-100' : 'translate-y-2 border-transparent opacity-0'}`} aria-hidden={on ? undefined : true}>
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${i === shown - 1 || still ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>{i < shown - 1 && !still ? <Check size={16} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}</span>
                            <span className="min-w-0"><span className="block text-sm font-semibold text-slate-900">{s.title}</span><span className="block text-xs leading-relaxed text-slate-600">{s.text}</span></span>
                        </li>
                    );
                })}
            </ol>
        </Window>
    );
}
