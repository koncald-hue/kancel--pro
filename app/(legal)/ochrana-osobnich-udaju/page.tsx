import type { Metadata } from 'next';
import Link from 'next/link';
import { Cl, Fill, LegalPage, Section, Sub } from '@/app/components/legal/Legal';
import { RETENTION_MONTHS, TERMS_VERSION } from '@/lib/company';

export const metadata: Metadata = { title: 'Zásady ochrany osobních údajů | Kancelář Pro' };

export default function Page() {
    return (
        <LegalPage title="Zásady ochrany osobních údajů" intro="Jak Kancelář nakládá s osobními údaji svých zákazníků (advokátů a právníků). Údaje klientů zákazníků zpracováváme jen jako zpracovatel, viz Smlouva o zpracování osobních údajů.">
            <p className="-mt-6 text-sm text-slate-600">Znění {TERMS_VERSION}, účinné od <Fill k="effectiveFrom" label="datum účinnosti" />.</p>

            <Section n={1} title="Správce">
                <Cl n="1.1">Správcem osobních údajů uvedených níže je <Fill k="name" label="obchodní firma / jméno" />, IČO <Fill k="ico" label="IČO" />, <Fill k="address" label="adresa" />. Kontakt ve spisech osobních údajů: <Fill k="dataProtectionEmail" label="e-mail pro ochranu údajů" />.</Cl>
                <Cl n="1.2">Pokud Zákazník do Služby vkládá osobní údaje svých klientů a dalších osob, je jejich správcem on sám a my pro něj údaje zpracováváme jako zpracovatel. To upravuje <Link href="/zpracovani-osobnich-udaju" className="font-semibold text-indigo-700 underline">Smlouva o zpracování osobních údajů</Link>.</Cl>
            </Section>

            <Section n={2} title="Jaké údaje o Vás zpracováváme a proč">
                <Cl n="2.1">Údaje o zákaznících zpracováváme pro tyto účely:</Cl>
                <Sub>
                    <li><strong>Vedení účtu a poskytování Služby:</strong> e-mail, přihlašovací údaje (heslo ukládáme jen v nevratné podobě), jméno, název kanceláře, telefon, adresa kanceláře, web, evidenční číslo advokáta. Právní základ: plnění smlouvy (čl. 6 odst. 1 písm. b) GDPR).</li>
                    <li><strong>Profil zákazníka:</strong> jméno a příjmení, profese, evidenční číslo ČAK (u advokáta), adresa kanceláře, telefon, e-mail pro klienty, web. Právní základ: plnění smlouvy a oprávněný zájem na tom, aby bylo zřejmé, kdo Službu používá, a na ochraně klientů a zákazníků před zneužitím (čl. 6 odst. 1 písm. b) a f) GDPR). Tyto údaje vidí provozovatel Služby, kolegové Zákazníka z téže kanceláře a klienti Zákazníka na své stránce.</li>
                    <li><strong>Datum narození klienta (nepovinné):</strong> Zákazník ho může u klienta vyplnit. Používá se výhradně k tomu, aby šlo klienta, který je fyzickou osobou bez IČO, hlídat v insolvenčním rejstříku (rejstřík fyzickou osobu hledá podle jména, příjmení a data narození). Údaj se odesílá do veřejné služby Ministerstva spravedlnosti jen při této kontrole, jinak ho nikam nepředáváme ani nepoužíváme k jinému účelu. Zákazník je správcem osobních údajů svých klientů a odpovídá za to, že k jejich zpracování má právní důvod (typicky oprávněný zájem na ochraně pohledávek a zájmů klienta); my jsme zpracovatel. Údaj se smaže odebráním z karty klienta nebo smazáním klienta.</li>
                    <li><strong>Google Kalendář (volitelné):</strong> Zákazník může propojit lhůty se svým Google Kalendářem. Aplikace si u Googlu vytvoří vlastní kalendář a vidí jen ten. Do událostí zapisuje podle volby Zákazníka buď jen název lhůty, nebo i název spisu, případně jméno klienta a vysvětlení výpočtu; výchozí je jen název lhůty. Události ukládá Google (Google Ireland Limited a přidružené společnosti) podle svých podmínek. Přihlašovací token ke Googlu ukládáme jen zašifrovaný šifrovacím heslem Zákazníka. Propojení lze kdykoli odpojit a kalendář smazat.</li>
                    <li><strong>Hlídání insolvence (příplatek):</strong> u hlídaných osob uchováváme zadané identifikační údaje (u firmy IČO, u fyzické osoby jméno, příjmení a datum narození), výsledky z veřejného insolvenčního rejstříku a datum poslední kontroly. Údaje se odesílají do veřejné služby Ministerstva spravedlnosti. Seznam vidí jen uživatel, který osobu zadal. Zákazník je správcem údajů hlídaných osob, my jsme zpracovatel. Právní základ na straně Zákazníka: oprávněný zájem na ochraně pohledávek klientů (čl. 6 odst. 1 písm. f) GDPR). Seznam a nálezy se smažou odebráním osoby ze seznamu nebo smazáním účtu.</li>
                    <li><strong>Datové schránky:</strong> přihlašovací údaje ke schránce ukládáme výhradně zašifrované šifrovacím heslem Zákazníka (end-to-end), takže je nemůžeme přečíst. Při práci se schránkou je prohlížeč předá přes náš server provozovateli datových schránek na jedno volání, na serveru se neukládají ani nezapisují do logů. Obsah datových zpráv neuchováváme; ukládáme jen přílohy, které Zákazník výslovně uloží do spisu. Za obsah zpráv a jejich zpracování odpovídá Zákazník jako správce, my jsme zpracovatel.</li>
                    <li><strong>Bankovní účet (volitelné):</strong> Zákazník může nahrát výpis z kterékoli banky nebo propojit účet u Fio banky. Přístupový token ukládáme jen zašifrovaný šifrovacím heslem Zákazníka, takže jej nemůžeme přečíst, a pro stažení plateb prochází naším serverem jen po dobu dotazu bez uložení či zaznamenání. Z banky načítáme příchozí i odchozí pohyby (datum, částka, variabilní symbol, protistrana, číslo účtu a zpráva) a ukládáme je u Zákazníka, aby se spárovaly s vyúčtováním; mohou obsahovat osobní údaje plátců, za které je správcem Zákazník. Právní základ: plnění smlouvy. Napojení lze kdykoli odpojit a pohyby smazat.</li>
                    <li><strong>Podpisy a ověření totožnosti klientů:</strong> při podpisu dokumentu v portálu uchováváme doklad o podpisu (jméno, otisk dokumentu, čas, IP adresa, údaje o prohlížeči, maskované telefonní číslo a způsob ověření totožnosti). Při online ověření (Bank iD nebo mojeID) obdržíme od poskytovatele ověření jméno, datum narození, e-mail, telefon a adresu klienta; použijeme je jen k podpisu nebo identifikaci, o kterou Zákazník požádal. E-mailová adresa nebo telefonní číslo klienta se předá poskytovateli odesílání e-mailů nebo SMS jen k odeslání kódu. Za klienty je správcem těchto údajů Zákazník, my je zpracováváme pro něj. Právní základ: plnění smlouvy.</li>
                    <li><strong>E-mail v aplikaci (volitelné):</strong> Zákazník může připojit svou e-mailovou schránku. Heslo ke schránce ukládáme jen zašifrované šifrovacím heslem Zákazníka, takže ho nemůžeme přečíst. Zprávy se načítají přímo z poštovního serveru Zákazníka a procházejí naším serverem jen v paměti; spojení s poštovním serverem se z důvodu rychlosti drží otevřené nejvýše jednu minutu. Zprávy ani heslo neukládáme ani nezaznamenáváme. Uložíme jen zprávy a přílohy, které Zákazník sám uloží do spisu. Za osobní údaje v takto uložené poště je správcem Zákazník.</li>
                    <li><strong>Import dat:</strong> údaje, které Zákazník nahraje ze souboru (klienti, spisy, lhůty, kontakty, čas), se zpracovávají jen pro něj a ukládají se jako jeho obsah; k vrácení importu uchováváme záznam o dávce (typ, název souboru, počet záznamů).</li>
                    <li><strong>Návrh výkazu práce:</strong> zaznamenáváme, jaké úkony Zákazník ve Službě provedl (druh úkonu, spis, čas a případně název dokumentu, nikdy obsah), abychom mu mohli navrhnout výkaz práce. Záznamy vidí jen Zákazník a uchováváme je po dobu trvání účtu; Zákazník je může v návrhu zahodit. Právní základ: plnění smlouvy.</li>
                    <li><strong>Radar protistrany (volitelné):</strong> u kontaktů ve spisu, které Zákazník označí k hlídání, uchováváme IČO, případně jméno a datum narození, poslední známý stav z registru ARES a zjištěné události. Dotazy odesíláme do veřejných rejstříků (ARES, insolvenční rejstřík). Správcem těchto údajů je Zákazník, který odpovídá za to, že k hlídání má právní důvod; my je zpracováváme pro něj. Hlídání lze u kontaktu kdykoli vypnout.</li>
                    <li><strong>Právní rešerše:</strong> při rešerši se Zákazníkem odsouhlasený a automaticky anonymizovaný text (právní otázka, skutkový popis a Zákazníkem vybrané zápisy a dokumenty ze spisu, které se čtou v jeho prohlížeči a odchází bez jmen souborů) odešle přes náš server do právní databáze DirectCase a službě umělé inteligence OpenAI. Přihlašovací token k DirectCase ukládáme jen zašifrovaný šifrovacím heslem Zákazníka. Uložené rešerše (otázka, nalezené zdroje a vyhodnocení) jsou součástí spisu Zákazníka a smažou se s ní. Zákazník je správcem údajů ve spisu, my jsme zpracovatel; příjemci DirectCase a OpenAI jsou dalšími zpracovateli.</li>
                    <li><strong>Veřejné registry a mapy:</strong> při vyhledání firmy se zadaný text (IČO nebo název) odešle přes server Poskytovatele do veřejného registru ARES (Ministerstvo financí). Dotazy do katastru jdou přes server Poskytovatele do služeb ČÚZK. Při zobrazení mapy katastru prohlížeč načítá dlaždice mapy od OpenStreetMap a hranice parcel od ČÚZK, takže těmto poskytovatelům předává IP adresu zařízení. Obsah spisů se do těchto služeb nepřenáší.</li>
                    <li><strong>Fotka profilu (nepovinná):</strong> Zákazník ji nahrává dobrovolně a může ji kdykoli odstranit; ukládá se zmenšená a bez metadat. Vidí ji kolegové z kanceláře a klienti na své stránce. Právní základ: souhlas (čl. 6 odst. 1 písm. a) GDPR), který lze odvolat odstraněním fotky.</li>
                    <li><strong>Platby a účetnictví:</strong> údaje o objednávkách, platbách a fakturaci. Právní základ: plnění smlouvy a splnění právní povinnosti (účetní a daňové předpisy, čl. 6 odst. 1 písm. c) GDPR). Údaje o platbách uchováváme po dobu stanovenou těmito předpisy.</li>
                    <li><strong>Zabezpečení a provoz:</strong> technické záznamy o přístupech a chybách, ochrana před zneužitím. Právní základ: oprávněný zájem (čl. 6 odst. 1 písm. f) GDPR).</li>
                    <li><strong>Komunikace se zákazníky:</strong> odpovědi na dotazy a provozní oznámení (potvrzení registrace, změny podmínek). Právní základ: plnění smlouvy a oprávněný zájem.</li>
                </Sub>
                <Cl n="2.2">Marketingové zprávy nezasíláme. Nepoužíváme analytické ani reklamní cookies. Služba ukládá do prohlížeče jen technické údaje nezbytné pro přihlášení a provoz (např. relaci přihlášení).</Cl>
            </Section>

            <Section n={3} title="Komu údaje předáváme">
                <Cl n="3.1">Údaje zpřístupňujeme jen poskytovatelům, kteří nám pomáhají Službu provozovat: poskytovatel databáze a přihlašování (Supabase), hosting aplikace (<Fill k="hosting" label="hosting" />), e-mailové služby (<Fill k="mailProvider" label="poskytovatel e-mailů" />) a platební brána (<Fill k="paymentProvider" label="platební brána" />). Případně orgánům veřejné moci, pokud nám to ukládá zákon. Při ověření totožnosti klienta je provozovatel zvolené služby online ověření (Bank iD nebo mojeID) a kódy odesílá poskytovatel e-mailů nebo SMS.</Cl>
                <Cl n="3.2">Údaje, které Zákazník sám zveřejní svým klientům (např. jméno a kontakt na klientském odkazu nebo poptávkovém formuláři), uvidí tito klienti.</Cl>
            </Section>

            <Section n={4} title="Jak dlouho údaje uchováváme">
                <Cl n="4.1">Údaje o Účtu uchováváme po dobu trvání smlouvy a po skončení přístupu po dobu {RETENTION_MONTHS} měsíců, poté je mažeme. Účetní doklady uchováváme po dobu, kterou předepisují účetní a daňové předpisy.</Cl>
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
