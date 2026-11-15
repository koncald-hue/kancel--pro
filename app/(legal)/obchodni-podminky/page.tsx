import type { Metadata } from 'next';
import Link from 'next/link';
import { Cl, Fill, LegalPage, Section } from '@/app/components/legal/Legal';
import { RETENTION_MONTHS, TERMS_VERSION, TRIAL_DAYS } from '@/lib/company';

export const metadata: Metadata = { title: 'Obchodní podmínky | Kancelář' };

export default function Page() {
    return (
        <LegalPage title="Obchodní podmínky služby Kancelář">
            <p className="-mt-6 text-sm text-slate-600">Znění {TERMS_VERSION}, účinné od <Fill k="effectiveFrom" label="datum účinnosti" />.</p>

            <Section n={1} title="Poskytovatel a vymezení pojmů">
                <Cl n="1.1">Službu Kancelář (dále jen „<strong>Služba</strong>“) provozuje <Fill k="name" label="obchodní firma / jméno" />, IČO: <Fill k="ico" label="IČO" />, DIČ: <Fill k="vat" label="DIČ nebo „není plátcem DPH“" />, se sídlem / místem podnikání <Fill k="address" label="adresa" />, <Fill k="register" label="zápis v rejstříku" /> (dále jen „<strong>Poskytovatel</strong>“). Kontakt: <Fill k="email" label="e-mail" />.</Cl>
                <Cl n="1.2">Tyto obchodní podmínky (dále jen „<strong>Podmínky</strong>“) upravují smlouvu o užívání Služby mezi Poskytovatelem a zákazníkem (dále jen „<strong>Zákazník</strong>“). Zákazníkem je advokát nebo jiný právník, případně advokátní kancelář, která Službu objednala.</Cl>
                <Cl n="1.3">„<strong>Účet</strong>“ je přístup Zákazníka ke Službě. „<strong>Předplatné</strong>“ je placený přístup ke Službě na zvolenou dobu. „<strong>Obsah Zákazníka</strong>“ jsou všechny údaje, dokumenty a zprávy, které Zákazník do Služby vloží nebo které do ní vloží jeho klient prostřednictvím klientského odkazu. „<strong>Klient</strong>“ je osoba, jejíž věc Zákazník ve Službě vede.</Cl>
            </Section>

            <Section n={2} title="Povaha Služby">
                <Cl n="2.1">Služba je softwarový nástroj dostupný přes internet, který Zákazníkovi pomáhá organizovat práci: vést věci a spisy, hlídat lhůty, evidovat klienty a výkazy práce, komunikovat s klientem a připravovat podklady.</Cl>
                <Cl n="2.2"><strong>Poskytovatel neposkytuje právní služby ani právní poradenství</strong> a není advokátem. Služba nenahrazuje odborný úsudek Zákazníka, advokátní software, který Zákazník jinak používá, ani povinnost vést dokumentaci o poskytování právních služeb podle zákona o advokacii (§ 25 odst. 1 zákona č. 85/1996 Sb.).</Cl>
                <Cl n="2.3">Výpočty lhůt, odkazy na znění zákonů a výstupy funkcí využívajících umělou inteligenci (včetně přípravy obrany) jsou <strong>pomůckou</strong>. Zákazník je povinen je před použitím ověřit podle platného právního předpisu a konkrétních okolností případu. Za správnost vstupních údajů, za volbu a ověření lhůt a za obsah svých podání odpovídá výhradně Zákazník. Údaje o nemovitostech zobrazené ve Službě pocházejí z bezplatného rozhraní katastru nemovitostí Českého úřadu zeměměřického a katastrálního, jsou informativní, bez právní závaznosti a nemusí odpovídat aktuálnímu stavu; pro řízení je Zákazník povinen použít ověřený výpis z katastru.</Cl>
                <Cl n="2.4">Poskytovatel Službu průběžně vyvíjí. Rozsah funkcí se může měnit; podstatné omezení funkcí, za které Zákazník zaplatil, se řídí článkem 12.</Cl>
            </Section>

            <Section n={3} title="Uzavření smlouvy, určení Služby pouze pro podnikatele">
                <Cl n="3.1">Smlouva vzniká založením Účtu, tj. dokončením registrace a potvrzením souhlasu s Podmínkami. Podmínky jsou Zákazníkovi přístupné před registrací a odkaz na ně je součástí registračního formuláře (§ 1751 občanského zákoníku).</Cl>
                <Cl n="3.2">Služba je určena <strong>výhradně pro podnikatele a pro osoby jednající při samostatném výkonu svého povolání</strong>, nikoli pro spotřebitele (§ 419 a § 420 občanského zákoníku). Zákazník registrací prohlašuje, že smlouvu uzavírá v rámci své podnikatelské činnosti nebo samostatného výkonu povolání, případně jednáním za advokátní kancelář nebo jiného podnikatele a že je k tomu oprávněn.</Cl>
                <Cl n="3.3">Zákazník poskytne pravdivé a úplné registrační údaje a bez zbytečného odkladu je aktualizuje.</Cl>
            </Section>

            <Section n={4} title="Zkušební období a profil Zákazníka">
                <Cl n="4.1">Nový Zákazník má nárok na bezplatné zkušební období v délce {TRIAL_DAYS} dnů od zahájení zkušebního přístupu. Poskytovatel nepožaduje zadání platební karty. Nárok na zkušební období je jeden na Zákazníka; Poskytovatel může zkušební přístup odepřít, pokud by jej Zákazník zjevně obcházel opakovanou registrací.</Cl>
                <Cl n="4.2">Před použitím Služby je Zákazník povinen vyplnit <strong>povinný profil</strong>: jméno a příjmení, profesi (advokát, nebo jiný právník), u advokáta evidenční číslo České advokátní komory, adresu kanceláře, telefon a e-mail pro klienty. Bez vyplněného profilu nelze Službu používat, ani zakoupit Předplatné. Údaje musí být pravdivé a úplné a Zákazník je povinen je udržovat aktuální.</Cl>
                <Cl n="4.3">Poskytovatel profilové údaje <strong>neověřuje</strong> a odpovídá pouze za jejich evidenci. Eviduje je a vede přehled osob, které Službu používají. Údaje z profilu (jméno, kancelář, kontakt, evidenční číslo) se zobrazují klientům Zákazníka na stránce, kterou jim Zákazník zpřístupní. Zákazník odpovídá za pravdivost svých údajů. V případě důvodného podezření ze zneužití Účtu nebo z uvedení nepravdivých údajů může Poskytovatel požadovat doložení oprávnění Zákazníka a do jeho doložení přístup pozastavit (čl. 11.2).</Cl>
                <Cl n="4.4">Po skončení zkušebního období přístup do Služby zůstane zablokován do zakoupení Předplatného. Data Zákazníka se uchovávají po dobu uvedenou v článku 10.</Cl>
            </Section>

            <Section n={5} title="Předplatné, cena a platba">
                <Cl n="5.1">Předplatné lze zakoupit na dobu <strong>jednoho měsíce, šesti měsíců nebo jednoho roku</strong>. Všechny varianty obsahují stejné funkce; liší se pouze délkou a cenou.</Cl>
                <Cl n="5.2">Platí cena uvedená v ceníku Služby v okamžiku vytvoření objednávky. Cena zaplaceného Předplatného se po dobu jeho trvání nemění. Ceník může Poskytovatel změnit s účinností pro nové objednávky.</Cl>
                <Cl n="5.3">Cena se platí předem, bezhotovostně prostřednictvím platební brány, kterou Poskytovatel Zákazníkovi nabídne při objednání. Poskytovatel Zákazníkovi po zaplacení vystaví daňový doklad (fakturu) a zašle jej elektronicky. Zda a v jaké výši je k ceně účtována daň z přidané hodnoty, je uvedeno v objednávce a na dokladu.</Cl>
                <Cl n="5.4">Předplatné začíná běžet okamžikem připsání platby. Zakoupí-li Zákazník nové Předplatné v době, kdy mu předchozí ještě trvá, prodlužuje se Předplatné o zakoupené období od konce stávajícího.</Cl>
                <Cl n="5.5"><strong>Předplatné se automaticky neobnovuje</strong> a Poskytovatel z platebního prostředku Zákazníka nic opakovaně nestrhává. Po uplynutí zaplaceného období přístup k Účtu skončí, pokud Zákazník nezakoupí další.</Cl>
                <Cl n="5.6">Pokud by platba dorazila od Zákazníka, který nemá vyplněný profil (čl. 4.2), Předplatné se neaktivuje a Poskytovatel platbu Zákazníkovi vrátí na účet, z něhož byla zaplacena.</Cl>
                <Cl n="5.7">Zaplacené Předplatné se nevrací, pokud tyto Podmínky nebo právní předpis nestanoví jinak. Právo odstoupit od smlouvy bez uvedení důvodu, které zákon přiznává spotřebitelům, Zákazníkovi nenáleží, protože Služba není určena spotřebitelům (čl. 3.2).</Cl>
                <Cl n="5.8"><strong>Balíčky pro advokátní kanceláře.</strong> Advokátní kancelář (dále jen „<strong>Kancelář</strong>“) může zakoupit balíček pro 3, 5 nebo 10 advokátů. Objednávku činí a platí vedoucí Kanceláře (dále jen „<strong>Vedoucí</strong>“), který odpovídá za její správnost, za platbu a za to, že je oprávněn jednat za Kancelář. Po zaplacení se přístup aktivuje všem členům Kanceláře po dobu Předplatného; ustanovení čl. 5.1 až 5.7 platí obdobně.</Cl>
                <Cl n="5.9"><strong>Každý člen je samostatným Zákazníkem.</strong> Člen Kanceláře si vytvoří vlastní Účet, vlastní heslo a vlastní šifrovací klíče a registrací uzavírá s Poskytovatelem smlouvu podle těchto Podmínek. Obsah Zákazníka, který člen do Služby vloží (věci, klienty, soubory, zprávy, výkazy), je přístupný pouze tomuto členovi. <strong>Vedoucí ani jiný člen Kanceláře k němu přístup nemá.</strong> Vedoucí vidí pouze jméno, e-mail, stav ověření totožnosti a stav přístupu členů. Každý člen vyplňuje svůj profil samostatně (čl. 4.2). Členové Kanceláře navzájem vidí jméno a e-mail kolegů, aby si mohli posílat dokumenty (čl. 5.14).</Cl>
                <Cl n="5.10"><strong>Pozvánky.</strong> Vedoucí zve členy odkazem, který platí 14 dní, lze jej použít jen jednou a jen pod účtem s e-mailem, na který byla pozvánka vystavena. Počet členů a nevyřízených pozvánek nesmí překročit počet míst v balíčku. Vedoucí odpovídá za výběr členů a za bezpečné předání odkazu.</Cl>
                <Cl n="5.11"><strong>Odebrání a odchod člena.</strong> Vedoucí může člena kdykoli odebrat a člen může Kancelář kdykoli opustit. Přístup z balíčku Kanceláře pak okamžitě zaniká; Obsah člena zůstává členovi a po dobu uvedenou v čl. 10 se uchovává. Člen si může zakoupit vlastní Předplatné. Odebráním člena nevzniká nárok na vrácení ceny balíčku, ani na jeho poměrnou část.</Cl>
                <Cl n="5.12"><strong>Skončení balíčku.</strong> Uplynutím Předplatného Kanceláře přístup všech členů z balíčku končí. Obsah členů se uchovává podle čl. 10. Člen bez vyplněného profilu Službu nemůže používat.</Cl>
                <Cl n="5.13"><strong>Osobní údaje.</strong> Ve vztahu k osobním údajům v Obsahu Zákazníka je správcem jednotlivý člen (případně Kancelář, pokud je správcem podle svých vnitřních pravidel a zákona); Vedoucí není kvůli roli Vedoucího zpracovatelem ani správcem Obsahu ostatních členů. Podrobnosti upravuje Smlouva o zpracování osobních údajů.</Cl>
                <Cl n="5.14"><strong>Šifrované sdílení dokumentů v Kanceláři.</strong> Členové Kanceláře si mohou posílat soubory. Soubor, jeho název i zpráva se šifrují v prohlížeči odesílatele (end-to-end) klíčem, který zná jen odesílatel a příjemce. Poskytovatel, Vedoucí ani jiný člen k obsahu přístup nemá. Kdo odešle soubor, odpovídá za to, že je oprávněn jej předat, a že jej předává kolegovi, kterému má být určen; Služba zobrazuje otisk klíče příjemce, který lze s příjemcem ověřit jinou cestou. Smazáním sdíleného souboru zmizí odesílateli i příjemci. Ztratí-li člen hlavní klíč (čl. 6.2), dříve přijaté soubory nepůjde obnovit.</Cl>
            </Section>

            <Section n={6} title="Práva a povinnosti Zákazníka">
                <Cl n="6.1">Účet je určen jedné fyzické osobě. Zákazník je povinen chránit své přihlašovací údaje a nesdílet je. Za veškerou činnost pod svým Účtem odpovídá Zákazník. Jakékoli podezření na zneužití Účtu je povinen bez zbytečného odkladu oznámit Poskytovateli.</Cl>
                <Cl n="6.2"><strong>Heslo kanceláře a záložní kód.</strong> Zprávy a soubory ve sdíleném kanálu s Klientem jsou šifrovány end-to-end klíčem, který chrání heslo kanceláře Zákazníka a záložní kód. Poskytovatel tyto klíče nemá a <strong>nemůže je obnovit</strong>. Zapomene-li Zákazník heslo kanceláře a ztratí záložní kód, tento šifrovaný obsah nebude možné nikým obnovit. Zákazník je povinen záložní kód bezpečně uložit.</Cl>
                <Cl n="6.3">Zákazník je v postavení správce osobních údajů svých Klientů a dalších osob, které ve Službě vede. Je povinen mít pro jejich zpracování právní důvod, plnit své povinnosti podle zákona o advokacii (zejména povinnost mlčenlivosti podle § 21 zákona č. 85/1996 Sb.) a podle předpisů o ochraně osobních údajů a informovat Klienty o použití Služby v rozsahu, v jakém to tyto předpisy vyžadují.</Cl>
                <Cl n="6.4">Zákazník nesmí Službu užívat v rozporu s právními předpisy, narušovat její provoz, obcházet technická opatření, pokoušet se o neoprávněný přístup k datům jiných zákazníků, hromadně stahovat obsah Služby automatizovanými prostředky ani Službu zpřístupňovat třetím osobám za úplatu. Zákazník nesmí uvádět nepravdivé údaje o své totožnosti nebo oprávnění.</Cl>
                <Cl n="6.5">Zákazník je povinen si pořizovat vlastní kopie dokumentů a údajů, které jsou pro něj klíčové, a to zejména s ohledem na povinnost vést dokumentaci o poskytování právních služeb. Služba nenahrazuje archiv Zákazníka. Funkce exportu spisu mu to umožňuje.</Cl>
            </Section>

            <Section n={7} title="Povinnosti Poskytovatele a dostupnost Služby">
                <Cl n="7.1">Poskytovatel zajistí přístup ke Službě po dobu trvání Předplatného s odbornou péčí, kterou lze od provozovatele takové Služby rozumně očekávat, a Službu průběžně udržuje.</Cl>
                <Cl n="7.2">Služba je provozována na infrastruktuře třetích osob. Poskytovatel <strong>nezaručuje nepřetržitý a bezchybný provoz</strong>; může docházet k plánované údržbě, výpadkům infrastruktury a k chybám, které Poskytovatel odstraňuje bez zbytečného odkladu po jejich zjištění. Poskytovatel nezaručuje zálohování Obsahu Zákazníka v rozsahu, který by nahradil archiv Zákazníka (čl. 6.5).</Cl>
                <Cl n="7.3">Zákaznická podpora je poskytována e-mailem na adrese <Fill k="email" label="e-mail" /> v pracovních dnech.</Cl>
            </Section>

            <Section n={8} title="Mlčenlivost a ochrana Obsahu Zákazníka">
                <Cl n="8.1">Poskytovatel je ve vztahu k Obsahu Zákazníka vázán <strong>mlčenlivostí</strong>. Obsah Zákazníka nezveřejní, nepředá třetí osobě a nepoužije jej k jinému účelu než k poskytování Služby. Povinnost se vztahuje i na jeho zaměstnance a další osoby, které Poskytovatel při provozu Služby využívá, a trvá i po skončení smlouvy.</Cl>
                <Cl n="8.2">Obsah zpráv a souborů ve sdíleném kanálu s Klientem je šifrován end-to-end a Poskytovatel k němu <strong>nemá technický přístup</strong>. Ostatní Obsah Zákazníka (např. názvy věcí, poznámky, chronologie, lhůty, údaje o klientech) je chráněn šifrováním přenosu a úložiště a pravidly přístupu, ale end-to-end šifrován není; Poskytovatel k němu může mít technický přístup, využije jej však jen v nezbytném rozsahu pro provoz a podporu Služby a zabezpečení.</Cl>
                <Cl n="8.3">Podmínky zpracování osobních údajů Klientů a dalších osob upravuje <Link href="/zpracovani-osobnich-udaju" className="font-semibold text-indigo-700 underline">Smlouva o zpracování osobních údajů</Link>, která je nedílnou součástí těchto Podmínek. Zpracování osobních údajů samotného Zákazníka popisují <Link href="/ochrana-osobnich-udaju" className="font-semibold text-indigo-700 underline">Zásady ochrany osobních údajů</Link>.</Cl>
            </Section>

            <Section n={9} title="Práva k Službě a k Obsahu Zákazníka">
                <Cl n="9.1">Poskytovatel uděluje Zákazníkovi nevýhradní, nepřevoditelnou a nepodlicencovatelnou licenci k užívání Služby v rozsahu jejího běžného používání a po dobu trvání Předplatného (a zkušebního období). Všechna práva ke Službě, k jejímu softwaru, vzhledu a databázím zůstávají Poskytovateli nebo jeho poskytovatelům licencí.</Cl>
                <Cl n="9.2">Obsah Zákazníka zůstává ve vlastnictví Zákazníka, případně jeho Klientů. Poskytovatel získává pouze oprávnění Obsah Zákazníka uchovávat a zpracovávat v rozsahu nezbytném k poskytování Služby.</Cl>
            </Section>

            <Section n={10} title="Uchování a vrácení dat po skončení přístupu">
                <Cl n="10.1">Po skončení Předplatného nebo zkušebního období zůstane Obsah Zákazníka uložen po dobu <strong>{RETENTION_MONTHS} měsíců</strong>, aby jej Zákazník mohl po obnovení Předplatného opět používat. Poté jej Poskytovatel nevratně smaže.</Cl>
                <Cl n="10.2">Zákazník může kdykoli požádat o smazání Účtu a Obsahu Zákazníka. Poskytovatel žádost vyřídí bez zbytečného odkladu, nejpozději do 30 dnů, a smazání potvrdí. Mazání z pomocných kopií se řídí Smlouvou o zpracování osobních údajů.</Cl>
                <Cl n="10.3">Před skončením přístupu si Zákazník může Obsah exportovat funkcemi Služby. Jakmile Obsah smaže, nelze jej obnovit.</Cl>
            </Section>

            <Section n={11} title="Pozastavení přístupu a ukončení smlouvy">
                <Cl n="11.1">Smlouva se uzavírá na dobu neurčitou. Zákazník ji může kdykoli ukončit požádáním o smazání Účtu. Předplatné, které již bylo zaplaceno a nebylo vyčerpáno, se v takovém případě nevrací (čl. 5.7), pokud Poskytovatel smlouvu neukončil z jiného důvodu než kvůli porušení povinností Zákazníkem.</Cl>
                <Cl n="11.2">Poskytovatel může přístup Zákazníka dočasně pozastavit nebo smlouvu s okamžitou účinností vypovědět, pokud Zákazník podstatně poruší Podmínky, zejména uvede nepravdivé údaje v profilu o své totožnosti či oprávnění, ohrozí bezpečnost Služby nebo jiných zákazníků, nebo užívá Službu k protiprávní činnosti. Je-li to možné a přiměřené, Poskytovatel Zákazníka předem upozorní a poskytne mu možnost nápravy.</Cl>
                <Cl n="11.3">Poskytovatel může smlouvu vypovědět i bez udání důvodu s výpovědní dobou 60 dnů. Ukončí-li smlouvu takto Poskytovatel nebo ukončí-li provoz Služby, vrátí Zákazníkovi poměrnou část ceny za nevyčerpané zaplacené Předplatné.</Cl>
            </Section>

            <Section n={12} title="Změny Služby a Podmínek">
                <Cl n="12.1">Poskytovatel je oprávněn Podmínky v přiměřeném rozsahu změnit, zejména kvůli změně právních předpisů, vývoji Služby nebo změně poskytovatelů, na jejichž infrastruktuře Služba běží (§ 1752 občanského zákoníku). O změně Zákazníka informuje e-mailem na adresu uvedenou v Účtu nejméně <strong>30 dnů</strong> před účinností změny.</Cl>
                <Cl n="12.2">Zákazník může změnu odmítnout a smlouvu z tohoto důvodu vypovědět písemně (e-mailem) nejpozději do dne účinnosti změny, a to bez jakékoli sankce. Výpověď je účinná ke dni účinnosti změny a Poskytovatel Zákazníkovi vrátí poměrnou část ceny za nevyčerpané zaplacené Předplatné. Nevypoví-li Zákazník smlouvu, platí od dne účinnosti nové znění Podmínek.</Cl>
                <Cl n="12.3">Změna, která podstatně omezí funkce, za které Zákazník již zaplatil, se na zaplacené Předplatné uplatní až po jeho skončení, případně Zákazníkovi vznikne právo na poměrné vrácení ceny podle čl. 12.2.</Cl>
            </Section>

            <Section n={13} title="Odpovědnost za újmu">
                <Cl n="13.1">Poskytovatel odpovídá za újmu způsobenou porušením svých povinností podle právních předpisů. Poskytovatel však neodpovídá za újmu, kterou způsobí Zákazník nebo třetí osoba, zejména nesprávnými vstupními údaji, neověřením výsledku výpočtu lhůty nebo výstupu s využitím umělé inteligence, ztrátou přístupových údajů nebo záložního kódu, nebo porušením povinností podle čl. 6.</Cl>
                <Cl n="13.2">Poskytovatel neodpovídá za nedostupnost Služby ani za ztrátu údajů, které způsobí událost mimo jeho rozumnou kontrolu, zejména výpadek infrastruktury poskytovatelů třetích stran, útok třetí osoby, který nebylo možné při dodržení odborné péče odvrátit, nebo vyšší moc, a to v rozsahu, v jakém to dovoluje zákon.</Cl>
                <Cl n="13.3">Žádné ustanovení těchto Podmínek nevylučuje ani neomezuje odpovědnost za újmu způsobenou úmyslně nebo z hrubé nedbalosti ani za újmu na přirozených právech člověka. K ujednáním, která by to předem vylučovala nebo omezovala, se podle § 2898 občanského zákoníku nepřihlíží.</Cl>
            </Section>

            <Section n={14} title="Doručování a komunikace">
                <Cl n="14.1">Poskytovatel doručuje oznámení Zákazníkovi na e-mail uvedený v Účtu. Zákazník doručuje oznámení Poskytovateli na <Fill k="email" label="e-mail" />. Oznámení se považuje za doručené následující pracovní den po odeslání, pokud se neprokáže něco jiného.</Cl>
                <Cl n="14.2">Zákazník je povinen udržovat e-mailovou adresu v Účtu funkční.</Cl>
            </Section>

            <Section n={15} title="Rozhodné právo a řešení sporů">
                <Cl n="15.1">Smlouva se řídí právem České republiky, zejména zákonem č. 89/2012 Sb., občanským zákoníkem.</Cl>
                <Cl n="15.2">Strany se pokusí spory vyřešit nejprve dohodou. Nepodaří-li se to, rozhodne o sporu věcně a místně příslušný soud České republiky.</Cl>
            </Section>

            <Section n={16} title="Závěrečná ustanovení">
                <Cl n="16.1">Bude-li některé ustanovení Podmínek neplatné nebo neúčinné, nedotýká se to platnosti ostatních. Strany nahradí neplatné ustanovení platným, které se co nejvíce blíží jeho účelu.</Cl>
                <Cl n="16.2">Podmínky tvoří spolu se Smlouvou o zpracování osobních údajů úplnou dohodu o předmětu smlouvy. Odchylná individuální ujednání mají přednost před Podmínkami (§ 1751 odst. 1 občanského zákoníku).</Cl>
                <Cl n="16.3">Tyto Podmínky nabývají účinnosti dnem uvedeným v záhlaví.</Cl>
            </Section>
        </LegalPage>
    );
}
