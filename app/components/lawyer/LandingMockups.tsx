import { CalendarClock, Check, FileText, Lock, Paperclip, Scale, Send } from 'lucide-react';

// Ukázky rozhraní vykreslené přímo z kódu (ne snímky obrazovky). Jména a data jsou smyšlená.
export const Window = ({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) => (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/50 ${className}`} role="img" aria-label={`Ukázka rozhraní: ${title}`}>
        <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            
            <span className="ml-3 text-xs font-medium text-slate-400">{title}</span>
        </div>
        <div aria-hidden="true">{children}</div>
    </div>
);

const Stat = ({ label, value, note }: { label: string; value: string; note?: string }) => (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">{value}</p>
        {note && <p className="text-[11px] text-slate-400">{note}</p>}
    </div>
);

// Přehled kanceláře
export function DashboardMock() {
    const deadlines: [string, string, string, string][] = [
        ['za 2 dny', 'Odpor proti platebnímu rozkazu', 'Novák proti Dvořákovi', 'text-rose-700 bg-rose-50'],
        ['za 6 dní', 'Vyjádření k žalobě', 'Stavební družstvo Jih', 'text-amber-700 bg-amber-50'],
        ['za 19 dní', 'Odvolání proti rozsudku', 'Svobodová, dědické řízení', 'text-emerald-700 bg-emerald-50'],
    ];
    return (
        <Window title="Kancelář Pro · Přehled">
            <div className="grid min-w-0 gap-3 bg-slate-50/60 p-4">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <Stat label="Otevřené věci" value="24" />
                    <Stat label="Lhůty do 7 dní" value="3" note="2 kritické" />
                    <Stat label="Nevyfakturováno" value="31:30" note="hodin práce" />
                    <Stat label="K fakturaci" value="47 250 Kč" />
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-4">
                    <p className="flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarClock size={15} className="text-indigo-700" /> Nejbližší lhůty</p>
                    <ul className="mt-3 space-y-2">
                        {deadlines.map(([when, title, who, tone]) => (
                            <li key={title} className="flex items-center justify-between gap-3 text-sm">
                                <span className="min-w-0"><span className="block truncate font-semibold text-slate-800">{title}</span><span className="text-xs text-slate-500">{who}</span></span>
                                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${tone}`}>{when}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </Window>
    );
}

// Spis věci
export function CaseMock() {
    return (
        <Window title="Věc · Novák proti Dvořákovi">
            <div className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><p className="text-sm font-bold text-slate-900">Novák proti Dvořákovi</p><p className="text-xs text-slate-500">Okresní soud Plzeň-město · 12 C 345/2026</p></div>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-800">Klient: Petr Novák</span>
                </div>
                <div className="mt-4 flex gap-1 border-b border-slate-100 text-xs font-semibold">
                    {['Přehled', 'Klient 2', 'Soubory 9', 'Lhůty 3', 'Chronologie'].map((t, i) => <span key={t} className={`border-b-2 px-2.5 py-2 ${i === 3 ? 'border-indigo-700 text-indigo-800' : 'border-transparent text-slate-500'}`}>{t}</span>)}
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                    {[['Odpor proti platebnímu rozkazu', '15 dní od doručení · 24. 11. 2026', 'Vypočteno automaticky', 'text-rose-700'], ['Vyjádření k žalobě', '30 dní · 9. 12. 2026', 'Posunuto na pracovní den', 'text-amber-700']].map(([t, d, n, c]) => (
                        <li key={t} className="rounded-xl border border-slate-100 p-3">
                            <p className="font-semibold text-slate-800">{t}</p>
                            <p className={`text-xs font-bold ${c}`}>{d}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400"><Check size={11} /> {n}</p>
                        </li>
                    ))}
                </ul>
            </div>
        </Window>
    );
}

