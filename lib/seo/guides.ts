// Návody a články pro advokáty (sekce /navody). Praktické texty, které lidé hledají; každý odkazuje na související funkci.
// Právní údaje ověřené k 22. 11. 2026. Při změně předpisu upravte text i datum `updated`.

export type GuideSection = { h: string; p: string[]; points?: string[] };
export type Guide = {
    slug: string;
    title: string; // nadpis i <title>
    description: string; // meta description, do 160 znaků
    category: 'Lhůty a doručování' | 'Odměna a fakturace' | 'Stavovské povinnosti' | 'Ochrana dat' | 'Vedení kanceláře';
    published: string; // ISO datum
    updated: string;
    minutes: number;
    lead: string;
    sections: GuideSection[];
    takeaways: string[];
    landing: string; // související vstupní stránka
};

export const GUIDES: Guide[] = [
    {
        slug: 'pocitani-procesnich-lhut',
        title: 'Jak počítat procesní lhůty: pravidla § 57 OSŘ s příklady',
        description: 'Počítání procesních lhůt podle § 57 občanského soudního řádu: den události, lhůty v měsících, víkendy a svátky, zachování lhůty a doručení do datové schránky.',
        category: 'Lhůty a doručování',
        published: '2026-11-22',
        updated: '2026-11-22',
        minutes: 6,
        lead: 'Počítání lhůt vypadá jednoduše, dokud nepřijde doručení fikcí v pátek, lhůta v měsících z 31. ledna nebo konec lhůty na Velký pátek. Shrnujeme pravidla, která platí v civilním řízení, a ukazujeme je na příkladech.',
        sections: [
            {
                h: 'Základní pravidla podle § 57 OSŘ',
                p: ['Občanský soudní řád upravuje počítání procesních lhůt v § 57. Velmi podobná pravidla obsahuje § 60 trestního řádu, § 40 soudního řádu správního i § 40 správního řádu, takže kdo zvládne jedno, zvládne i ostatní.'],
                points: [
                    'Do lhůty se nezapočítává den, kdy došlo ke skutečnosti, od které se lhůta počítá (typicky den doručení).',
                    'Lhůta určená podle týdnů, měsíců nebo let končí dnem, který se pojmenováním nebo číslem shoduje se dnem, kdy ke skutečnosti došlo. Pokud takový den v posledním měsíci není, končí lhůta posledním dnem měsíce.',
                    'Připadne-li konec lhůty na sobotu, neděli nebo svátek, je posledním dnem lhůty nejbližší následující pracovní den.',
                    'Lhůta je zachována, je-li v poslední den učiněn úkon u soudu nebo podání odevzdáno orgánu, který má povinnost ho doručit (například poště).',
                ],
            },
            {
                h: 'Příklad 1: odvolání proti rozsudku doručenému fikcí',
                p: [
                    'Rozsudek je dodán do datové schránky v pondělí 2. 3. 2026 a nikdo se do schránky nepřihlásí. Doručení nastane fikcí uplynutím desátého dne od dodání, tedy ve čtvrtek 12. 3. 2026.',
                    'Odvolací lhůta 15 dnů (§ 204 OSŘ) začíná běžet dnem následujícím, tedy 13. 3. 2026, a končí v pátek 27. 3. 2026. Kdyby konec připadl na víkend, posunul by se na pondělí.',
                ],
            },
            {
                h: 'Příklad 2: lhůta v měsících',
                p: [
                    'Usnesení je doručeno 31. 1. 2026 a lhůta činí jeden měsíc. Únor nemá 31. den, proto lhůta končí posledním dnem února, tedy v sobotu 28. 2. 2026. Protože jde o sobotu, posledním dnem lhůty je pondělí 2. 3. 2026.',
                    'Stejně se počítají lhůty v letech: lhůta jednoho roku od 29. 2. 2028 skončí 28. 2. 2029.',
                ],
            },
            {
                h: 'Nejčastější lhůty v praxi',
                p: ['Pro rychlou orientaci uvádíme lhůty, se kterými se advokát setkává nejčastěji. Vždy je ale rozhodující poučení v konkrétním rozhodnutí a aktuální znění předpisu.'],
                points: [
                    'Odvolání v civilním řízení: 15 dnů od doručení písemného vyhotovení (§ 204 OSŘ).',
                    'Odpor proti platebnímu rozkazu: 15 dnů od doručení (§ 174 OSŘ).',
                    'Dovolání: 2 měsíce od doručení rozhodnutí odvolacího soudu (§ 240 OSŘ).',
                    'Odvolání ve správním řízení: 15 dnů od oznámení rozhodnutí (§ 83 správního řádu).',
                    'Žaloba proti rozhodnutí správního orgánu: 2 měsíce (§ 72 s. ř. s.).',
                    'Odvolání v trestním řízení: 8 dnů (§ 248 trestního řádu); stížnost: 3 dny (§ 143 trestního řádu).',
                ],
            },
            {
                h: 'Na co si dát pozor',
                p: [
                    'Svátky se počítají podle zákona č. 245/2000 Sb. Nezapomeňte na Velký pátek a na 24. prosinec, které jsou svátkem stejně jako ostatní dny pracovního klidu.',
                    'Lhůty v hodinách (například u zadržení v trestním řízení) se počítají jinak a na pracovní den se neposouvají. Hmotněprávní lhůty, třeba promlčecí, se řídí občanským zákoníkem a podání musí soudu dojít, nestačí ho v poslední den odevzdat na poštu.',
                ],
            },
        ],
        takeaways: ['Den doručení se nepočítá.', 'Konec na víkend nebo svátek se posouvá na nejbližší pracovní den.', 'U procesních lhůt stačí podání v poslední den odevzdat poště, u hmotněprávních ne.'],
        landing: 'hlidani-lhut-advokat',
    },
    {
        slug: 'datova-schranka-advokata',
        title: 'Datová schránka advokáta: doručování, fikce a praktické tipy',
        description: 'Kdy je zpráva v datové schránce doručená, jak funguje fikce doručení, jak dlouho zprávy zůstávají ve schránce a jak si práci s datovkou zorganizovat.',
        category: 'Lhůty a doručování',
        published: '2026-11-22',
        updated: '2026-11-22',
        minutes: 5,
        lead: 'Datová schránka je pro advokáta hlavní kanál pro doručování od soudů a úřadů. Většina zmeškaných lhůt nevzniká špatným výpočtem, ale tím, že si nikdo nevšiml doručení. Proto stojí za to vědět, jak doručování přesně funguje.',
        sections: [
            {
                h: 'Advokát má datovou schránku ze zákona',
                p: ['Advokátovi zřizuje datovou schránku Ministerstvo vnitra automaticky, bez žádosti, podle zákona č. 300/2008 Sb., o elektronických úkonech a autorizované konverzi dokumentů. Soudy a úřady mu do ní doručují přednostně. Pokud má advokát také živnostenské oprávnění, může mít navíc samostatnou schránku podnikající fyzické osoby; je dobré vědět, do které schránky co chodí.'],
            },
            {
                h: 'Kdy je dokument doručený',
                p: [
                    'Dokument dodaný do datové schránky je doručen okamžikem, kdy se do schránky přihlásí osoba, která k tomu má oprávnění. Nemusí zprávu otevřít, stačí přihlášení.',
                    'Pokud se do 10 dnů od dodání nikdo nepřihlásí, považuje se dokument za doručený posledním dnem této lhůty (fikce doručení). Lhůta 10 dnů je kalendářní a den fikce se na pracovní den neposouvá. Od doručení pak teprve začíná běžet procesní lhůta.',
                ],
            },
            {
                h: 'Podání z datové schránky',
                p: ['Úkon, který advokát učiní z vlastní datové schránky, má podle § 18 zákona o elektronických úkonech stejné účinky jako podání podepsané. Nepotřebujete proto kvalifikovaný podpis u běžných podání soudu nebo úřadu, pokud předpis výslovně nevyžaduje jinou formu.'],
            },
            {
                h: 'Zprávy ze schránky mizí',
                p: ['Doručené zprávy zůstávají v datové schránce 90 dnů od doručení, potom se smažou, pokud nemáte placený Datový trezor. Rozhodnutí a podání proto ukládejte do spisu hned, včetně doručenky, která dokládá den doručení.'],
            },
            {
                h: 'Praktické tipy',
                points: [
                    'Zapněte si upozornění na nové zprávy e-mailem nebo SMS, aby vás nepřekvapila fikce během dovolené.',
                    'Pověřte přístupem koncipienta nebo asistentku a nastavte jim jen potřebná oprávnění. Jejich přihlášení také způsobí doručení.',
                    'Každou zprávu hned přiřaďte ke spisu a u rozhodnutí zapište lhůtu.',
                    'Před dovolenou určete zástupce, který bude schránku sledovat.',
                ],
                p: [],
            },
        ],
        takeaways: ['Doručení nastává přihlášením, ne otevřením zprávy.', 'Bez přihlášení nastane fikce 10. dnem od dodání.', 'Zprávy se po 90 dnech mažou, ukládejte je do spisu.'],
        landing: 'datova-schranka-pro-advokaty',
    },
    {
        slug: 'advokatni-tarif-mimosmluvni-odmena',
        title: 'Advokátní tarif: jak spočítat mimosmluvní odměnu (2026)',
        description: 'Výpočet mimosmluvní odměny advokáta podle vyhlášky č. 177/1996 Sb.: tarifní hodnota, sazba za úkon, úkony podle § 11, paušál 450 Kč a DPH. S příkladem.',
        category: 'Odměna a fakturace',
        published: '2026-11-22',
        updated: '2026-11-22',
        minutes: 6,
        lead: 'Mimosmluvní odměna podle advokátního tarifu se používá tam, kde se advokát s klientem nedohodl jinak, a hlavně při přiznávání náhrady nákladů řízení. Postup je vždy stejný: tarifní hodnota, sazba za jeden úkon, počet úkonů, paušální náhrada a DPH.',
        sections: [
            {
                h: '1. Tarifní hodnota',
                p: ['Tarifní hodnotou je podle § 8 vyhlášky č. 177/1996 Sb. hodnota věci nebo práva, o které jde, případně výše peněžitého plnění. U věcí, které nelze ocenit penězi (například rodinné nebo osobnostní věci), stanoví tarifní hodnotu pevně § 9 vyhlášky.'],
            },
            {
                h: '2. Sazba za jeden úkon (§ 7)',
                p: ['Sazba mimosmluvní odměny za jeden úkon právní služby se odvíjí od tarifní hodnoty:'],
                points: [
                    'do 500 Kč: 300 Kč',
                    'nad 500 do 1 000 Kč: 500 Kč',
                    'nad 1 000 do 5 000 Kč: 1 000 Kč',
                    'nad 5 000 do 10 000 Kč: 1 500 Kč',
                    'nad 10 000 do 200 000 Kč: 1 500 Kč a 40 Kč za každých započatých 1 000 Kč nad 10 000 Kč',
                    'nad 200 000 do 10 000 000 Kč: 9 100 Kč a 40 Kč za každých započatých 10 000 Kč nad 200 000 Kč',
                    'nad 10 000 000 Kč: 48 300 Kč a 40 Kč za každých započatých 100 000 Kč nad 10 000 000 Kč',
                ],
            },
            {
                h: '3. Úkony právní služby (§ 11)',
                p: ['Za plnou sazbu se účtují mimo jiné převzetí a příprava zastoupení, písemné podání ve věci samé, účast na jednání před soudem za každé započaté dvě hodiny, odvolání nebo sepsání listiny o právním jednání. Polovinu sazby dostanete například za jednoduchou výzvu k plnění nebo za účast u jednání, kde se jen vyhlásilo rozhodnutí.'],
            },
            {
                h: '4. Paušální náhrada a úpravy',
                p: [
                    'Ke každému úkonu náleží paušální náhrada hotových výdajů 450 Kč (§ 13 odst. 4), pokud se nedohodnete jinak.',
                    'U společných úkonů pro více osob se odměna za druhou osobu zvyšuje o 80 %, za třetí o 60 %, za čtvrtou o 40 % a za pátou a každou další o 20 % (§ 12 odst. 4). Ve výjimečně obtížných věcech lze odměnu zvýšit, v jednoduchých snížit (§ 12 odst. 1 a 2).',
                ],
            },
            {
                h: 'Příklad výpočtu',
                p: [
                    'Žaloba o zaplacení 100 000 Kč. Sazba za úkon: 1 500 Kč a 90 × 40 Kč = 5 100 Kč. Advokát učinil tři úkony: převzetí a příprava zastoupení, žaloba a účast na jednání do dvou hodin.',
                    'Odměna 3 × 5 100 Kč = 15 300 Kč, paušál 3 × 450 Kč = 1 350 Kč, celkem 16 650 Kč. U plátce DPH se přičte 21 %, tedy 3 496,50 Kč, a náklady zastoupení činí 20 146,50 Kč.',
                ],
            },
        ],
        takeaways: ['Nejprve tarifní hodnota, pak sazba podle § 7.', 'Každý úkon má nárok na paušál 450 Kč.', 'U plátce DPH přičtěte 21 % ze součtu odměny a náhrad.'],
        landing: 'fakturace-pro-advokaty',
    },
    {
        slug: 'vykaz-prace-a-vyuctovani-klientovi',
        title: 'Výkaz práce advokáta a vyúčtování klientovi: praktický návod',
        description: 'Jak vést výkaz práce, aby se nic neztratilo, jak se dohodnout s klientem na časové odměně a jak vyúčtování připravit tak, aby ho klient zaplatil bez dotazů.',
        category: 'Odměna a fakturace',
        published: '2026-11-22',
        updated: '2026-11-22',
        minutes: 5,
        lead: 'Advokáti v průzkumech opakovaně přiznávají, že nevyfakturují nemalou část odvedené práce. Nejde o neochotu klientů platit, ale o práci, kterou nikdo nezapsal. Dobrý výkaz práce je proto nejlevnější způsob, jak zvýšit příjmy.',
        sections: [
            {
                h: 'Domluvte se předem',
                p: ['Smluvní odměnu si s klientem sjednáte podle advokátního tarifu jako časovou, úkonovou, paušální nebo kombinovanou. U časové odměny výslovně uveďte hodinovou sazbu, jednotku, ve které budete práci účtovat (například 15 nebo 6 minut), zda účtujete cestovné a čas na cestě a jak často budete vyúčtovávat.'],
            },
            {
                h: 'Zapisujte hned, ne na konci měsíce',
                p: ['Záznamy psané zpětně jsou vždy kratší než skutečnost. Zapisujte práci průběžně, nejlépe pomocí stopek u spisu nebo aplikace, která navrhne záznamy sama podle toho, co jste dělali (datové zprávy, e-maily, dokumenty).'],
                points: ['Každý záznam ke konkrétnímu spisu', 'Popis srozumitelný klientovi: ne „práce na věci“, ale „příprava odvolání, rozbor znaleckého posudku“', 'Telefonáty a krátké e-maily také, sčítají se'],
            },
            {
                h: 'Vyúčtování, které klient zaplatí',
                p: ['Klient platí rychleji, když rozumí, za co platí. Přiložte k faktuře přehled úkonů s datem, popisem a časem. Fakturujte pravidelně, ideálně měsíčně, a u větších věcí si sjednejte zálohy. QR kód na faktuře zrychlí platbu a variabilní symbol umožní platbu automaticky spárovat.'],
            },
            {
                h: 'Sledujte rentabilitu',
                p: ['Porovnání odpracovaného času s vyfakturovanou částkou ukáže, které věci a klienti se vyplácejí. U paušálních klientů včas zjistíte, kdy paušál přestal odpovídat skutečné práci.'],
            },
        ],
        takeaways: ['Sazbu a jednotku času sjednejte písemně předem.', 'Zapisujte průběžně a ke spisu.', 'Popis práce pište pro klienta, ne pro sebe.'],
        landing: 'vykaz-prace-advokata',
    },
    {
        slug: 'advokatni-uschova-povinnosti',
        title: 'Advokátní úschova peněz: povinnosti advokáta krok za krokem',
        description: 'Advokátní úschova podle zákona o advokacii a usnesení ČAK č. 7/2004 Věstníku: smlouva, účet úschov, hlášení do Elektronické knihy úschov a AML identifikace.',
        category: 'Stavovské povinnosti',
        published: '2026-11-22',
        updated: '2026-11-22',
        minutes: 5,
        lead: 'Úschova peněz klienta je jedna z nejcitlivějších činností advokáta a ČAK ji v posledních letech opakovaně zpřísnila. Shrnujeme povinnosti, které musí advokát splnit, než peníze přijme, i po celou dobu úschovy.',
        sections: [
            {
                h: 'Právní rámec',
                p: ['Úschovu peněz, cenných papírů a jiného majetku klienta upravuje zákon o advokacii a podrobně usnesení představenstva ČAK č. 7/2004 Věstníku, o provádění úschov, které bylo několikrát novelizováno, naposledy s účinností od roku 2026.'],
            },
            {
                h: 'Než peníze přijmete',
                points: [
                    'Uzavřete písemnou smlouvu o úschově s jasně určeným účelem a podmínkami pro vydání peněz.',
                    'Proveďte identifikaci a kontrolu klienta podle AML zákona. U úschovy je advokát povinnou osobou.',
                    'Ohlaste úschovu do Elektronické knihy úschov (EKÚ) ČAK, a to před přijetím peněz. Od roku 2026 se hlásí i identifikační údaje složitele a oprávněného, pokud jsou stranou smlouvy.',
                    'Peníze přijímejte na zvláštní účet úschov, oddělený od vlastních peněz advokáta.',
                ],
                p: [],
            },
            {
                h: 'Během úschovy a po ní',
                p: ['Veďte evidenci všech pohybů a pravidelně kontrolujte zůstatek proti bance. Peníze vydejte jen za podmínek ze smlouvy. U úschov ohlášených od 1. 7. 2023 se do EKÚ hlásí i ukončení úschovy. Doklady o úschově uchovávejte spolu se spisem.'],
            },
            {
                h: 'Nejčastější chyby',
                points: [
                    'Přijetí peněz dřív, než je úschova ohlášena do EKÚ.',
                    'Nejasně formulované podmínky výdeje, které vedou ke sporu stran.',
                    'Míchání úschov různých klientů bez evidence po jednotlivých úschovách.',
                    'Úschovy, které po splnění účelu zůstanou dlouho ležet bez vyřízení.',
                ],
                p: [],
            },
        ],
        takeaways: ['Smlouva, AML a hlášení do EKÚ před přijetím peněz.', 'Zvláštní účet úschov a evidence po jednotlivých úschovách.', 'Ukončení úschovy hlaste do EKÚ.'],
        landing: 'evidence-uschov',
    },
    {
        slug: 'aml-identifikace-klienta-advokat',
        title: 'AML povinnosti advokáta: kdy a jak identifikovat klienta',
        description: 'Kdy je advokát povinnou osobou podle zákona č. 253/2008 Sb., jak provést identifikaci a kontrolu klienta, jak dlouho uchovávat údaje a jak hlásit podezřelý obchod.',
        category: 'Stavovské povinnosti',
        published: '2026-11-22',
        updated: '2026-11-22',
        minutes: 6,
        lead: 'AML zákon (zákon č. 253/2008 Sb., o některých opatřeních proti legalizaci výnosů z trestné činnosti a financování terorismu) se na advokáta nevztahuje vždy, ale jen při určitých činnostech. Pak ovšem platí naplno.',
        sections: [
            {
                h: 'Kdy je advokát povinnou osobou',
                p: ['Advokát je povinnou osobou, pokud pro klienta jedná nebo mu pomáhá při vyjmenovaných činnostech, zejména:'],
                points: [
                    'koupě nebo prodej nemovitosti nebo obchodního závodu,',
                    'správa peněz, cenných papírů nebo jiného majetku klienta a úschova,',
                    'zřízení nebo správa účtu u banky,',
                    'založení, řízení nebo provozování obchodní korporace či svěřenského fondu a převody podílů.',
                ],
            },
            {
                h: 'Identifikace a kontrola klienta',
                p: [
                    'Identifikace znamená zjistit a ověřit totožnost klienta z dokladu a zaznamenat identifikační údaje. U právnické osoby se zjišťuje i skutečný majitel. Kontrola klienta jde dál: účel a povaha obchodu, původ peněz, zda nejde o politicky exponovanou osobu a zda klient není na sankčním seznamu.',
                    'Rozsah kontroly se řídí rizikem. U vyššího rizika (neobvyklá struktura, zahraniční prvek, hotovost) se kontrola prohlubuje a opakuje častěji.',
                ],
            },
            {
                h: 'Uchovávání údajů',
                p: ['Údaje a doklady z identifikace a kontroly se uchovávají 10 let od ukončení obchodního vztahu nebo uskutečnění obchodu (§ 16 AML zákona).'],
            },
            {
                h: 'Podezřelý obchod',
                p: ['Advokát neoznamuje podezřelý obchod přímo Finančnímu analytickému úřadu, ale České advokátní komoře, která oznámení předá. Povinnost oznámení se nevztahuje na informace, které advokát získal při poskytování právní porady, obhajobě nebo zastupování v řízení.'],
            },
            {
                h: 'Praktické doporučení',
                points: ['Mějte písemně sepsaný postup pro identifikaci a kontrolu klientů.', 'Identifikaci veďte u spisu, aby byla dohledatelná při kontrole.', 'Nastavte si termín pro opakované posouzení u dlouhodobých klientů.'],
                p: [],
            },
        ],
        takeaways: ['AML se vztahuje jen na vyjmenované činnosti.', 'Údaje uchovávejte 10 let.', 'Podezřelý obchod se oznamuje přes ČAK.'],
        landing: 'aml-identifikace-klienta',
    },
    {
        slug: 'stret-zajmu-advokat',
        title: 'Střet zájmů advokáta: kdy věc odmítnout a jak ho hlídat',
        description: 'Kdy musí advokát odmítnout poskytnutí právních služeb pro střet zájmů podle § 19 zákona o advokacii a jak střet zájmů spolehlivě kontrolovat v kanceláři.',
        category: 'Stavovské povinnosti',
        published: '2026-11-22',
        updated: '2026-11-22',
        minutes: 4,
        lead: 'Střet zájmů patří mezi nejčastější důvody kárných řízení. V kanceláři s více advokáty a stovkami spisů ho nelze hlídat pamětí.',
        sections: [
            {
                h: 'Co říká zákon',
                p: [
                    'Podle § 19 zákona o advokacii musí advokát odmítnout poskytnutí právních služeb mimo jiné tehdy, když v téže nebo související věci už poskytl právní služby osobě, jejíž zájmy jsou v rozporu se zájmy nového klienta, nebo když by mohl informace od jiného klienta zneužít ve prospěch nového.',
                    'Povinnost platí i pro advokáty, kteří vykonávají advokacii společně. Pokud střet zájmů vznikne až během zastoupení, musí advokát smlouvu s klientem vypovědět (§ 20 zákona o advokacii). Pravidla dále rozvádí etický kodex (usnesení představenstva ČAK č. 1/1997 Věstníku).',
                ],
            },
            {
                h: 'Jak střet zájmů kontrolovat',
                points: [
                    'Kontrolujte před převzetím věci: nového klienta, protistranu i další účastníky.',
                    'Prohledejte všechny spisy kanceláře, nejen své, včetně archivu.',
                    'Hledejte i tvary jmen v jiném pádě a podle IČO; „Nováková“ v jednom spisu může být „Novákovi“ v jiném.',
                    'Výsledek kontroly si zaznamenejte ke spisu.',
                ],
                p: [],
            },
            {
                h: 'Mlčenlivost uvnitř kanceláře',
                p: ['Kontrola napříč kanceláří nesmí prozradit cizí spisy. Dobrý systém řekne, že shoda existuje a s kým je potřeba ji probrat, ale neukáže obsah spisu kolegy.'],
            },
        ],
        takeaways: ['Kontrolujte klienta i protistranu před převzetím věci.', 'Hledejte napříč celou kanceláří včetně archivu.', 'Střet zájmů zjištěný později znamená výpověď smlouvy.'],
        landing: 'kontrola-stretu-zajmu',
    },
    {
        slug: 'mlcenlivost-advokata-a-cloud',
        title: 'Mlčenlivost advokáta a cloud: jak bezpečně používat online software',
        description: 'Smí advokát ukládat spisy v cloudu? Co požaduje povinnost mlčenlivosti podle § 21 zákona o advokacii a na co se ptát poskytovatele online softwaru.',
        category: 'Ochrana dat',
        published: '2026-11-22',
        updated: '2026-11-22',
        minutes: 5,
        lead: 'Advokát je povinen zachovávat mlčenlivost o všech skutečnostech, o kterých se dozvěděl v souvislosti s poskytováním právních služeb (§ 21 zákona o advokacii). Zákon ale neříká, kde a jak má data ukládat. Rozhoduje, zda je ochrana dostatečná.',
        sections: [
            {
                h: 'Cloud není zakázaný',
                p: ['Ukládání spisů v cloudu ani používání online aplikace není samo o sobě porušením mlčenlivosti. Advokát ale odpovídá za to, že zvolí poskytovatele a nastavení, které důvěrnost zajistí. Stejně jako u papírových spisů v kanceláři jde o přiměřená opatření.'],
            },
            {
                h: 'Na co se ptát poskytovatele',
                points: [
                    'Co je šifrované end-to-end, takže to poskytovatel nepřečte, a co chrání jen přístupová práva?',
                    'Je vynucené dvoufázové přihlášení?',
                    'Vede systém auditní záznam, kdo spis otevřel a co změnil?',
                    'Kteří zpracovatelé data zpracovávají a kde, a je uzavřená zpracovatelská smlouva podle čl. 28 GDPR?',
                    'Posílají se data do AI, a pokud ano, se souhlasem a po anonymizaci?',
                    'Jak dostanu data ven, když budu chtít odejít?',
                ],
                p: [],
            },
            {
                h: 'Na co nezapomenout ve vlastní kanceláři',
                p: ['Mlčenlivost se týká i zaměstnanců a koncipientů. Každý by měl mít vlastní přístup s oprávněními jen ke spisům, na kterých pracuje. Sdílené heslo pro celou kancelář je nejčastější slabina. Citlivé dokumenty klientům neposílejte běžným e-mailem, ale šifrovaným kanálem.'],
            },
        ],
        takeaways: ['Cloud je přípustný, pokud je ochrana přiměřená.', 'Ptejte se, co přesně je šifrované a kdo k datům může.', 'Každý člen týmu má mít vlastní přístup.'],
        landing: 'software-pro-advokaty',
    },
    {
        slug: 'gdpr-v-advokatni-kancelari',
        title: 'GDPR v advokátní kanceláři: co musí advokát splnit',
        description: 'GDPR pro advokáty: právní základ zpracování, informační povinnost a výjimka pro mlčenlivost, záznamy o činnostech, zpracovatelské smlouvy a hlášení porušení.',
        category: 'Ochrana dat',
        published: '2026-11-22',
        updated: '2026-11-22',
        minutes: 5,
        lead: 'Advokát zpracovává osobní údaje klientů, protistran, svědků i zaměstnanců. Obecné nařízení o ochraně osobních údajů (GDPR) se na něj vztahuje plně, některá pravidla ale mlčenlivost advokáta zohledňují.',
        sections: [
            {
                h: 'Právní základ zpracování',
                points: [
                    'Údaje klienta: plnění smlouvy o poskytování právních služeb a plnění právních povinností (AML, archivace spisu).',
                    'Údaje protistrany a dalších osob: oprávněný zájem klienta na ochraně jeho práv.',
                    'Souhlas je potřeba jen výjimečně, například pro marketing.',
                ],
                p: [],
            },
            {
                h: 'Informační povinnost',
                p: ['Klienta informujte o zpracování jeho údajů, typicky v plné moci nebo ve smlouvě. U osob, jejichž údaje jste nezískali od nich (protistrana), se informační povinnost neuplatní, pokud by údaje musely zůstat důvěrné v rámci povinnosti mlčenlivosti (čl. 14 odst. 5 písm. d) GDPR).'],
            },
            {
                h: 'Dokumentace a dodavatelé',
                points: [
                    'Veďte záznamy o činnostech zpracování (čl. 30 GDPR).',
                    'S dodavateli, kteří údaje zpracovávají za vás (software, cloud, účetní), uzavřete zpracovatelskou smlouvu (čl. 28 GDPR).',
                    'Pověřence pro ochranu osobních údajů běžná advokátní kancelář zpravidla jmenovat nemusí.',
                ],
                p: [],
            },
            {
                h: 'Bezpečnost a porušení',
                p: ['Zabezpečení musí odpovídat riziku: řízení přístupů, dvoufázové přihlášení, šifrování a zálohy. Pokud dojde k porušení zabezpečení, které představuje riziko pro dotčené osoby, ohlaste ho Úřadu pro ochranu osobních údajů do 72 hodin (čl. 33 GDPR).'],
            },
        ],
        takeaways: ['Hlavní právní základ je smlouva a právní povinnost, ne souhlas.', 'Mlčenlivost má přednost před informační povinností vůči protistraně.', 'Se softwarem a cloudem mějte zpracovatelskou smlouvu.'],
        landing: 'evidence-spisu',
    },
    {
        slug: 'jak-vybrat-software-pro-advokatni-kancelar',
        title: 'Jak vybrat software pro advokátní kancelář: kontrolní seznam',
        description: 'Kontrolní seznam pro výběr advokátního softwaru: lhůty, datové schránky, e-mail, výkazy, fakturace, zabezpečení, práce v týmu, cena a přenos dat.',
        category: 'Vedení kanceláře',
        published: '2026-11-22',
        updated: '2026-11-22',
        minutes: 5,
        lead: 'Software pro kancelář používáte každý den několik let. Výběr podle ceny nebo podle délky seznamu funkcí se většinou nevyplatí. Tady je seznam otázek, které rozhodují.',
        sections: [
            {
                h: 'Každodenní práce',
                points: [
                    'Lhůty: počítá je program sám, i z doručeného rozhodnutí? Posouvá konec na pracovní den?',
                    'Datové schránky a e-mail: jsou přímo ve spisu, nebo zprávy přetahujete ručně?',
                    'Dokumenty: vyplní se vzory z údajů spisu a klienta?',
                    'Telefon: dá se s programem rozumně pracovat i u soudu?',
                ],
                p: [],
            },
            {
                h: 'Peníze',
                points: ['Kolik času zabere výkaz práce a faktura na konci měsíce?', 'Páruje program platby z banky?', 'Dostane účetní podklady v použitelném formátu?'],
                p: [],
            },
            {
                h: 'Bezpečnost a tým',
                points: ['Co je šifrované a kdo k datům může, včetně provozovatele?', 'Má každý člen vlastní přístup a vidí jen svoje spisy?', 'Kontroluje program střet zájmů napříč kanceláří?', 'Je k dispozici zpracovatelská smlouva?'],
                p: [],
            },
            {
                h: 'Přechod a závazek',
                p: ['Zjistěte, jak dostanete data do programu a hlavně jak je dostanete ven. Vyzkoušejte program na několika skutečných spisech, ne jen na ukázkových datech. Dávejte pozor na dlouhé smlouvy bez možnosti výpovědi a na poplatky za zavedení.'],
            },
        ],
        takeaways: ['Zkoušejte na vlastních spisech.', 'Ptejte se na šifrování a přístupová práva.', 'Ověřte si, jak dostanete data ven.'],
        landing: 'advokatni-software',
    },
    {
        slug: 'prechod-na-novy-advokatni-software',
        title: 'Přechod na nový advokátní software bez výpadku: postup',
        description: 'Jak převést klienty, spisy, lhůty a výkazy do nového advokátního softwaru, co zkontrolovat a jak naplánovat přechod, aby žádná lhůta neutekla.',
        category: 'Vedení kanceláře',
        published: '2026-11-22',
        updated: '2026-11-22',
        minutes: 4,
        lead: 'Největší obava z přechodu je, že se během něj něco ztratí. S dobrým postupem zvládne samostatný advokát přechod za odpoledne a menší kancelář za pár dní.',
        sections: [
            {
                h: '1. Připravte export',
                p: ['Z dosavadního programu nebo z Excelu vyexportujte klienty, spisy, otevřené lhůty a nevyfakturovanou práci. Stačí CSV nebo Excel; důležité je, aby každý spis měl jednoznačné označení.'],
            },
            {
                h: '2. Nejdřív lhůty',
                p: ['Otevřené lhůty a nařízená jednání převeďte jako první a zkontrolujte je proti původnímu kalendáři. Až do kontroly veďte lhůty v obou systémech.'],
            },
            {
                h: '3. Import a kontrola',
                p: ['Importujte klienty, pak spisy a nakonec výkazy. Dobrý import ukáže náhled a upozorní na chyby, než cokoli uloží. Namátkou otevřete několik spisů a porovnejte je s originálem.'],
            },
            {
                h: '4. Propojte zdroje',
                p: ['Připojte datovou schránku, e-mail a bankovní účet, aby nové zprávy a platby chodily rovnou do nového systému. Nastavte upozornění na lhůty a kalendář v telefonu.'],
            },
            {
                h: '5. Ukončete starý systém',
                p: ['Po měsíci souběhu archivujte export starého systému a ukončete předplatné. Starší uzavřené spisy nemusíte převádět, stačí archivní export.'],
            },
        ],
        takeaways: ['Lhůty převádějte první a kontrolujte je.', 'Importujte s náhledem a kontrolou.', 'Krátký souběh obou systémů je bezpečnější než ostrý přechod.'],
        landing: 'advokatni-software',
    },
    {
        slug: 'insolvencni-rejstrik-hlidani-protistrany',
        title: 'Insolvenční rejstřík: jak hlídat klienty a protistrany advokátem',
        description: 'Jak advokát používá insolvenční rejstřík: kdy protistranu kontrolovat, podle čeho ji hledat, proč nestačí jednorázová kontrola a jak hlídat změny ve spisech.',
        category: 'Vedení kanceláře',
        published: '2026-11-24',
        updated: '2026-11-24',
        minutes: 4,
        lead: 'Úpadek protistrany změní strategii sporu i vymáhání. Kdo to zjistí až při exekuci, ztrácí čas a někdy i možnost pohledávku včas přihlásit.',
        sections: [
            {
                h: 'Kdy insolvenční rejstřík kontrolovat',
                points: [
                    'Před podáním žaloby nebo návrhu na výkon rozhodnutí proti dlužníkovi.',
                    'Před převzetím pohledávky k vymáhání a před dohodou o splátkách.',
                    'Průběžně u protistran ve všech běžících sporech, protože insolvenční řízení může začít kdykoli.',
                    'U vlastních klientů, kteří jsou věřiteli: úpadek jejich dlužníka běží bez ohledu na to, zda se klient ozve.',
                ],
                p: [],
            },
            {
                h: 'Podle čeho hledat',
                p: [
                    'Insolvenční rejstřík je veřejný a vede ho Ministerstvo spravedlnosti. U podnikatelů a právnických osob se hledá podle IČO, u fyzické osoby bez IČO podle jména, příjmení a data narození. Jednoznačnost hledání proto závisí na tom, jak kvalitní údaje o protistraně ve spisu máte.',
                ],
            },
            {
                h: 'Proč nestačí jednorázová kontrola',
                p: [
                    'Kontrola ke dni podání žaloby neřekne nic o tom, co se stane o tři měsíce později. Lhůty, které s insolvencí souvisejí (zejména lhůta k přihlášení pohledávky, kterou soud uvádí v rozhodnutí o úpadku), jsou krátké a jejich zmeškání může věřitele připravit o možnost uspokojení z majetkové podstaty. Konkrétní lhůtu a postup vždy ověřte v rozhodnutí soudu a v insolvenčním zákoně (zákon č. 182/2006 Sb.).',
                ],
            },
            {
                h: 'Jak to zvládnout v kanceláři',
                points: [
                    'Mějte u každého klienta a protistrany vyplněné IČO, případně datum narození.',
                    'Nastavte pravidelnou automatickou kontrolu všech otevřených spisů.',
                    'Zjištěný záznam si uložte ke spisu s datem a okamžitě informujte klienta.',
                    'Ke každé nalezené shodě ověřte, že jde skutečně o stejnou osobu, než z ní vyvodíte závěry.',
                ],
                p: [],
            },
        ],
        takeaways: ['Kontrolujte protistranu před žalobou i během sporu.', 'Kvalita údajů ve spisu určuje kvalitu kontroly.', 'Lhůty v insolvenci ověřujte vždy v rozhodnutí soudu.'],
        landing: 'radar-protistrany-insolvence',
    },
    {
        slug: 'bezpecne-sdileni-dokumentu-s-klientem',
        title: 'Bezpečné sdílení dokumentů s klientem: e-mail, nebo klientský portál?',
        description: 'Proč e-mailové přílohy nejsou pro advokáta ideální, co říká mlčenlivost podle § 21 zákona o advokacii a jak vypadá bezpečné sdílení dokumentů a zpráv s klientem.',
        category: 'Ochrana dat',
        published: '2026-11-24',
        updated: '2026-11-24',
        minutes: 4,
        lead: 'Klient pošle fotku smlouvy, rodné číslo i sken občanského průkazu v běžném e-mailu. Advokát pak odpovídá za to, že s tím naloží tak, aby se k nim nikdo nedostal.',
        sections: [
            {
                h: 'Mlčenlivost a technická opatření',
                p: [
                    'Advokát je povinen zachovávat mlčenlivost o všem, co se při poskytování právních služeb dozvěděl (§ 21 zákona o advokacii). Zákon nepředepisuje konkrétní technologii, ale od advokáta se očekává, že zvolí takový způsob komunikace a uložení, který odpovídá citlivosti údajů.',
                ],
            },
            {
                h: 'Slabiny e-mailu',
                points: [
                    'Příloha zůstává v poštovních schránkách obou stran a často i v zálohách a na mobilech.',
                    'Chybně zadaná adresa nejde vzít zpět.',
                    'Dokumenty jsou rozeseté po schránkách místo ve spisu; kolega je nenajde.',
                    'Není zřejmé, kdo a kdy dokument viděl.',
                ],
                p: [],
            },
            {
                h: 'Jak vypadá bezpečnější postup',
                points: [
                    'Klient dostane soukromý odkaz a nahraje podklady přímo do spisu, bez zakládání dalšího účtu.',
                    'Zprávy a dokumenty se ukládají na jedno místo ke spisu, ne do osobních schránek.',
                    'Přístup mají jen oprávnění členové kanceláře a odkaz lze kdykoli zrušit.',
                    'Klienta jednou poučte, jak odkaz používat, a nevyžadujte podklady e-mailem.',
                ],
                p: [],
            },
            {
                h: 'Co nezapomenout',
                p: ['Bezpečné sdílení nenahrazuje povinnosti podle GDPR ani dokumentaci spisu. Pokud používáte externí službu, ověřte, kde jsou data uložena a jak je upraveno jejich zpracování (smlouva o zpracování osobních údajů).'],
            },
        ],
        takeaways: ['E-mailové přílohy zanechávají kopie na mnoha místech.', 'Podklady od klienta patří přímo do spisu.', 'U externí služby si ověřte uložení dat a zpracovatelskou smlouvu.'],
        landing: 'klientsky-portal-pro-advokaty',
    },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
