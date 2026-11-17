import { Check, FileSignature, Lock, MessageSquare, Smartphone, Upload } from 'lucide-react';
import { ClientMock, DashboardMock } from './LandingMockups';
import { SignMock } from './LandingDemo';
import { FinalCta, SiteFooter, SiteHeader } from './LandingChrome';

const STEPS = [
    { icon: Smartphone, t: 'Pošlete klientovi odkaz', d: 'U každé věci jedním kliknutím vytvoříte soukromý odkaz. Pošlete ho e-mailem nebo zprávou.' },
    { icon: Upload, t: 'Klient nahraje podklady', d: 'Z telefonu vyfotí dokumenty nebo nahraje soubory. Vidíte je hned ve spisu, nic nepřeposíláte.' },
    { icon: MessageSquare, t: 'Píšete si ve věci', d: 'Zprávy jsou na jednom místě u věci, ne roztroušené po e-mailech a chatech.' },
    { icon: FileSignature, t: 'Klient podepíše', d: 'Smlouvu nebo souhlas klient podepíše v portálu a vy dostanete PDF s dokladem o podpisu.' },
];

export default function ClientsPage() {
    return (
        <div className="bg-white text-slate-800">
            <SiteHeader current="/pro-klienty" />
            <section className="overflow-hidden bg-gradient-to-b from-indigo-50/70 to-white px-4 pb-20 pt-16 sm:px-6 sm:pt-20">
                <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
                    <div>
                        <p className="text-sm font-semibold text-indigo-700">Pro vaše klienty</p>
                        <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">Klient vidí svou věc v telefonu. Bez registrace a bez aplikace.</h1>
                        <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600">Stačí odkaz. Klient zjistí, v jakém je věc stavu, doplní podklady a napíše vám. Vy máte všechno pohromadě a klient méně důvodů volat.</p>
                    </div>
                    <div className="flex justify-center"><ClientMock /></div>
                </div>
            </section>
            <section className="px-4 py-20 sm:px-6 sm:py-24">
                <div className="mx-auto max-w-6xl">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Jak to probíhá</h2>
                    <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                        {STEPS.map(({ icon: Icon, t, d }, i) => (
                            <li key={t}><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><Icon size={22} aria-hidden="true" /></span><p className="mt-5 text-sm font-semibold text-indigo-700">Krok {i + 1}</p><h3 className="text-lg font-bold text-slate-900">{t}</h3><p className="mt-2 leading-relaxed text-slate-600">{d}</p></li>
                        ))}
                    </ol>
                </div>
            </section>
            <section className="border-y border-slate-100 bg-slate-50 px-4 py-20 sm:px-6 sm:py-24">
                <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
                    <div>
                        <p className="flex items-center gap-2 text-sm font-semibold text-indigo-700"><Lock size={16} aria-hidden="true" /> Bezpečnost</p>
                        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Zprávy a soubory vidíte jen vy a klient</h2>
                        <ul className="mt-6 space-y-3 text-slate-700">
                            {['Komunikace s klientem je šifrovaná end-to-end. Klíč je v odkazu a ve vašem šifrovacím heslu, provozovatel ho nemá.', 'Odkaz platí omezenou dobu a jde kdykoli zrušit.', 'Před podpisem klient potvrdí své jméno a jednorázový kód. Doklad o podpisu je zapečetěný.', 'Totožnost klienta si můžete ověřit a zapsat pro účely AML.'].map((t) => <li key={t} className="flex items-start gap-3"><Check size={18} className="mt-1 shrink-0 text-indigo-600" aria-hidden="true" />{t}</li>)}
                        </ul>
                    </div>
                    <div className="min-w-0"><SignMock /></div>
                </div>
            </section>
            <section className="px-4 py-20 sm:px-6 sm:py-24">
                <div className="mx-auto max-w-6xl">
                    <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">A co z toho máte vy</h2>
                    <div className="mt-10 grid items-start gap-10 lg:grid-cols-2">
                        <ul className="space-y-4 text-lg text-slate-700">{['Žádné přeposílání příloh mezi e-maily', 'Zprávy klienta rovnou ve věci', 'Přehled, co ještě klient musí dodat', 'Klient nevolá s otázkou „jak to vypadá“'].map((t) => <li key={t} className="flex items-start gap-3"><Check size={20} className="mt-1 shrink-0 text-emerald-600" aria-hidden="true" />{t}</li>)}</ul>
                        <div className="min-w-0"><DashboardMock /></div>
                    </div>
                </div>
            </section>
            <FinalCta />
            <SiteFooter />
        </div>
    );
}