// Klientský portál na telefonu
export function ClientMock() {
    return (
        <div className="mx-auto w-64 rounded-[2.2rem] border-8 border-slate-900 bg-white shadow-2xl shadow-slate-400/50" role="img" aria-label="Ukázka rozhraní: klientský portál na telefonu">
            <div aria-hidden="true" className="overflow-hidden rounded-[1.5rem] bg-slate-50">
                <div className="bg-indigo-700 px-4 py-3 text-white">
                    <p className="flex items-center gap-1.5 text-xs font-semibold opacity-90"><Scale size={12} /> JUDr. Jana Králová</p>
                    <p className="mt-0.5 text-sm font-bold">Vaše věc: Novák proti Dvořákovi</p>
                </div>
                <div className="space-y-2.5 p-3">
                    <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800"><Lock size={11} /> Zprávy jsou end-to-end šifrované</p>
                    <div className="rounded-xl rounded-tl-sm bg-white p-2.5 text-xs text-slate-700 shadow-xs">Dobrý den, žalobu jsme podali. Prosím nahrajte fotky poškozeného zboží.</div>
                    <div className="ml-6 rounded-xl rounded-tr-sm bg-indigo-600 p-2.5 text-xs text-white">Posílám, ještě v pátek doložím fakturu.</div>
                    <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 p-2.5 text-xs text-slate-600"><Paperclip size={12} /> foto-skoda-1.jpg · nahráno</div>
                    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-400">Napište zprávu… <Send size={12} className="ml-auto text-indigo-600" /></div>
                </div>
            </div>
        </div>
    );
}

// Výkazy práce
export function TimesheetMock() {
    const rows: [string, string, string, string][] = [['Porada s klientem', '1:00', '2 500 Kč', 'Novák proti Dvořákovi'], ['Návrh vyjádření k žalobě', '2:30', '6 250 Kč', 'Novák proti Dvořákovi'], ['Jednání u soudu', '3:15', '8 125 Kč', 'Svobodová, dědictví']];
    return (
        <Window title="Výkazy práce">
            <div className="p-4">
                <div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-900">Tento týden</p><span className="rounded-lg bg-indigo-700 px-2.5 py-1 text-xs font-bold text-white">Export CSV</span></div>
                <ul className="mt-3 divide-y divide-slate-100 text-sm">
                    {rows.map(([t, h, a, c]) => <li key={t} className="flex items-center justify-between gap-3 py-2"><span className="min-w-0"><span className="block truncate font-medium text-slate-800">{t}</span><span className="text-xs text-slate-400">{c}</span></span><span className="shrink-0 text-right"><span className="block font-bold text-slate-900">{h}</span><span className="text-xs text-slate-500">{a}</span></span></li>)}
                </ul>
                <p className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"><FileText size={13} className="text-indigo-700" /> Součet 6:45 hodin · 16 875 Kč k fakturaci</p>
            </div>
        </Window>
    );
}

// Návrh výkazu na konci dne
export function WorkMock() {
    const rows: [string, string, string][] = [['Novák proti Dvořákovi', 'Studium datové zprávy, příprava dokumentu: Odvolání', '1:15'], ['Stavební družstvo Jih', 'Korespondence e-mailem (3×), evidence lhůty', '0:30'], ['Svobodová, dědictví', 'Komunikace s klientem, záznam do spisu', '0:15']];
    return (
        <Window title="Výkazy · Návrh výkazu">
            <div className="p-4">
                <div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-900">Dnes jste pracovali na 3 věcech</p><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-800">2:00 h</span></div>
                <ul className="mt-3 space-y-2 text-sm">
                    {rows.map(([c, d, h]) => <li key={c} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"><span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-indigo-700 text-white"><Check size={11} /></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-800">{c}</span><span className="block truncate text-xs text-slate-500">{d}</span></span><span className="shrink-0 font-bold text-slate-900">{h}</span></li>)}
                </ul>
                <p className="mt-3 rounded-lg bg-indigo-700 px-3 py-2 text-center text-xs font-bold text-white">Zapsat vybrané (2:00 h)</p>
            </div>
        </Window>
    );
}
