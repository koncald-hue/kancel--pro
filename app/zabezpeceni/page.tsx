import type { Metadata } from 'next';
import { Check, Minus } from 'lucide-react';
import { FinalCta, SiteFooter, SiteHeader } from '@/app/components/lawyer/LandingChrome';

export const metadata: Metadata = {
    title: 'Zabezpečení a architektura | Kancelář',
    description: 'Co je v Kanceláři end-to-end šifrované, co chrání přístupová práva v databázi, co zatím chybí a jak si to můžete ověřit.',
};

const E2EE = [
    ['Zprávy a soubory v klientském kanálu', 'Šifrují se v prohlížeči klíčem advokáta. Klíč klienta je v adrese odkazu za znakem #, který se na server neodesílá.'],
    ['Hesla ke schránce, datové schránce a tokeny', 'Uložená zašifrovaná hlavním klíčem advokáta. Server je vidí jen na dobu jednoho požadavku, nikde je neukládá v čitelné podobě a nezapisuje do logů.'],
    ['Hlavní klíč advokáta', 'Vzniká v prohlížeči, zabalený šifrovacím heslem a záchranným kódem. Bez hesla nebo kódu ho nikdo neobnoví, ani provozovatel.'],
];
const RIGHTS = [
    ['Věci, lhůty, klienti, kontakty, faktury, výkazy, úschovy', 'Nejsou end-to-end šifrované. Chrání je přístupová práva přímo v databázi (každý advokát vidí jen svá data a věci, které mu kolega výslovně sdílel), šifrování přenosu a šifrování v klidu u poskytovatele databáze.'],
    ['Obyčejné soubory ve spisu (nahrané advokátem)', 'Uložené v úložišti s právy podle věci. Provozovatel k nim má technicky přístup jako správce databáze; přístup omezuje organizace a auditní záznam.'],
    ['Evidence úschov', 'Vidí je jen vlastník záznamu. Pohyby se jen přidávají a nejdou přepsat ani smazat.'],
];
const CONTROLS = [
    'Dvoufázové přihlášení (TOTP) vynucené v samotné databázi, ne jen v aplikaci.',
    'Auditní záznam otevření a změn ve věcech, který si advokát může projít.',
    'Omezení počtu pokusů a ochrana proti hádání kódů klientského odkazu.',
    'Přísná Content-Security-Policy, zákaz vložení aplikace do cizí stránky a ochrana proti přesměrování.',
    'Hlídání lhůt a práv v databázi, ne jen v rozhraní: kolega ani vedoucí kanceláře nevidí data, která mu nebyla sdílena.',
    'Kontrola střetu zájmů napříč kanceláří vrací jen to, že shoda existuje, nikdy jméno kolegy ani věc.',
    'AI asistent je vypnutý, dokud advokát neudělí souhlas. Odesílá se jen vybraný text a před odesláním se zakryjí jména klienta a kontaktů a identifikátory.',
    'Anonymizér v aplikaci zakryje jména, rodná čísla, účty, adresy a kontakty číslovanými značkami a po odpovědi AI je vrátí zpět. Probíhá jen ve vašem prohlížeči, text se neodesílá ani neukládá.',
    'Přístupové tokeny ke kalendářům Google a Microsoft jsou uložené šifrovaně a do kalendáře se zapisují jen názvy a data lhůt, nikdy obsah věci. Push upozornění nesou jen počty lhůt, žádná jména.',
    'Offline lhůty na zařízení jsou nepovinné, zapíná je advokát sám a jdou smazat jedním tlačítkem. Servisní skript aplikace do paměti neukládá žádná data věcí.',
];
// Kdo data zpracovává. Region u jednotlivých dodavatelů doplníme po ověření v jejich nastavení a ve zpracovatelských smlouvách.
const PROCESSORS = [
    ['Supabase', 'Databáze a úložiště souborů: věci, klienti, lhůty, faktury, nahrané soubory a zašifrované zprávy.'],
    ['Vercel', 'Hosting aplikace a plánované úlohy. Trvale neukládá obsah věcí.'],
    ['OpenAI', 'Jen text, který advokát při použití AI potvrdí, a to po zakrytí jmen a identifikátorů. Jen se souhlasem.'],
    ['Comgate', 'Platby kartou a uložená karta pro automatické obnovování. Údaje o kartě Kancelář nevidí.'],
    ['Resend nebo Brevo', 'Odeslání e-mailů z aplikace (upozornění, pozvánky). Vidí adresu příjemce a text zprávy.'],
    ['Google a Microsoft', 'Jen když propojíte kalendář: název a datum lhůty.'],
];
const MISSING = [
    'Nezávislý penetrační test třetí stranou. Máme vlastní sadu přes 80 automatických kontrol oprávnění a zneužití, která se spouští proti ostrému kódu, ale není to certifikace.',
    'Certifikace (například ISO 27001). Provozovatel ji nemá.',
    'Zkouška obnovy ze zálohy na ostrém prostředí.',
    'Uzavřené smlouvy se subdodavateli a ověřený region úložiště. Seznam zpracovatelů je v příloze zpracovatelské smlouvy.',
];

