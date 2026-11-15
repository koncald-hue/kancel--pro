import type { Metadata } from 'next';
import Link from 'next/link';
import { Cl, Fill, LegalPage, Section, Sub } from '@/app/components/legal/Legal';
import { RETENTION_MONTHS, TERMS_VERSION } from '@/lib/company';

export const metadata: Metadata = { title: 'Zásady ochrany osobních údajů | Kancelář' };

export default function Page() {
    return (
        <LegalPage title="Zásady ochrany osobních údajů" intro="Jak Kancelář nakládá s osobními údaji svých zákazníků (advokátů a právníků). Údaje klientů zákazníků zpracováváme jen jako zpracovatel, viz Smlouva o zpracování osobních údajů.">
            <p className="-mt-6 text-sm text-slate-600">Znění {TERMS_VERSION}, účinné od <Fill k="effectiveFrom" label="datum účinnosti" />.</p>

            <Section n={1} title="Správce">
                <Cl n="1.1">Správcem osobních údajů uvedených níže je <Fill k="name" label="obchodní firma / jméno" />, IČO <Fill k="ico" label="IČO" />, <Fill k="address" label="adresa" />. Kontakt ve věcech osobních údajů: <Fill k="dataProtectionEmail" label="e-mail pro ochranu údajů" />.</Cl>
                <Cl n="1.2">Pokud Zákazník do Služby vkládá osobní údaje svých klientů a dalších osob, je jejich správcem on sám a my pro něj údaje zpracováváme jako zpracovatel. To upravuje <Link href="/zpracovani-osobnich-udaju" className="font-semibold text-indigo-700 underline">Smlouva o zpracování osobních údajů</Link>.</Cl>
            </Section>

            <Section n={2} title="Jaké údaje o Vás zpracováváme a proč">
                <Cl n="2.1">Údaje o zákaznících zpracováváme pro tyto účely:</Cl>
                <Sub>
                    <li><strong>Vedení účtu a poskytování Služby:</strong> e-mail, přihlašovací údaje (heslo ukládáme jen v nevratné podobě), jméno, název kanceláře, telefon, adresa kanceláře, web, evidenční číslo advokáta. Právní základ: plnění smlouvy (čl. 6 odst. 1 písm. b) GDPR).</li>
                    <li><strong>Ověření totožnosti:</strong> údaje z veřejného seznamu advokátů a doklad totožnosti nahraný k ověření (uložený zašifrovaný, čitelný jen správci Služby). Právní základ: oprávněný zájem na ochraně Klientů a zákazníků před vydáváním se za advokáta (čl. 6 odst. 1 písm. f) GDPR) a plnění smlouvy.</li>
                    <li><strong>Platby a účetnictví:</strong> údaje o objednávkách, platbách a fakturaci. Právní základ: plnění smlouvy a splnění právní povinnosti (účetní a daňové předpisy, čl. 6 odst. 1 písm. c) GDPR). Údaje o platbách uchováváme po dobu stanovenou těmito předpisy.</li>
                    <li><strong>Zabezpečení a provoz:</strong> technické záznamy o přístupech a chybách, ochrana před zneužitím. Právní základ: oprávněný zájem (čl. 6 odst. 1 písm. f) GDPR).</li>
                    <li><strong>Komunikace se zákazníky:</strong> odpovědi na dotazy a provozní oznámení (potvrzení registrace, změny podmínek). Právní základ: plnění smlouvy a oprávněný zájem.</li>
                </Sub>
                <Cl n="2.2">Marketingové zprávy nezasíláme. Nepoužíváme analytické ani reklamní cookies. Služba ukládá do prohlížeče jen technické údaje nezbytné pro přihlášení a provoz (např. relaci přihlášení).</Cl>
            </Section>

            <Section n={3} title="Komu údaje předáváme">
                <Cl n="3.1">Údaje zpřístupňujeme jen poskytovatelům, kteří nám pomáhají Službu provozovat: poskytovatel databáze a přihlašování (Supabase), hosting aplikace (<Fill k="hosting" label="hosting" />), e-mailové služby (<Fill k="mailProvider" label="poskytovatel e-mailů" />) a platební brána (<Fill k="paymentProvider" label="platební brána" />). Případně orgánům veřejné moci, pokud nám to ukládá zákon.</Cl>
                <Cl n="3.2">Údaje, které Zákazník sám zveřejní svým klientům (např. jméno a kontakt na klientském odkazu nebo poptávkovém formuláři), uvidí tito klienti.</Cl>
            </Section>

            <Section n={4} title="Jak dlouho údaje uchováváme">
                <Cl n="4.1">Údaje o Účtu uchováváme po dobu trvání smlouvy a po skončení přístupu po dobu {RETENTION_MONTHS} měsíců, poté je mažeme. Doklady k ověření totožnosti smažeme na žádost po skončení smlouvy, nejpozději spolu s Účtem. Účetní doklady uchováváme po dobu, kterou předepisují účetní a daňové předpisy.</Cl>
            </Section>

            <Section n={5} title="Vaše práva">
                <Cl n="5.1">Máte právo na přístup k údajům, jejich opravu, výmaz, omezení zpracování, přenositelnost a právo vznést námitku proti zpracování založenému na oprávněném zájmu. Žádost pošlete na <Fill k="dataProtectionEmail" label="e-mail pro ochranu údajů" />. Odpovíme bez zbytečného odkladu, nejpozději do jednoho měsíce.</Cl>
                <Cl n="5.2">Máte také právo podat stížnost u dozorového úřadu: Úřad pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Praha 7, www.uoou.gov.cz.</Cl>
            </Section>

            <Section n={6} title="Předání mimo EU">
                <Cl n="6.1">Pokud poskytovatel, kterého využíváme, předává údaje mimo Evropský hospodářský prostor, děje se tak jen za podmínek kapitoly V GDPR (rozhodnutí o odpovídající ochraně nebo standardní smluvní doložky). Aktuální přehled dalších zpracovatelů je ve Smlouvě o zpracování osobních údajů.</Cl>
            </Section>
        </LegalPage>
    );
}
