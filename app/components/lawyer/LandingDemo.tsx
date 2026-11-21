'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Banknote, Briefcase, Clock3, FileSignature, FolderInput, LayoutDashboard, Mail, MailCheck, Paperclip, Receipt, Search, ShieldAlert, Users } from 'lucide-react';
import { qrSvg } from '@/lib/qrPayment';
import { CaseMock, DashboardMock, WorkMock, Window } from './LandingMockups';

// Ukázky rozhraní vykreslené z kódu. Jména, čísla a údaje jsou smyšlené.

const Badge = ({ tone, children }: { tone: string; children: React.ReactNode }) => <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>{children}</span>;

// Datová zpráva, ze které Kancelář vytáhla lhůtu
export function DatovkaMock() {
    return (
        <Window title="Datové zprávy · Doručené">
            <div className="p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="font-semibold text-slate-900">Okresní soud Plzeň-město</p><p className="text-xs text-slate-500">Rozsudek · 12 C 345/2026 · doručeno 20. 11. 2026</p></div>
                    <Badge tone="bg-emerald-50 text-emerald-800">Přečtená</Badge>
                </div>
                <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600"><Paperclip size={12} /> rozsudek-12C345.pdf · 4 strany</p>
                <div className="mt-3 rounded-xl border border-slate-200 p-3">
                    <p className="text-xs font-semibold text-slate-500">Nalezeno v rozhodnutí</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-700">„Proti tomuto rozsudku lze podat odvolání <mark className="rounded bg-amber-100 px-0.5 text-slate-900">do 15 dnů ode dne doručení</mark> jeho písemného vyhotovení…“</p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-indigo-50 p-3">
                    <div><p className="font-semibold text-indigo-950">Odvolání</p><p className="text-xs text-indigo-900/70">Konec lhůty pondělí 7. 12. 2026 (posunuto z neděle)</p></div>
                    <span className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white">Uložit do spisu</span>
                </div>
            </div>
        </Window>
    );
}

// E-mail s návrhem věci podle klienta
export function MailMock() {
    const rows: [string, string, string, boolean][] = [['Petr Novák', 'Fotky poškozeného zboží', '9:42', false], ['Stavební družstvo Jih', 'Re: Vyjádření k žalobě', 'včera', true], ['Exekutorský úřad Brno', 'Výzva k součinnosti', 'po', true]];
    return (
        <Window title="E-mail · Doručené">
            <div className="grid text-sm sm:grid-cols-[11rem_1fr]">
                <ul className="divide-y divide-slate-100 border-b border-slate-100 sm:border-b-0 sm:border-r">
                    {rows.map(([f, s, t, seen], i) => <li key={f} className={`px-3 py-2 ${i === 0 ? 'bg-indigo-50' : ''}`}><p className={`flex justify-between gap-2 truncate text-xs ${seen ? 'text-slate-600' : 'font-bold text-slate-900'}`}><span className="truncate">{f}</span><span className="shrink-0 font-normal text-slate-400">{t}</span></p><p className="truncate text-xs text-slate-500">{s}</p></li>)}
                </ul>
                <div className="p-3">
                    <p className="font-semibold text-slate-900">Fotky poškozeného zboží</p>
                    <p className="text-xs text-slate-500">Od: Petr Novák</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-700">Dobrý den, posílám fotky, jak jste chtěla. Fakturu doložím v pátek.</p>
                    <div className="mt-2 flex flex-wrap gap-1.5"><span className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-600"><Paperclip size={10} /> foto-1.jpg</span><span className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-600"><Paperclip size={10} /> foto-2.jpg</span></div>
                    <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-900"><FolderInput size={13} /> Uložit do spisu: Novák proti Dvořákovi</p>
                </div>
            </div>
        </Window>
    );
}

