import Link from 'next/link';
import LawyerPricing from './LawyerPricing';
import { ArrowRight, CalendarClock, Library, Clock3, FileArchive, FolderArchive, Share2, ShieldCheck, Users } from 'lucide-react';

const FEATURES = [
    [CalendarClock, 'Hlídání lhůt', 'Zákonné lhůty se počítají samy včetně posunu na pracovní den. Všechny termíny napříč věcmi vidíte na jednom přehledu a jedním kliknutím je dáte do kalendáře.'],
    [FolderArchive, 'Spis ke každé věci', 'Soubory ve složkách, chronologie, poznámky, kontakty a údaje o věci: klient, spisová značka, úřad nebo soud.'],
    [Users, 'Klienti, poptávky a věci', 'Adresář klientů, sazby, veřejný poptávkový formulář a přehled věcí v tabulce podle nejbližší lhůty. Hlídá i střet zájmů.'],
    [Clock3, 'Výkazy práce', 'Stopky nebo ruční zápis času, sazba podle klienta, součty a export do CSV pro fakturaci.'],
    [FileArchive, 'Předání spisu', 'Úplný přehled věci s číslovanými přílohami k tisku nebo jako ZIP, připravený pro soud, úřad nebo kolegu.'],
    [Library, 'Knihovna šablon a judikatury', 'Šablony podání a smluv a judikatura budou přímo ve spisu. Knihovna se právě buduje a bude součástí předplatného.'],
    [Share2, 'Klient bez registrace', 'Klientovi pošlete soukromý odkaz: vidí stav věci, nahrává podklady z mobilu a píše zprávy. Vy určujete, co uvidí, a odkaz kdykoli zrušíte.'],
    [ShieldCheck, 'Šifrování a oddělená data', 'Přenos je šifrovaný, soubory i zprávy jsou uložené šifrovaně v soukromém úložišti. Přístup mají jen advokát a klient s jeho odkazem. Nejde o end-to-end šifrování.'],
] as const;

export default function LawyerLanding() {
    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <header className="text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-800">Pro advokáty a právníky</p>
                <h1 className="mt-3 text-4xl sm:text-5xl font-bold leading-tight text-slate-900">Kancelář na jednom místě</h1>
                <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600">Lhůty, spisy, klienti a výkazy práce v jednoduchém nástroji, který nemusíte zaučovat. Vyzkoušíte ho 14 dní zdarma.</p>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                    <Link href="/kancelar" className="inline-flex items-center gap-2 rounded-xl bg-indigo-800 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-900">Vyzkoušet zdarma <ArrowRight size={16} aria-hidden="true" /></Link>
                </div>
            </header>

            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {FEATURES.map(([Icon, title, text]) => (
                    <li key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                        <span className="inline-flex rounded-xl bg-indigo-50 p-2.5 text-indigo-800"><Icon size={22} aria-hidden="true" /></span>
                        <h2 className="mt-3 text-lg font-bold text-slate-900">{title}</h2>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p>
                    </li>
                ))}
            </ul>

            <LawyerPricing />

            <section className="mt-12 rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-7 sm:p-9 text-center" aria-labelledby="lawyer-price">
                <h2 id="lawyer-price" className="text-2xl font-bold text-slate-900">Jak to funguje</h2>
                <ol className="mx-auto mt-4 grid max-w-3xl gap-3 text-left text-sm text-slate-700 sm:grid-cols-3">
                    <li className="rounded-xl bg-white p-4"><strong className="block text-slate-900">1. Zdarma 14 dní</strong>Vytvoříte si účet a rovnou zkoušíte.</li>
                    <li className="rounded-xl bg-white p-4"><strong className="block text-slate-900">2. Pracujete</strong>Zakládáte věci, hlídáte lhůty, píšete výkazy.</li>
                    <li className="rounded-xl bg-white p-4"><strong className="block text-slate-900">3. Předplatné</strong>Předplatné si koupíte po ověření totožnosti. Bez závazku.</li>
                </ol>
                <Link href="/kancelar" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800">Otevřít kancelář <ArrowRight size={16} aria-hidden="true" /></Link>
            </section>

            <p className="mt-8 text-center text-xs leading-relaxed text-slate-500">Nástroj slouží k organizaci práce a nenahrazuje advokátní software ani poradenství. Veřejná část webu pro občany zůstává bezplatná a samostatná.</p>
        </div>
    );
}
