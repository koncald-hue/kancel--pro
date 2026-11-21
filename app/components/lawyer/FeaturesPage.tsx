import { Check, FileArchive, FileText, Landmark, Map as MapIcon, Upload, Users } from 'lucide-react';
import { ClientMock, WorkMock } from './LandingMockups';
import { DatovkaMock, InvoiceMock, MailMock, RadarMock, SignMock } from './LandingDemo';
import { FinalCta, SiteFooter, SiteHeader } from './LandingChrome';

const FEATURES: { id: string; kicker: string; title: string; text: string; points: string[]; mock: React.ReactNode }[] = [
    { id: 'datovky', kicker: 'Datové schránky a lhůty', title: 'Z rozhodnutí rovnou lhůta v kalendáři', text: 'Datové zprávy čtete přímo v Kanceláři. U rozhodnutí aplikace najde poučení o lhůtě, spočítá její konec a posune ho na pracovní den. Ukáže přesnou větu, ze které vycházela, a uloží až po vašem potvrzení.', points: ['Přihlášení heslem nebo Mobilním klíčem', 'Zpráva i příloha jedním kliknutím do spisu', 'Svátky a víkendy podle zákona'], mock: <DatovkaMock /> },
    { id: 'email', kicker: 'E-mail', title: 'Pošta tam, kde je spis', text: 'Připojíte Gmail, Seznam nebo vlastní doménu a e-maily čtete i píšete v aplikaci. Kancelář pozná klienta podle adresy a nabídne, do kterého spisu zprávu i přílohy uložit.', points: ['Odpověď se zapíše do chronologie spisu', 'Přílohy rovnou mezi soubory spisu', 'Heslo uložené jen zašifrované'], mock: <MailMock /> },
    { id: 'vykaz', kicker: 'Výkaz práce', title: 'Výkaz, který se napíše sám', text: 'Kancelář si všímá, na čem jste pracovali: přečtené datovky, odeslané e-maily, připravené dokumenty, zprávy klientům. Večer navrhne výkaz po spisech. Čas upravíte a jedním kliknutím potvrdíte.', points: ['Nic se nezapíše bez potvrzení', 'Zaokrouhlení podle vaší praxe', 'Rovnou do vyúčtování'], mock: <WorkMock /> },
    { id: 'klient', kicker: 'Klient', title: 'Klient si podklady nahraje sám', text: 'Každý spis může mít soukromou stránku pro klienta. Vidí stav, nahraje dokumenty z telefonu, napíše zprávu a podepíše smlouvu. Bez registrace a bez přeposílání e-mailů.', points: ['Komunikace šifrovaná end-to-end', 'Podpis s dokladem o podpisu', 'Identifikace klienta pro AML'], mock: <div className="grid items-center gap-6 xl:grid-cols-[auto_1fr]"><ClientMock /><SignMock /></div> },
    { id: 'penize', kicker: 'Peníze', title: 'Faktura, QR platba a kontrola úhrad', text: 'Z výkazu vystavíte fakturu s QR platbou. Platby z účtu se samy spárují podle variabilního symbolu, po splatnosti připraví upomínku a účetní dostane podklady včetně ISDOC.', points: ['Fio automaticky, ostatní banky výpisem', 'Upomínky s úrokem z prodlení', 'Rentabilita spisů a klientů'], mock: <InvoiceMock /> },
    { id: 'radar', kicker: 'Radar', title: 'Víte o protistraně dřív než ostatní', text: 'Kancelář hlídá firmy a osoby ve vašich spisech v insolvenčním rejstříku a v ARES. Když dlužník vstoupí do insolvence nebo firma do likvidace, upozorní vás a navrhne lhůtu.', points: ['Dlužníci, protistrany i klienti', 'Upozornění přímo ve spisu', 'Lhůtu vždy potvrzujete vy'], mock: <RadarMock /> },
];

const MORE = [
    { icon: FileText, t: 'Vzory dokumentů', d: 'Smlouvy, plné moci, výzvy. Vyplní se ze spisu a klienta, výstup je upravený Word.' },
    { icon: MapIcon, t: 'Katastr nemovitostí', d: 'Parcely a stavby na mapě i podle čísla, přímo u spisu.' },
    { icon: Users, t: 'Práce v týmu', d: 'Sdílené spisy s kolegy, role a šifrovaný chat kanceláře.' },
    { icon: Upload, t: 'Přechod za odpoledne', d: 'Import klientů, spisů, lhůt a času z Excelu nebo jiného programu.' },
    { icon: FileArchive, t: 'Předání spisu', d: 'Souhrn spisu s očíslovanými přílohami pro soud, úřad nebo kolegu.' },
    { icon: Landmark, t: 'Právní novinky', d: 'Změny zákonů a novinky z právního světa sestavené automaticky v přehledu.' },
];

export default function FeaturesPage() {
    return (
        <div className="serif-headings bg-white text-slate-800">
            <SiteHeader current="/funkce" />
            <section className="bg-gradient-to-b from-indigo-50/70 to-white px-4 pb-6 pt-16 text-center sm:px-6 sm:pt-20">
                <p className="text-sm font-semibold text-indigo-700">Co Kancelář umí</p>
                <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">Všechno, co advokát denně dělá, na jednom místě</h1>
                <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">Šest věcí, které vás zdržují nejvíc, a jak je Kancelář zvládne za vás. U každé je ukázka rozhraní.</p>
            </section>
            <section className="px-4 py-16 sm:px-6 sm:py-24">
                <div className="mx-auto max-w-6xl space-y-24 sm:space-y-32">
                    {FEATURES.map((f, i) => (
                        <div key={f.title} id={f.id} className="grid scroll-mt-24 items-center gap-10 lg:grid-cols-2 lg:gap-16">
                            <div className={i % 2 ? 'lg:order-2' : ''}>
                                <p className="text-sm font-semibold text-indigo-700">{f.kicker}</p>
                                <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">{f.title}</h2>
                                <p className="mt-4 text-[17px] leading-relaxed text-slate-600">{f.text}</p>
                                <ul className="mt-6 space-y-2.5">{f.points.map((p) => <li key={p} className="flex items-start gap-2.5 text-slate-700"><Check size={18} className="mt-0.5 shrink-0 text-indigo-600" aria-hidden="true" />{p}</li>)}</ul>
                            </div>
                            <div className={`min-w-0 ${i % 2 ? 'lg:order-1' : ''}`}>{f.mock}</div>
                        </div>
                    ))}
                </div>
            </section>
            <section className="border-t border-slate-100 bg-slate-50 px-4 py-20 sm:px-6">
                <div className="mx-auto max-w-6xl">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">A k tomu</h2>
                    <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                        {MORE.map(({ icon: Icon, t, d }) => <li key={t} className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-indigo-700"><Icon size={18} aria-hidden="true" /></span><span><span className="block font-semibold text-slate-900">{t}</span><span className="mt-1 block text-sm leading-relaxed text-slate-600">{d}</span></span></li>)}
                    </ul>
                </div>
            </section>
            <div className="pt-20"><FinalCta /></div>
            <SiteFooter />
        </div>
    );
}