// Faktura s QR platbou a spárovanou platbou
export function InvoiceMock() {
    const [qr, setQr] = useState('');
    // Ukázkový kód s textem, ne skutečná platba
    useEffect(() => { let alive = true; qrSvg('UKAZKA KANCELAR', 120).then((s) => { if (alive) setQr(s); }).catch(() => undefined); return () => { alive = false; }; }, []);
    return (
        <Window title="Faktura 2026-014">
            <div className="grid gap-4 p-4 text-sm sm:grid-cols-[1fr_auto]">
                <div>
                    <p className="font-semibold text-slate-900">Petr Novák</p>
                    <p className="text-xs text-slate-500">Vystaveno 2. 11. · splatnost 16. 11. 2026</p>
                    <ul className="mt-3 space-y-1 text-xs text-slate-600">
                        <li className="flex justify-between gap-3"><span>Porada s klientem, 1:00 h</span><span>2 500 Kč</span></li>
                        <li className="flex justify-between gap-3"><span>Návrh vyjádření k žalobě, 2:30 h</span><span>6 250 Kč</span></li>
                        <li className="flex justify-between gap-3 border-t border-slate-100 pt-1 font-semibold text-slate-900"><span>Celkem s DPH</span><span>10 588 Kč</span></li>
                    </ul>
                    <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-900"><Banknote size={13} /> Zaplaceno 14. 11. · spárováno z banky podle VS</p>
                </div>
                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 p-2">
                    {qr ? <span className="block h-24 w-24 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} /> : <span className="block h-24 w-24 rounded bg-slate-100" />}
                    <span className="mt-1 text-[11px] font-semibold text-slate-500">QR platba</span>
                </div>
            </div>
        </Window>
    );
}

// Radar protistrany
export function RadarMock() {
    return (
        <Window title="Přehled · Radar">
            <ul className="space-y-2 p-4 text-sm">
                <li className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3"><ShieldAlert size={16} className="mt-0.5 shrink-0 text-rose-700" /><span className="min-w-0"><span className="block font-semibold text-slate-900">Dlužník v insolvenci</span><span className="block text-xs text-slate-600">Stavby Horák s.r.o. · spis Novák proti Horákovi</span><span className="mt-1.5 inline-block rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-rose-800">Navržená lhůta: přihláška pohledávky</span></span></li>
                <li className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700" /><span className="min-w-0"><span className="block font-semibold text-slate-900">Firma vstoupila do likvidace</span><span className="block text-xs text-slate-600">Obchod Jih a.s. · protistrana ve spisu Svoboda</span></span></li>
                <li className="flex items-start gap-3 rounded-xl border border-slate-200 p-3"><Briefcase size={16} className="mt-0.5 shrink-0 text-slate-500" /><span className="min-w-0"><span className="block font-semibold text-slate-900">Změna sídla</span><span className="block text-xs text-slate-600">Dvořák Trade s.r.o. · zkontrolujte doručovací adresu</span></span></li>
            </ul>
        </Window>
    );
}

// Podpis dokumentu klientem
export function SignMock() {
    return (
        <Window title="Spis · Podpisy">
            <div className="space-y-2 p-4 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><span className="min-w-0"><span className="block truncate font-semibold text-slate-900">Smlouva o poskytování právních služeb</span><span className="block text-xs text-slate-500">Petr Novák · ověřeno osobně + kód</span></span><Badge tone="bg-emerald-50 text-emerald-800">Podepsáno</Badge></div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><span className="min-w-0"><span className="block truncate font-semibold text-slate-900">Plná moc</span><span className="block text-xs text-slate-500">čeká na klienta · platí do 30. 11.</span></span><Badge tone="bg-amber-50 text-amber-800">Čeká</Badge></div>
                <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-600"><FileSignature size={13} className="text-indigo-700" /> Podepsané PDF s dokladem: čas, otisk dokumentu, ověření</p>
            </div>
        </Window>
    );
}

// Klikatelný náhled aplikace v úvodu stránky
const TABS = [
    { id: 'prehled', label: 'Přehled', icon: LayoutDashboard },
    { id: 'vec', label: 'Spisy', icon: Briefcase },
    { id: 'datovky', label: 'Datové zprávy', icon: MailCheck },
    { id: 'email', label: 'E-mail', icon: Mail },
    { id: 'vykazy', label: 'Výkazy', icon: Clock3 },
    { id: 'faktury', label: 'Faktury', icon: Receipt },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function ProductDemo() {
    const [tab, setTab] = useState<TabId>('prehled');
    const content: Record<TabId, React.ReactNode> = { prehled: <DashboardMock />, vec: <CaseMock />, datovky: <DatovkaMock />, email: <MailMock />, vykazy: <WorkMock />, faktury: <InvoiceMock /> };
    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.35)]">
            <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /><span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <span className="mx-auto flex items-center gap-1.5 rounded-md bg-white px-3 py-0.5 text-xs text-slate-400"><Search size={10} aria-hidden="true" /> kancelar.cz</span>
            </div>
            <div className="grid md:grid-cols-[11.5rem_1fr]">
                <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/60 p-2 md:flex-col md:border-b-0 md:border-r" aria-label="Ukázka aplikace">
                    {TABS.map(({ id, label, icon: Icon }) => (
                        <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition cursor-pointer ${tab === id ? 'bg-white text-indigo-800 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'}`}><Icon size={15} aria-hidden="true" /> {label}</button>
                    ))}
                    <span className="mt-auto hidden items-center gap-2 px-3 py-2 text-xs text-slate-400 md:flex"><Users size={13} aria-hidden="true" /> Ukázková data</span>
                </nav>
                <div className="min-h-[22rem] min-w-0 bg-slate-50/40 p-3 sm:p-5">
                    <div key={tab} className="[&>div]:shadow-none [&>div>div:first-child]:hidden motion-safe:animate-[fadeIn_.25s_ease-out]">{content[tab]}</div>
                </div>
            </div>
        </div>
    );
}

