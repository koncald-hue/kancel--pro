'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Check, FileText, Link2, Mail, QrCode, Timer, Wallet } from 'lucide-react';
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
            { icon: Link2, title: 'Klient má odkaz', text: 'Petr Novák si otevře svůj spis v telefonu. Bez registrace.' },
        ],
    },
    {
        heading: 'Práce se sama promění v peníze',
        lead: 'Žádný Excel.',
        window: 'Výkazy a fakturace',
        steps: [
            { icon: Timer, title: 'Zapsáno 2 h 30 min', text: 'Čas jde přímo do spisu, s vaší hodinovou sazbou.' },
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


// Jiná ukázka: telefon klienta. Zpráva, nahrání souboru, odpověď a podpis, vše v jednom okně.
function PhoneDemo() {
    const [tick, setTick] = useState(0);
    const [still, setStill] = useState(false);
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { Promise.resolve().then(() => setStill(true)); return; }
        const t = setInterval(() => setTick((n) => n + 1), 1800);
        return () => clearInterval(t);
    }, []);
    const p = still ? 5 : (tick % 6) + 1; // 1 zpráva, 2 nahrávání, 3 odpověď, 4 podpis, 5-6 hotovo
    const show = (n: number) => `transition-all duration-500 ${p >= n ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`;
    return (
        <div>
            <h3 className="text-lg font-bold text-slate-900">Klient si vše vyřídí sám</h3>
            <p className="mb-4 text-sm text-slate-600">Vy nic nepřeposíláte.</p>
            <div className="mx-auto w-full max-w-[260px] rounded-[2rem] border-4 border-slate-800 bg-white p-3 shadow-xl" role="img" aria-label="Ukázka telefonu klienta: zpráva od advokáta, nahrání souboru, odpověď a podpis smlouvy">
                <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-slate-300" />
                <div className="flex h-[300px] flex-col gap-2 overflow-hidden text-xs">
                    <div className={`max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-slate-800 ${show(1)}`}>Dobrý den, nahrajte prosím fakturu a fotky.</div>
                    <div className={`rounded-xl border border-slate-200 p-2 ${show(2)}`}>
                        <div className="flex items-center gap-2 text-slate-800"><FileText size={14} className="text-indigo-700" aria-hidden="true" /> faktura.pdf <span className="ml-auto text-emerald-700">{p >= 3 ? 'nahráno' : '…'}</span></div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-slate-200"><div className="h-1.5 rounded-full bg-indigo-600 transition-all duration-[1400ms]" style={{ width: p >= 3 || still ? '100%' : p === 2 ? '70%' : '0%' }} /></div>
                    </div>
                    <div className={`ml-auto max-w-[75%] rounded-2xl rounded-br-sm bg-indigo-600 px-3 py-2 text-white ${show(3)}`}>Posílám, díky.</div>
                    <div className={`rounded-xl border border-slate-200 p-2 ${show(4)}`}>
                        <p className="text-slate-800">Smlouva o právních službách</p>
                        <svg viewBox="0 0 120 30" className="mt-1 h-8 w-full text-slate-900" aria-hidden="true"><path d="M4 22 C 14 4, 22 4, 26 18 S 40 28, 48 10 S 62 6, 70 20 S 90 24, 116 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" pathLength="1" strokeDasharray="1" style={{ strokeDashoffset: p >= 5 || still ? 0 : 1, transition: 'stroke-dashoffset 1.2s ease' }} /></svg>
                        <p className={`flex items-center gap-1 text-emerald-700 transition-opacity duration-500 ${p >= 5 ? 'opacity-100' : 'opacity-0'}`}><Check size={13} aria-hidden="true" /> Podepsáno</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LandingFlow() {
    return <div className="grid gap-10 md:grid-cols-3 md:gap-6"><FlowCard flow={FLOWS[0]} /><PhoneDemo /><FlowCard flow={FLOWS[1]} /></div>;
}
