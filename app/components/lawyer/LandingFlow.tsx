'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Check, FileSignature, Link2, Mail, QrCode, Timer, Upload, Wallet } from 'lucide-react';
import { Window } from './LandingMockups';

// Krátké ukázky v pohybu: tři postupy o třech krocích. Jména a údaje jsou smyšlené.
type Step = { icon: typeof Mail; title: string; text: string };
type Flow = { heading: string; lead: string; window: string; steps: Step[] };

const FLOWS: Flow[] = [
    {
        heading: 'Lhůty hlídá Kancelář',
        lead: 'Nic nepřehlédnete.',
        window: 'Datové zprávy',
        steps: [
            { icon: Mail, title: 'Přišla datová zpráva', text: 'Rozsudek, Okresní soud Plzeň-město, 12 C 345/2026.' },
            { icon: CalendarClock, title: 'Lhůta se spočítala sama', text: 'Odvolání do 15 dní od doručení. Poslední den: 24. 11. 2026.' },
            { icon: Link2, title: 'Klient má odkaz', text: 'Petr Novák si otevře svou věc v telefonu. Bez registrace.' },
        ],
    },
    {
        heading: 'Klient si vše vyřídí sám',
        lead: 'Vy nic nepřeposíláte.',
        window: 'Klientský odkaz',
        steps: [
            { icon: Upload, title: 'Nahrál podklady', text: 'Fotky zboží a fakturu. Soubory jsou šifrované.' },
            { icon: FileSignature, title: 'Podepsal smlouvu', text: 'Přímo v telefonu, podpis se uloží do věci.' },
            { icon: Check, title: 'Věc je připravená', text: 'Zpráva od klienta čeká ve věci, nic jste nehledali v e-mailu.' },
        ],
    },
    {
        heading: 'Práce se sama promění v peníze',
        lead: 'Žádný Excel.',
        window: 'Výkazy a fakturace',
        steps: [
            { icon: Timer, title: 'Zapsáno 2 h 30 min', text: 'Čas jde přímo do věci, s vaší hodinovou sazbou.' },
            { icon: QrCode, title: 'Vyúčtování připraveno', text: 'Faktura s QR platbou. Pošlete ji jedním klepnutím.' },
            { icon: Wallet, title: 'Platba spárována', text: 'Kancelář pozná, že klient zaplatil, a faktura je uhrazená.' },
        ],
    },
];

function FlowCard({ flow }: { flow: Flow }) {
    const [tick, setTick] = useState(0);
    const [still, setStill] = useState(false);
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { Promise.resolve().then(() => setStill(true)); return; }
        const t = setInterval(() => setTick((n) => n + 1), 2400);
        return () => clearInterval(t);
    }, []);
    const shown = still ? 3 : [1, 2, 3, 3][tick % 4];
    return (
        <div>
            <h3 className="text-lg font-bold text-slate-900">{flow.heading}</h3>
            <p className="mb-4 text-sm text-slate-600">{flow.lead}</p>
            <Window title={flow.window}>
                <ol className="space-y-2.5 p-4" aria-label={flow.heading}>
                    {flow.steps.map((s, i) => {
                        const Icon = s.icon;
                        const done = i < shown - 1 || still;
                        return (
                            <li key={s.title} className={`flex gap-3 rounded-xl border p-3 transition-all duration-500 ${i < shown ? 'translate-y-0 border-slate-200 bg-white opacity-100' : 'translate-y-2 border-transparent opacity-0'}`}>
                                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>{done ? <Check size={15} aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />}</span>
                                <span className="min-w-0"><span className="block text-sm font-semibold text-slate-900">{s.title}</span><span className="block text-xs leading-relaxed text-slate-600">{s.text}</span></span>
                            </li>
                        );
                    })}
                </ol>
            </Window>
        </div>
    );
}

export default function LandingFlow() {
    return <div className="grid gap-10 md:grid-cols-3 md:gap-6">{FLOWS.map((f) => <FlowCard key={f.heading} flow={f} />)}</div>;
}
