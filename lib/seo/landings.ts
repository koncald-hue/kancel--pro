// Vstupní stránky na konkrétní hledané výrazy (software pro advokáty, evidence spisů, výkaz práce…).
// Každá má vlastní titulek, popis, text a časté otázky (FAQ i ve strukturovaných datech). Text popisuje jen to, co aplikace opravdu umí.

export type LandingSection = { h: string; p: string[]; points?: string[] };
export type Landing = {
    slug: string;
    title: string; // <title>, do 60 znaků
    description: string; // meta description, do 160 znaků
    kicker: string;
    h1: string;
    intro: string;
    sections: LandingSection[];
    faq: { q: string; a: string }[];
    feature?: string; // kotva na /funkce
    guides: string[]; // související návody (slugy)
};

export const LANDINGS: Landing[] = [
    {
        slug: 'software-pro-advokaty',
        title: 'Software pro advokáty | Kancelář Pro',
        description: 'Spisy, lhůty z datových schránek, e-mail, výkaz práce, faktury a klientský portál v jedné aplikaci pro advokáty. 14 dní zdarma, bez karty.',
        kicker: 'Software pro advokáty',
        h1: 'Software pro advokáty, který šetří čas místo toho, aby ho bral',
        intro: 'Kancelář Pro spojuje to, co advokát jinak dělá v pěti programech: spisy, lhůty, datové schránky, e-mail, výkaz práce, fakturaci a komunikaci s klientem. Běží v prohlížeči i v telefonu, nic se neinstaluje a začít můžete hned.',
        sections: [
            {
                h: 'Co od programu pro advokáta čekat',
                p: ['Dobrý advokátní software nemá být jen elektronický šanon. Má hlídat lhůty, aby žádná neutekla, ukládat poštu tam, kde je spis, a z odvedené práce bez přepisování udělat fakturu. Kancelář Pro je postavená přesně kolem toho, jak den advokáta skutečně vypadá.'],
                points: ['Spisy s chronologií, soubory, účastníky a poznámkami', 'Lhůty počítané podle § 57 OSŘ včetně svátků a víkendů', 'Datové schránky a e-mail přímo ve spisu', 'Výkaz práce, který se navrhne sám z toho, co jste dělali', 'Faktury, párování plateb z banky a podklady pro účetní'],
            },
            {
                h: 'Pro samostatné advokáty i kanceláře',
                p: ['Samostatný advokát má všechno na jednom místě a nemusí nic nastavovat. Kancelář s kolegy a koncipienty sdílí spisy, rozděluje úkoly a vidí, kdo na čem pracuje. Každý přitom vidí jen spisy, které mu byly svěřeny, a to hlídá přímo databáze, ne jen rozhraní.'],
            },
            {
                h: 'Mlčenlivost na prvním místě',
                p: ['Komunikace s klientem a chat kanceláře jsou šifrované end-to-end, takže je provozovatel nepřečte. Přihlášení chrání dvoufázové ověření a otevření i změny spisu se zapisují do auditního záznamu. Na stránce Zabezpečení přesně popisujeme, co je chráněné jak, bez marketingového zjednodušování.'],
            },
            {
                h: 'Přechod za jedno odpoledne',
                p: ['Klienty, spisy, lhůty i výkazy naimportujete z Excelu nebo z exportu jiného programu. Po registraci máte navíc ukázkový spis, na kterém si vše vyzkoušíte, aniž byste museli zakládat vlastní data.'],
            },
        ],
        faq: [
            { q: 'Musím něco instalovat?', a: 'Ne. Kancelář Pro běží v prohlížeči na počítači i v telefonu. Na telefon si ji můžete přidat jako aplikaci na plochu.' },
            { q: 'Kolik to stojí?', a: 'Jedna cena se všemi funkcemi, měsíčně, na půl roku nebo na rok. Prvních 14 dní je zdarma a bez zadání karty. Aktuální ceny jsou v ceníku.' },
            { q: 'Je to vhodné pro kancelář s více advokáty?', a: 'Ano. Kancelář může mít více členů, sdílené spisy, role, úkoly v týmu a šifrovaný chat. Kontrola střetu zájmů prochází celou kancelář.' },
            { q: 'Kde jsou uložená data?', a: 'V databázi a úložišti u zpracovatelů uvedených na stránce Zabezpečení. Citlivá komunikace s klientem je šifrovaná end-to-end, takže ji provozovatel přečíst nemůže.' },
        ],
        guides: ['jak-vybrat-software-pro-advokatni-kancelar', 'pocitani-procesnich-lhut', 'mlcenlivost-advokata-a-cloud'],
    },
    {
        slug: 'advokatni-software',
        title: 'Advokátní software: na co se dívat při výběru | Kancelář Pro',
        description: 'Jak vybrat advokátní software: lhůty, datové schránky, výkazy, fakturace, zabezpečení a přechod dat. Srovnejte s Kanceláří Pro, 14 dní zdarma.',
        kicker: 'Advokátní software',
        h1: 'Advokátní software: podle čeho vybírat a co umí Kancelář Pro',
        intro: 'Program pro advokátní kancelář si vybíráte na roky. Přechod později bolí, takže stojí za to se předem podívat na pár věcí, které rozhodují víc než seznam funkcí na webu.',
        sections: [
            {
                h: 'Pět otázek, které si položte',
                p: ['Než se rozhodnete, vyzkoušejte program na několika vlastních spisech a odpovězte si na tyto otázky:'],
                points: ['Spočítá lhůtu přímo z doručeného rozhodnutí, nebo ji musím opisovat ručně?', 'Je datová schránka a e-mail ve spisu, nebo přepínám mezi programy?', 'Kolik práce mi dá výkaz a faktura na konci měsíce?', 'Co přesně je šifrované a kdo k datům může?', 'Jak dostanu data dovnitř a jak je případně dostanu ven?'],
            },
            {
                h: 'Jak na ně odpovídá Kancelář Pro',
                p: ['U doručeného rozhodnutí Kancelář najde poučení o lhůtě, spočítá konec lhůty včetně posunu na pracovní den a ukáže větu, ze které vycházela. Uloží se až po vašem potvrzení. Datové zprávy i e-maily se ukládají do spisu jedním kliknutím. Výkaz práce se navrhne sám z toho, co jste během dne dělali, a z výkazu je jedním krokem faktura.', 'Data dostanete kdykoli ven v otevřených formátech: export spisů, klientů a faktur, podklady pro účetní včetně ISDOC.'],
            },
            {
                h: 'Krabicový program, nebo aplikace v prohlížeči?',
                p: ['Instalovaný program na jednom počítači znamená zálohy, aktualizace a problém, když potřebujete spis z domova nebo od soudu. Aplikace v prohlížeči je dostupná odkudkoli, aktualizuje se sama a zálohy řeší provozovatel. Rozhodující je pak zabezpečení: dvoufázové přihlášení, přístupová práva v databázi a šifrování citlivé komunikace.'],
            },
        ],
        faq: [
            { q: 'Můžu advokátní software vyzkoušet zdarma?', a: 'Kancelář Pro ano, 14 dní se všemi funkcemi, bez karty. Po registraci dostanete ukázkový spis s klientem, lhůtami a fakturou.' },
            { q: 'Přenesu data ze stávajícího programu?', a: 'Klienty, spisy, lhůty a výkazy naimportujete z Excelu nebo CSV exportu. Import ukáže náhled a nic se neuloží bez potvrzení.' },
            { q: 'Funguje to i na telefonu?', a: 'Ano, celé rozhraní je přizpůsobené telefonu. Lhůty si navíc můžete nechat i offline v zařízení.' },
        ],
        guides: ['jak-vybrat-software-pro-advokatni-kancelar', 'prechod-na-novy-advokatni-software'],
    },
    {
        slug: 'evidence-spisu',
        title: 'Evidence spisů advokáta online | Kancelář Pro',
        description: 'Elektronická evidence spisů pro advokáty: chronologie, soubory, účastníci, lhůty a sdílení s kolegy. Bez instalace, 14 dní zdarma.',
        kicker: 'Evidence spisů',
        h1: 'Evidence spisů, ve které najdete všechno k věci na jednom místě',
        intro: 'Spis v Kanceláři Pro není jen složka se soubory. Je to celá věc: účastníci, lhůty, datové zprávy, e-maily, poznámky, odvedená práce i faktury, seřazené v jedné chronologii.',
        sections: [
            {
                h: 'Co ve spisu najdete',
                p: ['Každý spis má přehled, chronologii a karty pro soubory, lhůty, výkazy a finance.'],
                points: ['Klient, protistrana a další účastníci s kontakty', 'Datové zprávy a e-maily uložené přímo do spisu', 'Soubory s verzemi', 'Lhůty a jednání v kalendáři', 'Odvedená práce, faktury a rentabilita věci', 'Soukromá stránka pro klienta'],
            },
            {
                h: 'Hledání napříč spisy',
                p: ['Hledání projde celou kancelář: věci, klienty, kontakty, poznámky, soubory, lhůty, výkazy i faktury. Když si vzpomenete jen na jméno protistrany, spis najdete.'],
            },
            {
                h: 'Předání a archivace',
                p: ['Hotový spis uzavřete a archivujete. Pro soud, úřad nebo kolegu připravíte souhrn spisu s očíslovanými přílohami. Auditní záznam ukazuje, kdo spis otevřel a co v něm změnil.'],
            },
        ],
        faq: [
            { q: 'Musí advokát vést evidenci spisů?', a: 'Advokát musí podle stavovských předpisů vést o každé věci spisovou dokumentaci a uchovávat ji. Forma je na něm; elektronická evidence je přípustná, pokud je zajištěná její ochrana a mlčenlivost.' },
            { q: 'Můžu spis sdílet s kolegou?', a: 'Ano, jednotlivý spis nasdílíte konkrétnímu kolegovi. Ostatní spisy nevidí, což hlídá přímo databáze.' },
            { q: 'Jak dlouho se spisy uchovávají?', a: 'Uzavřené spisy zůstávají v archivu, dokud je sami nesmažete. Data si můžete kdykoli exportovat.' },
        ],
        feature: 'datovky',
        guides: ['pocitani-procesnich-lhut', 'gdpr-v-advokatni-kancelari'],
    },
    {
        slug: 'vykaz-prace-advokata',
        title: 'Výkaz práce advokáta, který se napíše sám | Kancelář Pro',
        description: 'Výkaz práce pro advokáty: aplikace navrhne časové záznamy podle přečtených datovek, e-mailů a dokumentů. Vy jen potvrdíte a vyfakturujete.',
        kicker: 'Výkaz práce',
        h1: 'Výkaz práce, který se večer napíše sám',
        intro: 'Většina advokátů nevyfakturuje část odvedené práce jen proto, že ji nestihne zapsat. Kancelář Pro si všímá, na čem jste pracovali, a večer vám výkaz navrhne po spisech.',
        sections: [
            {
                h: 'Jak to funguje',
                p: ['Přečtená datová zpráva, odeslaný e-mail, připravený dokument, zpráva klientovi: to všechno je práce na konkrétním spisu. Kancelář z těchto stop sestaví návrh výkazu. Čas upravíte, popis doplníte a jedním kliknutím potvrdíte. Bez potvrzení se nic nezapíše.'],
                points: ['Stopky u spisu pro práci, kterou aplikace nevidí (jednání, telefonáty)', 'Zaokrouhlení podle vaší praxe, například na 6 nebo 15 minut', 'Hodinová sazba klienta se předvyplní sama', 'Přehled nevyfakturované práce'],
            },
            {
                h: 'Z výkazu rovnou faktura',
                p: ['Potvrzené záznamy převedete do vyúčtování. Klient vidí položky s popisem a časem, vy máte fakturu s QR platbou za pár vteřin. U mimosmluvní odměny pomůže kalkulačka podle advokátního tarifu.'],
            },
            {
                h: 'Rentabilita spisů',
                p: ['Když víte, kolik času jste na věci strávili a kolik jste vyfakturovali, uvidíte, které spisy a klienti se vyplácejí. Přehled to ukazuje bez tabulek v Excelu.'],
            },
        ],
        faq: [
            { q: 'Zapíše se něco bez mého vědomí?', a: 'Ne. Návrhy výkazu jsou jen návrhy; do výkazu se dostanou až po vašem potvrzení.' },
            { q: 'Můžu účtovat podle advokátního tarifu?', a: 'Ano. Kromě časové odměny je v aplikaci kalkulačka mimosmluvní odměny podle vyhlášky č. 177/1996 Sb.' },
            { q: 'Funguje výkaz i pro koncipienty?', a: 'Ano, každý člen kanceláře má svůj výkaz a vedoucí vidí souhrn za spisy, které spravuje.' },
        ],
        feature: 'vykaz',
        guides: ['advokatni-tarif-mimosmluvni-odmena', 'vykaz-prace-a-vyuctovani-klientovi'],
    },
    {
        slug: 'datova-schranka-pro-advokaty',
        title: 'Datová schránka pro advokáty se lhůtami | Kancelář Pro',
        description: 'Datové zprávy přímo ve spisu. Z doručeného rozhodnutí Kancelář Pro spočítá lhůtu a navrhne ji do kalendáře. Pro advokáty, 14 dní zdarma.',
        kicker: 'Datové schránky',
        h1: 'Datová schránka advokáta propojená se spisy a lhůtami',
        intro: 'Datová schránka je pro advokáta hlavní kanál, kterým chodí rozhodnutí, výzvy a usnesení. Kancelář Pro ji propojí se spisy: zprávu uložíte jedním kliknutím a z rozhodnutí rovnou vznikne lhůta.',
        sections: [
            {
                h: 'Z rozhodnutí lhůta v kalendáři',
                p: ['U doručeného rozhodnutí Kancelář přečte poučení, najde délku lhůty a spočítá její konec od okamžiku doručení. Konec posune na nejbližší pracovní den, pokud vychází na sobotu, neděli nebo svátek. Ukáže přesnou větu, ze které vycházela, a lhůtu uloží až po vašem potvrzení.'],
                points: ['Doručení přihlášením nebo fikcí po 10 dnech od dodání', 'Svátky a víkendy podle zákona č. 245/2000 Sb.', 'Upozornění e-mailem, v telefonu i v kalendáři Google nebo Outlook'],
            },
            {
                h: 'Zpráva i příloha do spisu',
                p: ['Kancelář pozná spisovou značku nebo účastníka a nabídne, do kterého spisu zprávu uložit. Příloha se uloží mezi soubory spisu a zpráva do chronologie. Odpovídat můžete přímo z aplikace.'],
            },
            {
                h: 'Přihlášení a bezpečnost',
                p: ['K datové schránce se přihlašujete svým heslem nebo Mobilním klíčem eGovernmentu. Přístupové údaje jsou uložené zašifrované vaším hlavním klíčem, server je v čitelné podobě neukládá.'],
            },
        ],
        faq: [
            { q: 'Kdy je zpráva v datové schránce doručená?', a: 'Okamžikem, kdy se do schránky přihlásí oprávněná osoba. Pokud se nikdo nepřihlásí, považuje se za doručenou uplynutím 10. dne od dodání (fikce doručení).' },
            { q: 'Přepíše Kancelář lhůtu sama?', a: 'Ne. Lhůtu vždy navrhne s odkazem na text rozhodnutí a uloží ji až po vašem potvrzení.' },
            { q: 'Funguje to s Mobilním klíčem?', a: 'Ano, přihlásit se lze heslem i Mobilním klíčem eGovernmentu.' },
        ],
        feature: 'datovky',
        guides: ['datova-schranka-advokata', 'pocitani-procesnich-lhut'],
    },
    {
        slug: 'fakturace-pro-advokaty',
        title: 'Fakturace pro advokáty a párování plateb | Kancelář Pro',
        description: 'Faktury z výkazu práce, QR platby, automatické párování plateb z Fio a výpisů, upomínky s úrokem z prodlení a podklady pro účetní (ISDOC).',
        kicker: 'Fakturace',
        h1: 'Fakturace pro advokáty: od výkazu k zaplacené faktuře',
        intro: 'Konec měsíce nemusí znamenat večer nad Excelem. V Kanceláři Pro vznikne faktura z potvrzeného výkazu, platba se sama spáruje a účetní dostane podklady v jednom souboru.',
        sections: [
            {
                h: 'Faktura za pár vteřin',
                p: ['Vyberete spis nebo klienta, Kancelář převezme nevyfakturovanou práci a výdaje a připraví fakturu. Plátce i neplátce DPH, zálohové faktury i opakovaná vyúčtování paušálních klientů. Na faktuře je QR kód pro platbu.'],
            },
            {
                h: 'Platby se spárují samy',
                p: ['Účet u Fio banky propojíte přes API a platby se načítají automaticky. U ostatních bank nahrajete výpis. Platba se spáruje podle variabilního symbolu; co nesedí, Kancelář nabídne ke schválení.'],
                points: ['Přehled pohledávek po splatnosti', 'Upomínka s vyčíslením úroku z prodlení', 'Rentabilita spisů a klientů'],
            },
            {
                h: 'Podklady pro účetní',
                p: ['Za zvolené období vyexportujete přehled vydaných faktur, plateb a DPH po sazbách. Faktury jdou i ve formátu ISDOC, který načte většina účetních programů, a připravený je export pro Pohodu a Money S3.'],
            },
        ],
        faq: [
            { q: 'Je Kancelář Pro účetní program?', a: 'Ne. Vystavuje faktury, eviduje platby a připravuje podklady pro účetní. Účetnictví samotné vede vaše účetní ve svém programu.' },
            { q: 'Které banky jsou podporované?', a: 'Fio banka automaticky přes API, ostatní banky nahráním výpisu (CSV nebo CAMT).' },
            { q: 'Umí to vyúčtování podle advokátního tarifu?', a: 'Ano, kalkulačka spočítá mimosmluvní odměnu podle vyhlášky č. 177/1996 Sb. včetně paušální náhrady a DPH.' },
        ],
        feature: 'penize',
        guides: ['advokatni-tarif-mimosmluvni-odmena', 'vykaz-prace-a-vyuctovani-klientovi'],
    },
    {
        slug: 'hlidani-lhut-advokat',
        title: 'Hlídání procesních lhůt pro advokáty | Kancelář Pro',
        description: 'Lhůty podle § 57 OSŘ s posunem na pracovní den, z datových schránek rovnou do kalendáře. Upozornění v telefonu, e-mailem i offline.',
        kicker: 'Lhůty',
        h1: 'Hlídání lhůt, které nespoléhá na paměť',
        intro: 'Zmeškaná lhůta je největší profesní riziko advokáta. Kancelář Pro lhůty počítá, připomíná a ukazuje tak, aby žádná nezapadla, ani když jste u soudu nebo na dovolené.',
        sections: [
            {
                h: 'Správný výpočet',
                p: ['Lhůty se počítají podle § 57 občanského soudního řádu, stejně jako podle trestního řádu, soudního řádu správního a správního řádu: den události se nezapočítává, lhůty podle týdnů, měsíců a let končí dnem shodným s dnem události a konec připadající na sobotu, neděli nebo svátek se posouvá na nejbližší pracovní den.'],
            },
            {
                h: 'Upozornění tam, kde jste',
                p: ['Každé ráno vidíte, co vás čeká, a lhůty se zobrazují v kalendáři spolu s jednáními. Upozornění přijde do telefonu i e-mailem a lhůty se mohou propsat do kalendáře Google nebo Outlook (jen název a datum, nikdy obsah spisu).'],
                points: ['Lhůty dostupné i offline v telefonu', 'Zástup kolegou při dovolené nebo nemoci', 'Radar protistrany upozorní na insolvenci a navrhne lhůtu pro přihlášku'],
            },
        ],
        faq: [
            { q: 'Počítá Kancelář se svátky?', a: 'Ano, se všemi státními i ostatními svátky podle zákona č. 245/2000 Sb., včetně Velkého pátku.' },
            { q: 'Co když je lhůta určená v hodinách?', a: 'Lhůty v hodinách a speciální lhůty zadáte ručně. Výpočet je pomůckou ke kontrole, rozhodnutí zůstává na advokátovi.' },
        ],
        feature: 'datovky',
        guides: ['pocitani-procesnich-lhut', 'datova-schranka-advokata'],
    },
    {
        slug: 'evidence-uschov',
        title: 'Evidence úschov pro advokáty | Kancelář Pro',
        description: 'Evidence advokátních úschov: kniha pohybů, zůstatky, kontrola proti bance, upozornění na dlouho ležící úschovy a výpis pro klienta.',
        kicker: 'Úschovy',
        h1: 'Evidence úschov s přehledem o každé koruně',
        intro: 'Úschova peněz klienta je oblast, kde advokát nesmí udělat chybu. Kancelář Pro vede ke každé úschově knihu pohybů, hlídá zůstatek a porovnává ho s bankou. Peníze přitom nedrží, jen je eviduje.',
        sections: [
            {
                h: 'Kniha pohybů ke každé úschově',
                p: ['U úschovy zapíšete klienta, spis, účet úschovy a účel s podmínkami výdeje. Každý příjem a výdej je pohyb, který se jen přidává a nejde přepsat ani smazat. Kancelář nepustí výdej nad zůstatek.'],
                points: ['Zůstatek podle evidence a kontrola proti výpisu z banky', 'Upozornění na úschovy, které leží dlouho', 'Výpis pohybů pro klienta nebo kontrolu'],
            },
            {
                h: 'Stavovské povinnosti zůstávají na vás',
                p: ['Úschovy upravuje zákon o advokacii a usnesení představenstva ČAK č. 7/2004 Věstníku. Hlášení do Elektronické knihy úschov ČAK podáváte sami; Kancelář vám k tomu připraví přehledné údaje.'],
            },
        ],
        faq: [
            { q: 'Nahrazuje to Elektronickou knihu úschov ČAK?', a: 'Ne. Hlášení do EKÚ zůstává vaší povinností. Kancelář Pro vede vnitřní evidenci pohybů a zůstatků.' },
            { q: 'Kdo úschovy vidí?', a: 'Jen vlastník záznamu. Pohyby nejdou přepsat ani smazat.' },
        ],
        guides: ['advokatni-uschova-povinnosti', 'aml-identifikace-klienta-advokat'],
    },
    {
        slug: 'aml-identifikace-klienta',
        title: 'AML identifikace klienta pro advokáty | Kancelář Pro',
        description: 'Identifikace a kontrola klienta podle zákona č. 253/2008 Sb. přímo u spisu: kontrolní seznam, posouzení rizika, termín nového posouzení.',
        kicker: 'AML',
        h1: 'AML identifikace klienta přímo u spisu',
        intro: 'U převodů nemovitostí, úschov nebo zakládání společností je advokát povinnou osobou podle AML zákona. Kancelář Pro vede identifikaci a kontrolu klienta tam, kde máte spis, a připomene, kdy je čas na nové posouzení.',
        sections: [
            {
                h: 'Co Kancelář pohlídá',
                p: ['U klienta zapíšete údaje o identifikaci, zdroj prostředků a posouzení rizika. Kancelář ukáže, co ještě chybí, a navrhne termín nového posouzení, u vyššího rizika dřív. Rozhodnutí, zda a jak identifikovat, zůstává na advokátovi.'],
                points: ['Kontrolní seznam chybějících údajů', 'Identifikace klienta i na dálku přes klientskou stránku', 'Kontrola protistrany v insolvenčním rejstříku a ARES'],
            },
        ],
        faq: [
            { q: 'Kdy je advokát povinnou osobou?', a: 'Jen u vyjmenovaných činností, zejména při převodech nemovitostí a obchodních společností, správě majetku klienta, úschovách a zakládání nebo řízení společností. Mimo ně AML povinnosti nemá.' },
            { q: 'Jak dlouho se údaje uchovávají?', a: 'AML zákon ukládá uchovávat údaje z identifikace 10 let od ukončení obchodního vztahu nebo uskutečnění obchodu.' },
        ],
        feature: 'klient',
        guides: ['aml-identifikace-klienta-advokat', 'advokatni-uschova-povinnosti'],
    },
    {
        slug: 'kontrola-stretu-zajmu',
        title: 'Kontrola střetu zájmů v advokátní kanceláři | Kancelář Pro',
        description: 'Než převezmete věc, Kancelář Pro zkontroluje klienta i protistranu proti všem spisům kanceláře, i v jiném pádě jména. Bez prozrazení cizích dat.',
        kicker: 'Střet zájmů',
        h1: 'Kontrola střetu zájmů dřív, než věc převezmete',
        intro: 'Advokát musí odmítnout věc, kde by šlo o střet zájmů. V kanceláři s více advokáty se na to snadno zapomene. Kancelář Pro to kontroluje automaticky u každého nového klienta i protistrany.',
        sections: [
            {
                h: 'Najde i „Nováková“ a „Novákovi“',
                p: ['Kontrola porovná jméno, IČO a e-mail s klienty, protistranami a účastníky všech spisů. Pozná stejnou osobu i v jiném pádě nebo s přehozeným jménem a příjmením a rozliší, zda dotčená osoba byla klientem, nebo protistranou.'],
            },
            {
                h: 'Napříč kanceláří, ale bez prozrazení',
                p: ['Kontrola projde i spisy kolegů. Když najde shodu ve spisu, který nevidíte, řekne jen, že shoda existuje, ne čí je spis a o co jde. Mlčenlivost uvnitř kanceláře tak zůstane zachovaná.'],
            },
        ],
        faq: [
            { q: 'Posílají se jména někam ven?', a: 'Ne. Kontrola ve vašich datech probíhá v prohlížeči, jména se nikam neodesílají, ani do AI.' },
            { q: 'Co říká zákon?', a: 'Povinnost odmítnout poskytnutí právních služeb při střetu zájmů upravuje § 19 zákona o advokacii a etický kodex advokáta.' },
        ],
        guides: ['stret-zajmu-advokat', 'jak-vybrat-software-pro-advokatni-kancelar'],
    },
    {
        slug: 'klientsky-portal-pro-advokaty',
        title: 'Klientský portál pro advokáty | Kancelář Pro',
        description: 'Soukromá stránka ke každému spisu: klient nahraje podklady z telefonu, napíše zprávu a podepíše dokument. Bez registrace. 14 dní zdarma.',
        kicker: 'Klientský portál pro advokáty',
        h1: 'Klientský portál, přes který klient pošle podklady a nemusí nic instalovat',
        intro: 'Klient dostane odkaz na soukromou stránku svého spisu. Vidí, v jakém je stavu, nahraje dokumenty z telefonu, napíše zprávu a podepíše dokument. Vy nemusíte přeposílat přílohy z e-mailů a máte všechno rovnou ve spisu.',
        sections: [
            {
                h: 'Co klient v portálu udělá',
                p: ['Portál je záměrně jednoduchý, aby ho zvládl i klient, který nikdy nepoužil žádnou aplikaci. Vstupuje odkazem bez hesla a bez registrace. Odkaz můžete volitelně zabezpečit i kódem, který klientovi přijde na e-mail.'],
                points: ['Podívá se na stav spisu a na to, co od něj advokát potřebuje', 'Nahraje fotky a dokumenty přímo z telefonu', 'Napíše zprávu a odpoví na dotaz advokáta', 'Podepíše dokument (po ověření kódem nebo osobním ověřením)']
            },
            {
                h: 'Mlčenlivost bez kompromisů',
                p: ['Zprávy mezi advokátem a klientem jsou šifrované end-to-end, takže je provozovatel služby nepřečte. Odkaz na portál jde kdykoli zrušit, má omezenou platnost a každý klient vidí jen svůj spis. Na stránce Zabezpečení přesně popisujeme, co je šifrované a co ne.'],
            },
            {
                h: 'Méně e-mailů a přeposílání',
                p: ['Dokumenty, které klient nahraje, se uloží přímo do správného spisu. Zpráva od klienta se objeví u spisu a v přehledu dne, takže nic neutone ve schránce. Při prvním kontaktu může klient vyplnit i poptávku a identifikační údaje pro AML.'],
            },
        ],
        faq: [
            { q: 'Musí se klient registrovat?', a: 'Ne. Přístup mu dáte odkazem a volitelně ho při vstupu ověří kód zaslaný na jeho e-mail.' },
            { q: 'Co když klient odkaz ztratí?', a: 'Odkaz v kanceláři zrušíte a vytvoříte nový. Zrušený odkaz už nefunguje.' },
            { q: 'Je komunikace v portálu šifrovaná?', a: 'Zprávy jsou šifrované end-to-end. Soubory a další údaje jsou chráněné přihlášením, přístupovými pravidly v databázi a šifrovaným přenosem. Podrobnosti jsou na stránce Zabezpečení.' },
            { q: 'Je podpis v portálu kvalifikovaný elektronický podpis?', a: 'Ne. Jde o podpis dokumentu po ověření kódem a zapsání do záznamu spisu. Kdy je takový podpis pro konkrétní dokument dostačující, posuzuje advokát.' },
        ],
        feature: 'klient',
        guides: ['mlcenlivost-advokata-a-cloud', 'jak-vybrat-software-pro-advokatni-kancelar'],
    },
    {
        slug: 'radar-protistrany-insolvence',
        title: 'Hlídání insolvence protistrany a klienta | Kancelář Pro',
        description: 'Kancelář Pro hlídá firmy a osoby ve vašich spisech v insolvenčním rejstříku a v ARES a upozorní vás, když dlužník vstoupí do insolvence.',
        kicker: 'Radar protistrany',
        h1: 'Hlídání insolvence a změn u protistrany, aby vás nic nepřekvapilo',
        intro: 'Dlužník vstoupí do insolvence a lhůta pro přihlášku pohledávky běží, aniž by vás kdo upozornil. Radar protistrany hlídá firmy a osoby z vašich spisů a řekne vám to dřív, než se to dozvíte náhodou.',
        sections: [
            {
                h: 'Co radar hlídá',
                p: ['Do radaru se dostanou protistrany, dlužníci i klienti z vašich spisů. Kancelář je pravidelně kontroluje a při změně vás upozorní přímo u spisu.'],
                points: ['Vstup do insolvenčního řízení', 'Změny u firem v ARES, například likvidace', 'Navržená lhůta, když z události nějaká plyne', 'Přehled všeho, co radar sleduje, na jednom místě']
            },
            {
                h: 'Proč na tom záleží',
                p: ['U pohledávek za dlužníkem v insolvenci rozhodují lhůty a pořadí kroků. Pozdní reakce může znamenat ztracenou možnost pohledávku uplatnit. Automatická kontrola nahrazuje ruční projíždění rejstříku u každého spisu.'],
            },
            {
                h: 'Kontrola je pomůcka, ne náhrada úsudku',
                p: ['Radar vás upozorní a navrhne lhůtu. Konečné posouzení, zda a jak lhůta běží, zůstává na advokátovi.'],
            },
        ],
        faq: [
            { q: 'Které rejstříky radar používá?', a: 'Insolvenční rejstřík a veřejný rejstřík ARES. Zdroje jsou veřejné.' },
            { q: 'Musím zadávat každého dlužníka zvlášť?', a: 'Ne. Radar vychází ze stran, které máte ve spisech, a hlídá je sám.' },
            { q: 'Platí se radar zvlášť?', a: 'Aktuální ceny a obsah balíčku jsou v ceníku.' },
        ],
        feature: 'radar',
        guides: ['pocitani-procesnich-lhut', 'stret-zajmu-advokat'],
    },
    {
        slug: 'import-dat-do-advokatniho-softwaru',
        title: 'Import dat do advokátního softwaru | Kancelář Pro',
        description: 'Klienty, spisy, lhůty a výkazy práce naimportujete z Excelu nebo exportu jiného programu. Přechod na Kancelář Pro bez přepisování. 14 dní zdarma.',
        kicker: 'Přechod z jiného programu',
        h1: 'Přechod na nový advokátní software bez přepisování dat',
        intro: 'Největší překážkou změny programu bývá strach z přepisování let práce. Kancelář Pro umí naimportovat klienty, spisy, lhůty i odpracovaný čas z Excelu, CSV nebo exportu vašeho dosavadního softwaru.',
        sections: [
            {
                h: 'Co lze naimportovat',
                p: ['Nahrajete soubor XLSX, CSV nebo vCard, případně vložíte buňky zkopírované z Excelu. Sešit s více listy se naimportuje najednou a sloupce se přiřadí podle běžných názvů.'],
                points: ['Klienti a kontakty', 'Spisy se základními údaji', 'Lhůty a termíny', 'Odpracovaný čas', 'Kontakty z telefonu nebo e-mailu ve formátu vCard']
            },
            {
                h: 'Vyzkoušejte si to bez rizika',
                p: ['Prvních 14 dní je zdarma a bez zadání karty, takže import i celý provoz otestujete na skutečných datech. Nejdřív doporučujeme naimportovat menší vzorek a zkontrolovat ho.'],
            },
            {
                h: 'Data zůstávají vaše',
                p: ['Všechna data si můžete exportovat do tabulek, například jako zálohu nebo při přechodu jinam. Po skončení předplatného zůstanou data uložená a ke čtení.'],
            },
        ],
        faq: [
            { q: 'Z jakých souborů jde importovat?', a: 'Z tabulek XLSX a CSV, z kontaktů ve formátu vCard a ze zkopírovaných buněk z Excelu. Z jiného programu jde přenést to, co umí vyexportovat do některého z těchto formátů.' },
            { q: 'Přijdu o data při přechodu?', a: 'Import data kopíruje, původní program zůstává beze změny. Doporučujeme nejdřív vyzkoušet menší vzorek.' },
            { q: 'Dostanu svá data zpátky?', a: 'Ano. Všechna data si můžete exportovat do tabulek.' },
        ],
        guides: ['prechod-na-novy-advokatni-software', 'jak-vybrat-software-pro-advokatni-kancelar'],
    },
];

export const landingBySlug = (slug: string) => LANDINGS.find((l) => l.slug === slug);