export default function Page() {
    return (
        <div className="bg-white text-slate-800">
            <SiteHeader current="/zabezpeceni" />
            <main className="mx-auto max-w-3xl px-4 pb-20 pt-16 sm:px-6">
                <p className="text-sm font-semibold text-indigo-700">Zabezpečení</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Co je chráněné jak, bez zjednodušování</h1>
                <p className="mt-4 text-base leading-relaxed text-slate-600">Mlčenlivost je základ vaší práce, proto tu nepíšeme „vše je šifrované“. Uvádíme, co je end-to-end šifrované (provozovatel to přečíst nemůže), co chrání přístupová práva a co zatím chybí.</p>

                <h2 className="mt-10 text-xl font-bold text-slate-900">End-to-end šifrované: provozovatel to nepřečte</h2>
                <ul className="mt-3 space-y-3">{E2EE.map(([t, d]) => <li key={t} className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"><Check size={18} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" /><span><strong className="block text-slate-900">{t}</strong><span className="text-sm text-slate-700">{d}</span></span></li>)}</ul>

                <h2 className="mt-10 text-xl font-bold text-slate-900">Chráněné právy v databázi, ne end-to-end</h2>
                <ul className="mt-3 space-y-3">{RIGHTS.map(([t, d]) => <li key={t} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><Minus size={18} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" /><span><strong className="block text-slate-900">{t}</strong><span className="text-sm text-slate-700">{d}</span></span></li>)}</ul>

                <h2 className="mt-10 text-xl font-bold text-slate-900">Ochranná opatření</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">{CONTROLS.map((c) => <li key={c}>{c}</li>)}</ul>

                <h2 className="mt-10 text-xl font-bold text-slate-900">Kdo data zpracovává</h2>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">{PROCESSORS.map(([n, d]) => <li key={n}><strong className="text-slate-900">{n}:</strong> {d}</li>)}</ul>
                <p className="mt-2 text-xs text-slate-500">Region uložení a uzavřené zpracovatelské smlouvy s dodavateli uvádíme zvlášť v příloze zpracovatelské smlouvy.</p>

                <h2 className="mt-10 text-xl font-bold text-slate-900">Co zatím chybí</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">{MISSING.map((c) => <li key={c}>{c}</li>)}</ul>

                <h2 className="mt-10 text-xl font-bold text-slate-900">Jak si to ověříte</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">Popis architektury, hranic důvěry a zadání pro nezávislý test dáme k dispozici každé kanceláři a jejímu auditorovi nebo správci IT. Na žádost umožníme provést vlastní test na zkušebním prostředí. Nalezené chyby nahlaste na kontakt provozovatele, opravíme je a uvedeme je v přehledu změn.</p>
            </main>
            <FinalCta />
            <SiteFooter />
        </div>
    );
}
