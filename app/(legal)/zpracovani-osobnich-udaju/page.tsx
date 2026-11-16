import type { Metadata } from 'next';
import Link from 'next/link';
import { Cl, Fill, LegalPage, Section, Sub } from '@/app/components/legal/Legal';
import { RETENTION_MONTHS, TERMS_VERSION } from '@/lib/company';

export const metadata: Metadata = { title: 'Smlouva o zpracování osobních údajů | Kancelář' };

export default function Page() {
    return (
        <LegalPage title="Smlouva o zpracování osobních údajů" intro="Zpracovatelská smlouva podle čl. 28 nařízení (EU) 2016/679 (GDPR). Je nedílnou součástí Obchodních podmínek a uzavírá se spolu s nimi.">
            <p className="-mt-6 text-sm text-slate-600">Znění {TERMS_VERSION}, účinné od <Fill k="effectiveFrom" label="datum účinnosti" />.</p>

            <Section n={1} title="Smluvní strany a vymezení rolí">
                <Cl n="1.1"><strong>Správce:</strong> Zákazník (advokát, jiný právník nebo advokátní kancelář), který Službu Kancelář užívá. Správce určuje účely a prostředky zpracování osobních údajů svých klientů a dalších osob, které ve Službě vede.</Cl>
                <Cl n="1.2"><strong>Zpracovatel:</strong> <Fill k="name" label="obchodní firma / jméno" />, IČO <Fill k="ico" label="IČO" />, <Fill k="address" label="adresa" /> (dále jen „Zpracovatel“), poskytovatel Služby. Kontakt: <Fill k="dataProtectionEmail" label="e-mail pro ochranu údajů" />.</Cl>
                <Cl n="1.3">Tato smlouva upravuje zpracování osobních údajů, které Zpracovatel provádí pro Správce při provozu Služby (dále jen „<strong>Údaje</strong>“). Pojmy mají význam podle nařízení (EU) 2016/679 (dále jen „GDPR“).</Cl>
            </Section>

            <Section n={2} title="Předmět, povaha a účel zpracování">
                <Cl n="2.1">Zpracovatel ukládá a zpřístupňuje Údaje Správci v rámci Služby, zajišťuje jejich přenos mezi Správcem a jeho klienty (klientské odkazy), umožňuje jejich vyhledávání, třídění a export a technicky je zabezpečuje.</Cl>
                <Cl n="2.2">Účelem zpracování je poskytování Služby Správci. Zpracovatel Údaje nepoužívá pro vlastní účely, nezpracovává je k reklamě ani nevyužívá k trénování modelů umělé inteligence.</Cl>
                <Cl n="2.3"><strong>Kategorie subjektů údajů:</strong> klienti Správce, protistrany, svědci, zaměstnanci a další osoby, jejichž údaje Správce do spisů zadá nebo které mu klient zpřístupní.</Cl>
                <Cl n="2.4"><strong>Kategorie Údajů:</strong> identifikační a kontaktní údaje, údaje o věci a řízení, dokumenty a zprávy ve spisech a v komunikaci s klientem. Správce může do Služby vkládat i údaje, na které se vztahují čl. 9 a 10 GDPR (např. zdravotní údaje, údaje o trestních věcech); je odpovědný za to, aby pro to měl právní důvod.</Cl>
                <Cl n="2.5">Zpracování trvá po dobu trvání smlouvy o užívání Služby a poté po dobu uchování podle čl. 9.</Cl>
            </Section>

            <Section n={3} title="Pokyny Správce">
                <Cl n="3.1">Zpracovatel zpracovává Údaje <strong>pouze na základě doložených pokynů Správce</strong>. Pokyny jsou dány Obchodními podmínkami, touto smlouvou a nastavením a používáním funkcí Služby Správcem. Je-li Zpracovatel povinen zpracovat Údaje jinak podle práva Unie nebo členského státu, informuje o tom Správce předem, pokud mu to právo nezakazuje.</Cl>
                <Cl n="3.2">Domnívá-li se Zpracovatel, že pokyn Správce porušuje GDPR nebo jiný předpis o ochraně údajů, bez zbytečného odkladu Správce informuje.</Cl>
            </Section>

            <Section n={4} title="Mlčenlivost">
                <Cl n="4.1">Zpracovatel zajistí, aby se osoby oprávněné zpracovávat Údaje zavázaly k mlčenlivosti nebo se na ně vztahovala zákonná povinnost mlčenlivosti. Mlčenlivost trvá i po skončení zpracování.</Cl>
                <Cl n="4.2">Zpracovatel bere na vědomí, že Správce, je-li advokátem, je vázán povinností mlčenlivosti podle § 21 zákona č. 85/1996 Sb., o advokacii, a že tato povinnost se vztahuje obdobně i na osoby, které se s advokátem podílejí na poskytování právních služeb. Zpracovatel nezpřístupní Údaje třetí osobě s výjimkou subdodavatelů podle čl. 7 a případů, kdy to ukládá zákon.</Cl>
            </Section>

            <Section n={5} title="Zabezpečení Údajů">
                <Cl n="5.1">Zpracovatel přijímá s ohledem na stav techniky, náklady a povahu zpracování technická a organizační opatření ke zabezpečení Údajů podle čl. 32 GDPR. Jde zejména o:</Cl>
                <Sub>
                    <li>šifrování přenosu (TLS) mezi prohlížečem a Službou;</li>
                    <li>end-to-end šifrování chatu a sdílení (zprávy, soubory, věci, klienti) mezi členy Kanceláře: obsah se šifruje klíčem odesílatele a příjemce, soukromé klíče členů jsou uložené jen zašifrované jejich hlavním klíčem;</li>
                    <li>end-to-end šifrování zpráv a souborů ve sdíleném kanálu s klientem: klíč je jen u Správce (chráněn osobním šifrovacím heslem a záložním kódem) a v klientském odkazu, <strong>Zpracovatel k němu nemá přístup</strong>;</li>
                    <li>oddělení dat jednotlivých zákazníků pravidly přístupu na úrovni databáze (každý uživatel vidí jen své záznamy);</li>
                    <li>omezení přístupu Zpracovatele k Údajům na osoby, které je nezbytně potřebují, a ochranu přístupových klíčů a tajných údajů;</li>
                    <li>šifrované uložení dat u poskytovatele infrastruktury.</li>
                </Sub>
                <Cl n="5.2">Ostatní Údaje (např. názvy věcí, poznámky, chronologie, lhůty, údaje o klientech) end-to-end šifrovány nejsou. Jsou chráněny opatřeními uvedenými výše a Zpracovatel k nim může mít technický přístup; využije jej jen v nezbytném rozsahu pro provoz, podporu a zabezpečení Služby.</Cl>
                <Cl n="5.3">Správce odpovídá za zabezpečení svých přístupových údajů, šifrovacího hesla a záložního kódu a za nastavení sdílení vůči klientům (co klient vidí).</Cl>
            </Section>

            <Section n={6} title="Porušení zabezpečení">
                <Cl n="6.1">Zpracovatel oznámí Správci porušení zabezpečení osobních údajů <strong>bez zbytečného odkladu, nejpozději do 48 hodin</strong> od okamžiku, kdy se o něm dozvěděl, na e-mail Správce uvedený v Účtu. Oznámení obsahuje dostupné informace o povaze porušení, dotčených údajích a subjektech, pravděpodobných důsledcích a přijatých opatřeních.</Cl>
                <Cl n="6.2">Zpracovatel poskytne Správci součinnost při plnění jeho povinností oznámit porušení Úřadu pro ochranu osobních údajů a subjektům údajů.</Cl>
            </Section>

            <Section n={7} title="Další zpracovatelé (subdodavatelé)">
                <Cl n="7.1">Správce uděluje Zpracovateli obecné povolení k využití dalších zpracovatelů. K datu účinnosti této smlouvy se využívají:</Cl>
                <Sub>
                    <li><strong>Supabase</strong> (databáze, úložiště souborů a přihlašování uživatelů), region: <Fill k="dbRegion" label="region databáze, např. Frankfurt, EU" />;</li>
                    <li><strong>poskytovatel hostingu aplikace:</strong> <Fill k="hosting" label="hosting a region" />;</li>
                    <li><strong>OpenAI</strong> (pouze při použití funkce přípravy obrany ve spisu): na výslovný pokyn Správce se do služby odešlou údaje ze spisu (název, popis situace, shrnutí, chronologie, související zákony). Správce se rozhoduje, zda funkci použije, a odpovídá za to, že do ní nevloží údaje, jejichž předání není přípustné. Údaje jsou předávány do USA na základě mechanismů podle kapitoly V GDPR;</li>
                    <li><strong>poskytovatel e-mailů:</strong> <Fill k="mailProvider" label="např. Resend" /> (zasílání potvrzení registrace a oznámení);</li>
                    <li><strong>platební brána:</strong> <Fill k="paymentProvider" label="např. Stripe" /> (zpracování plateb za Předplatné; nezpracovává obsah spisů).</li>
                </Sub>
                <Cl n="7.2">O každém zamýšleném přidání nebo výměně dalšího zpracovatele Zpracovatel informuje Správce e-mailem nejméně <strong>30 dnů předem</strong>. Správce může proti změně vznést z důvodné obavy o ochranu Údajů námitku; nedojde-li k dohodě, může Správce smlouvu o užívání Služby vypovědět a Zpracovatel mu vrátí poměrnou část ceny za nevyčerpané Předplatné.</Cl>
                <Cl n="7.3">Zpracovatel uloží každému dalšímu zpracovateli povinnosti ochrany údajů ve stejném rozsahu, jako jsou tyto, a odpovídá Správci za plnění povinností dalšího zpracovatele.</Cl>
            </Section>

            <Section n={8} title="Součinnost se Správcem">
                <Cl n="8.1">Zpracovatel s ohledem na povahu zpracování pomáhá Správci technickými a organizačními prostředky plnit jeho povinnost reagovat na žádosti subjektů údajů o výkon práv podle kapitoly III GDPR. Obdrží-li Zpracovatel takovou žádost přímo od subjektu údajů, předá ji bez zbytečného odkladu Správci a na žádost sám nereaguje.</Cl>
                <Cl n="8.2">Zpracovatel pomáhá Správci při zajišťování bezpečnosti zpracování, oznamování porušení zabezpečení, posuzování vlivu na ochranu osobních údajů a předchozích konzultacích s dozorovým úřadem v rozsahu, v jakém to s ohledem na povahu zpracování a informace, které má k dispozici, lze rozumně požadovat.</Cl>
                <Cl n="8.3">Zpracovatel poskytne Správci na žádost informace potřebné k doložení splnění povinností podle čl. 28 GDPR a umožní audit, včetně inspekce, kterou provede Správce nebo jím pověřený auditor, a přispěje k němu. Audit se provádí na základě předchozí písemné žádosti, v pracovní době a tak, aby nenarušil bezpečnost jiných zákazníků. Primárně se provádí formou dokumentace a vzdáleného ověření.</Cl>
            </Section>

            <Section n={9} title="Výmaz a vrácení Údajů">
                <Cl n="9.1">Po skončení smlouvy o užívání Služby Zpracovatel Údaje uchová po dobu <strong>{RETENTION_MONTHS} měsíců</strong> (aby Správce mohl užívání obnovit), v této době je Správce může exportovat. Po jejím uplynutí, nebo dříve na žádost Správce, Zpracovatel Údaje nevratně smaže, včetně existujících kopií, ledaže právo Unie nebo členského státu vyžaduje jejich uložení.</Cl>
                <Cl n="9.2">Údaje v pomocných kopiích a zálohách u poskytovatelů infrastruktury se smažou v rámci jejich běžného cyklu rotace, nejpozději do 90 dnů od smazání z provozní databáze.</Cl>
            </Section>

            <Section n={10} title="Předání do třetích zemí">
                <Cl n="10.1">Zpracovatel nepředává Údaje mimo Evropský hospodářský prostor jinak než k dalším zpracovatelům uvedeným v čl. 7 a při splnění podmínek kapitoly V GDPR (zejména rozhodnutí o odpovídající ochraně nebo standardní smluvní doložky).</Cl>
            </Section>

            <Section n={11} title="Odpovědnost a závěrečná ustanovení">
                <Cl n="11.1">Odpovědnost stran za újmu způsobenou porušením GDPR se řídí čl. 82 GDPR a obecnými předpisy. Tato smlouva ji nevylučuje ani neomezuje.</Cl>
                <Cl n="11.2">Smlouva se uzavírá spolu s <Link href="/obchodni-podminky" className="font-semibold text-indigo-700 underline">Obchodními podmínkami</Link> okamžikem registrace Správce a trvá po dobu trvání smlouvy o užívání Služby a po dobu uchování Údajů podle čl. 9. V případě rozporu s Obchodními podmínkami má přednost tato smlouva v otázkách zpracování osobních údajů.</Cl>
            </Section>
        </LegalPage>
    );
}
