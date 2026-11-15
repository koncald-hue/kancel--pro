// app/data/deadlines.ts

export interface LegalDeadline {
    id: string;
    title: string;
    category: string;
    law: string;
    /** Set only after a person has checked the legal substance against the cited source. */
    legalReviewedAt?: string;
    durationDays?: number;
    durationMonths?: number;
    durationYears?: number;
    type: 'days' | 'months' | 'years' | 'months_next_first' | 'immediate' | 'fixed_date';
    description: string;
    startTrigger: string;
}

export const LEGAL_DEADLINES: LegalDeadline[] = [
    // ==========================================
    // --- 1. SPOTŘEBITEL A NÁKUPY (1–15) ---
    // ==========================================
    {
        id: 'odstoupeni-eshop',
        title: 'Odstoupení od smlouvy při nákupu na internetu (e-shop)',
        category: 'spotrebitel',
        law: '§ 1829 odst. 1 občanského zákoníku (zákon č. 89/2012 Sb.)',
        durationDays: 14,
        type: 'days',
        description: 'Spotřebitel má právo odstoupit od smlouvy bez udání důvodu do 14 dnů od převzetí zboží.',
        startTrigger: 'Den následující po dni převzetí zboží'
    },
    {
        id: 'vyrizeni-reklamace',
        title: 'Lhůta pro vyřízení reklamace spotřebitele',
        category: 'spotrebitel',
        law: '§ 19 odst. 3 zákona o ochraně spotřebitele (č. 634/1992 Sb.)',
        durationDays: 30,
        type: 'days',
        description: 'Prodávající je povinen reklamaci vyřídit nejpozději do 30 kalendářních dnů, pokud se nedohodnou na delší lhůtě.',
        startTrigger: 'Den následující po dni uplatnění reklamace'
    },
    {
        id: 'odstoupeni-smlouva-dane-mimo-prostory',
        title: 'Odstoupení od smlouvy uzavřené mimo obchodní prostory',
        category: 'spotrebitel',
        law: '§ 1829 odst. 1 občanského zákoníku',
        durationDays: 14,
        type: 'days',
        description: 'U smluv uzavřených při podomním prodeji či předváděcích akcích má spotřebitel právo odstoupit do 14 dnů.',
        startTrigger: 'Den následující po dni uzavření smlouvy'
    },
    {
        id: 'odstoupeni-spotrebitelsky-uver',
        title: 'Odstoupení od smlouvy o spotřebitelském úvěru',
        category: 'spotrebitel',
        law: '§ 118 zákona o spotřebitelském úvěru (č. 257/2016 Sb.)',
        durationDays: 14,
        type: 'days',
        description: 'Spotřebitel může od smlouvy o úvěru odstoupit bez uvedení důvodů a bez sankcí ve lhůtě 14 dnů.',
        startTrigger: 'Den následující po dni sjednání smlouvy'
    },
    {
        id: 'odstoupeni-zivotni-pojisteni',
        title: 'Odstoupení od smlouvy o životním pojištění',
        category: 'spotrebitel',
        law: '§ 2808 občanského zákoníku',
        durationDays: 30,
        type: 'days',
        description: 'Pojistník má právo odstoupit od smlouvy o životním pojištění ve lhůtě 30 dnů od jejího uzavření.',
        startTrigger: 'Den následující po dni uzavření smlouvy'
    },
    {
        id: 'zarucni-doba-spotrebitel',
        title: 'Standardní záruční doba na nové spotřební zboží',
        category: 'spotrebitel',
        law: '§ 2165 občanského zákoníku',
        durationYears: 2,
        type: 'years',
        description: 'Kupující je oprávněn uplatnit právo z vady, která se vyskytne u spotřebního zboží v době 24 měsíců od převzetí.',
        startTrigger: 'Den převzetí zboží'
    },
    {
        id: 'poucedni-lhuta-eshop-chybejici',
        title: 'Prodloužená lhůta pro odstoupení od e-shopu bez poučení',
        category: 'spotrebitel',
        law: '§ 1829 odst. 2 občanského zákoníku',
        durationMonths: 12,
        type: 'months',
        description: 'Nebyl-li spotřebitel poučen o právu odstoupit od smlouvy, může odstoupit do 1 roku a 14 dnů od počátku běhu lhůty.',
        startTrigger: 'Konec původní 14denní lhůty pro odstoupení'
    },
    {
        id: 'vraceni-penez-eshop-po-odstoupeni',
        title: 'Lhůta pro vrácení peněz prodejcem po odstoupení od e-shopu',
        category: 'spotrebitel',
        law: '§ 1832 odst. 1 občanského zákoníku',
        durationDays: 14,
        type: 'days',
        description: 'Odstoupí-li spotřebitel od smlouvy, prodávající mu vrátí bez zbytečného odkladu, nejpozději do 14 dnů, všechny peněžní prostředky.',
        startTrigger: 'Den doručení odstoupení od smlouvy prodávajícímu'
    },
    {
        id: 'vraceni-zbozi-spotrebitel-po-odstoupeni',
        title: 'Lhůta pro zaslání zboží zpět kupujícím po odstoupení',
        category: 'spotrebitel',
        law: '§ 1831 odst. 1 občanského zákoníku',
        durationDays: 14,
        type: 'days',
        description: 'Spotřebitel je povinen vrátit zboží prodávajícímu do 14 dnů od odstoupení od smlouvy.',
        startTrigger: 'Den odeslání/doručení odstoupení prodávajícímu'
    },
    {
        id: 'zarucni-doba-joudete-zbozi',
        title: 'Záruka při koupi použitého spotřebního zboží (bazar)',
        category: 'spotrebitel',
        law: '§ 2168 občanského zákoníku',
        durationYears: 1,
        type: 'years',
        description: 'Při koupi použitého zboží lze smluvně zkrátit dobu pro uplatnění práv z vad až na 1 rok.',
        startTrigger: 'Den převzetí použitého zboží'
    },
    // Nově přidané (50+ rozšíření)
    {
        id: 'domnenka-vady-pri-prevzeti',
        title: 'Zákonná domněnka existenci vady při převzetí zboží',
        category: 'spotrebitel',
        law: '§ 2161 odst. 5 občanského zákoníku',
        durationMonths: 12,
        type: 'months',
        description: 'Projeví-li se vada v průběhu jednoho roku od převzetí, má se za to, že věc byla vadná již při převzetí (důkazní břemeno nese prodejce).',
        startTrigger: 'Den převzetí zboží'
    },
    {
        id: 'odstoupeni-energetika-mimo-prostory',
        title: 'Odstoupení od smlouvy o dodávkách elektřiny / plynu uzavřené mimo provozovnu',
        category: 'spotrebitel',
        law: '§ 11a odst. 2 energetického zákona (č. 458/2000 Sb.)',
        durationDays: 14,
        type: 'days',
        description: 'Spotřebitel může odstoupit od smlouvy o dodávce elektřiny nebo plynu sjednané s podomním prodejcem do 14 dnů.',
        startTrigger: 'Den následující po dni uzavření smlouvy'
    },
    {
        id: 'vypoved-smlouvy-energetika-zmena-ceni',
        title: 'Výpověď smlouvy na energie při zvýšení ceny dodavatelem',
        category: 'spotrebitel',
        law: '§ 11a odst. 5 energetického zákona',
        durationDays: 10,
        type: 'days',
        description: 'Nesouhlasí-li zákazník se zvýšením ceny dodávek, může smlouvu bez sankcí vypovědět nejpozději 10 dnů před účinností zvýšení.',
        startTrigger: 'Doručení/oznámení nového ceníku dodavatelem'
    },
    {
        id: 'odstoupeni-timeshare',
        title: 'Odstoupení od smlouvy o užívání ubytovacího zařízení na časový úsek (timeshare)',
        category: 'spotrebitel',
        law: '§ 1858 občanského zákoníku',
        durationDays: 14,
        type: 'days',
        description: 'Spotřebitel může odstoupit od smlouvy o timesharingu bez udání důvodu do 14 dnů.',
        startTrigger: 'Den uzavření smlouvy nebo doručení jejího vyhotovení'
    },
    {
        id: 'reklamace-zazjezdu-vady',
        title: 'Oznámení vady zájezdu cestovní kanceláři',
        category: 'spotrebitel',
        law: '§ 2537 odst. 2 občanského zákoníku',
        durationDays: 0,
        type: 'immediate',
        description: 'Zákazník vytkne vadu zájezdu bez zbytečného odkladu (ideálně přímo delegátovi v místě pobytu).',
        startTrigger: 'Zjištění vady v průběhu zájezdu'
    },

    // ==========================================
    // --- 2. BYDLENÍ A NEMOVITOSTI (16–33) ---
    // ==========================================
    {
        id: 'vypoved-najmu-neurcito',
        title: 'Výpovědní doba nájmu bytu (na dobu neurčitou)',
        category: 'bydleni',
        law: '§ 2286 a § 2231 občanského zákoníku',
        durationMonths: 3,
        type: 'months_next_first',
        description: 'Výpovědní doba činí 3 měsíce a začíná běžet prvním dnem kalendářního měsíce následujícího po doručení výpovědi.',
        startTrigger: '1. den měsíce následujícího po doručení výpovědi'
    },
    {
        id: 'vraceni-kauce-najem',
        title: 'Lhůta pro vrácení jistoty (kauce) při skončení nájmu',
        category: 'bydleni',
        law: '§ 2254 odst. 2 občanského zákoníku',
        durationDays: 0,
        type: 'immediate',
        description: 'Pronajímatel je povinen vrátit jistotu při skončení nájmu. Pokud si strany nesjednaly lhůtu, platí povinnost bez zbytečného odkladu (v den předání bytu).',
        startTrigger: 'Den skončení nájmu a předání bytu'
    },
    {
        id: 'namitky-vyuctovani-sluzeb',
        title: 'Námitky proti vyúčtování služeb spojených s užíváním bytu',
        category: 'bydleni',
        law: '§ 8 odst. 2 zákona č. 67/2013 Sb.',
        durationDays: 30,
        type: 'days',
        description: 'Případné námitky proti doručenému vyúčtování služeb musí nájemce doručit poskytovateli služeb nejpozději do 30 dnů.',
        startTrigger: 'Den doručení vyúčtování služeb'
    },
    {
        id: 'vyrizeni-namitek-vyuctovani-sluzeb',
        title: 'Lhůta pronajímatele pro vyřízení námitek k vyúčtování',
        category: 'bydleni',
        law: '§ 8 odst. 3 zákona č. 67/2013 Sb.',
        durationDays: 30,
        type: 'days',
        description: 'Poskytovatel služeb (pronajímatel/SVJ) je povinen námitky vyřídit nejpozději do 30 dnů od doručení.',
        startTrigger: 'Den doručení námitky poskytovateli'
    },
    {
        id: 'predkupni-pravo-spoluvlastniku',
        title: 'Lhůta pro uplatnění předkupního práva spoluvlastníka (nemovitosti)',
        category: 'bydleni',
        law: '§ 2148 odst. 1 občanského zákoníku',
        durationMonths: 3,
        type: 'months',
        description: 'Předkupní právo k nemovité věci musí být uplatněno kupující stranou do tří měsíců od nabídky.',
        startTrigger: 'Den následující po doručení nabídky spoluvlastníkovi'
    },
    {
        id: 'vypoved-najmu-prostoru-k-podnikani',
        title: 'Výpovědní doba nájmu prostoru sloužícího k podnikání (neurčito)',
        category: 'bydleni',
        law: '§ 2312 občanského zákoníku',
        durationMonths: 6,
        type: 'months',
        description: 'Výpovědní doba nájmu na dobu neurčitou činí 6 měsíců.',
        startTrigger: 'Den následující po doručení výpovědi'
    },
    {
        id: 'plamba-katastr-nemovitosti',
        title: 'Ochranná lhůta před zápisem do katastru nemovitostí (plomba)',
        category: 'bydleni',
        law: '§ 18 odst. 1 katastrálního zákona (č. 256/2013 Sb.)',
        durationDays: 20,
        type: 'days',
        description: 'Katastrální úřad vpíše vklad nejdříve po uplynutí lhůty 20 dnů od odeslání informace účastníkům.',
        startTrigger: 'Den odeslání vyrozumění o plombě'
    },
    {
        id: 'zaloba-přezkum-vypovedi-najmu-bytu',
        title: 'Podání žaloby na přezkoumání oprávněnosti výpovědi z nájmu bytu',
        category: 'bydleni',
        law: '§ 2290 občanského zákoníku',
        durationMonths: 2,
        type: 'months',
        description: 'Nájemce má právo podat návrh soudu, aby přezkoumal, zda je výpověď oprávněná, do 2 měsíců ode dne doručení výpovědi.',
        startTrigger: 'Den doručení výpovědi nájemci'
    },
    {
        id: 'oznameni-skryte-vady-stavby',
        title: 'Lhůta pro oznámení skryté vady stavby zhotoviteli',
        category: 'bydleni',
        law: '§ 2629 odst. 1 občanského zákoníku',
        durationYears: 5,
        type: 'years',
        description: 'Soud nepřizná právo ze skryté vady stavby, pokud nebyla oznámena bez zbytečného odkladu, nejpozději do 5 let od převzetí.',
        startTrigger: 'Den převzetí stavby'
    },
    {
        id: 'preziskatelnost-vady-bytu-prevod',
        title: 'Oznámení skryté vady převzatého bytu / domu prodávajícímu',
        category: 'bydleni',
        law: '§ 2112 občanského zákoníku',
        durationYears: 5,
        type: 'years',
        description: 'Kupující musí skrytou vadu stavby spojené se zemním tělesem uplatnit u prodávajícího do 5 let.',
        startTrigger: 'Den nabytí nemovitosti / předání'
    },
    {
        id: 'zaloba-neplatnost-rozhodnuti-svj',
        title: 'Žaloba na neplatnost rozhodnutí shromáždění SVJ',
        category: 'bydleni',
        law: '§ 1221 a § 258 občanského zákoníku',
        durationMonths: 3,
        type: 'months',
        description: 'Přehlasovaný vlastník jednotky může navrhnout soudu, aby rozhodl o neplatnosti rozhodnutí do 3 měsíců.',
        startTrigger: 'Den, kdy se o rozhodnutí dozvěděl'
    },
    {
        id: 'odstoupeni-rezervacni-smlouva-reality',
        title: 'Lhůta pro rozmyšlení u zprostředkovatelské smlouvy spotřebitele',
        category: 'bydleni',
        law: '§ 1829 občanského zákoníku',
        durationDays: 14,
        type: 'days',
        description: 'Rezervační smlouvu na nemovitost podepsanou mimo prostory realitky lze zrušit do 14 dnů.',
        startTrigger: 'Den podpisu smlouvy'
    },
    {
        id: 'vypoved-pachtu-zemedelskeho',
        title: 'Výpovědní doba zemědělského pachtu',
        category: 'bydleni',
        law: '§ 2339 odst. 1 občanského zákoníku',
        durationMonths: 12,
        type: 'months',
        description: 'Pacht sjednaný na dobu neurčitou lze vypovědět v šestiměsíční výpovědní době tak, aby skončil ke konci pachtovního roku (1 rok).',
        startTrigger: 'Konec pachtovního roku (zpravidla 30. září)'
    },
    // Nově přidané
    {
        id: 'dostupnost-vyuctovani-sluzeb-pronajimatel',
        title: 'Lhůta pronajímatele pro doručení vyúčtování služeb nájemci',
        category: 'bydleni',
        law: '§ 7 odst. 1 zákona č. 67/2013 Sb.',
        durationMonths: 4,
        type: 'months',
        description: 'Pronajímatel nebo SVJ doručí vyúčtování záloh na služby nejpozději do 4 měsíců od skončení zúčtovacího období.',
        startTrigger: 'Skončení zúčtovacího období (zpravidla 31. prosince)'
    },
    {
        id: 'financni-vyrovnani-nedoplatku-sluzeb',
        title: 'Splatnost přeplatku / nedoplatku z vyúčtování služeb bytu',
        category: 'bydleni',
        law: '§ 7 odst. 3 zákona č. 67/2013 Sb.',
        durationMonths: 4,
        type: 'months',
        description: 'Finanční vyrovnání přeplatků a nedoplatků služeb se provede nejpozději do 4 měsíců od doručení vyúčtování.',
        startTrigger: 'Den doručení vyúčtování nájemci'
    },
    {
        id: 'namitka-nepadnuti-zvyseni-najemniho',
        title: 'Soudní přezkum návrhu na zvýšení nájemného',
        category: 'bydleni',
        law: '§ 2249 odst. 3 občanského zákoníku',
        durationMonths: 3,
        type: 'months',
        description: 'Nesouhlasí-li nájemce se zvýšením nájemného, může pronajímatel podat návrh soudu na určení výše nájemného do 3 měsíců.',
        startTrigger: 'Uplynutí 2 měsíců od doručení návrhu na zvýšení'
    },
    {
        id: 'okamzite-zruseni-najmu-zvlaste-zavazne',
        title: 'Výpověď nájmu bytu bez výpovědní doby (zvlášť závažné porušení)',
        category: 'bydleni',
        law: '§ 2291 občanského zákoníku',
        durationDays: 0,
        type: 'immediate',
        description: 'Porušuje-li nájemce povinnosti zvlášť závažným způsobem (např. neplacení nájmu za 3 měsíce), lze nájem vypovědět bez výpovědní doby.',
        startTrigger: 'Den doručení výpovědi'
    },
    {
        id: 'vypoved-pachtu-obecny',
        title: 'Výpovědní doba obecného pachtu (nezemědělského)',
        category: 'bydleni',
        law: '§ 2331 občanského zákoníku',
        durationMonths: 6,
        type: 'months',
        description: 'Pacht sjednaný na dobu neurčitou lze vypovědět v šestiměsíční výpovědní době.',
        startTrigger: 'Den následující po doručení výpovědi'
    },

    // ==========================================
    // --- 3. PRACOVNÍ PRÁVO A ZAMĚSTNÁNÍ (34–52) ---
    // ==========================================
    {
        id: 'vypoved-pracovni-pomer',
        title: 'Výpovědní doba z pracovního poměru',
        category: 'prace',
        law: '§ 51 zákoníku práce (zákon č. 262/2006 Sb.)',
        durationMonths: 2,
        type: 'months_next_first',
        description: 'Činí nejméně 2 měsíce a začíná běžet prvním dnem kalendářního měsíce následujícího po doručení výpovědi.',
        startTrigger: '1. den měsíce následujícího po doručení výpovědi'
    },
    {
        id: 'zkusebni-doba-zruseni',
        title: 'Zrušení pracovního poměru ve zkušební době',
        category: 'prace',
        law: '§ 66 zákoníku práce',
        durationDays: 3,
        type: 'days',
        description: 'Písemné oznámení má být doručeno druhé straně zpravidla alespoň 3 dny přede dnem, kdy má pracovní poměr skončit.',
        startTrigger: 'Alespoň 3 dny před plánovaným dnem skončení'
    },
    {
        id: 'zaloba-neplatnost-vypovedi',
        title: 'Žaloba na neplatnost rozvázání pracovního poměru',
        category: 'prace',
        law: '§ 72 zákoníku práce',
        durationMonths: 2,
        type: 'months',
        description: 'Neplatnost může zaměstnanec i zaměstnavatel uplatnit u soudu nejpozději ve lhůtě 2 měsíců ode dne, kdy měl pracovní poměr skončit.',
        startTrigger: 'Den, kdy měl pracovní poměr skončit'
    },
    {
        id: 'vytknuti-poruseni-povinnosti-zamestnance',
        title: 'Upozornění na možnost výpovědi pro porušování povinností',
        category: 'prace',
        law: '§ 52 písm. g) zákoníku práce',
        durationMonths: 6,
        type: 'months',
        description: 'Před podáním výpovědi pro méně závažná porušení povinností musí být zaměstnanec v posledních 6 měsících písemně upozorněn.',
        startTrigger: 'Den doručení písemného upozornění'
    },
    {
        id: 'okamzite-zruseni-subjektivni',
        title: 'Subjektivní lhůta pro okamžité zrušení pracovního poměru',
        category: 'prace',
        law: '§ 58 odst. 1 zákoníku práce',
        durationMonths: 2,
        type: 'months',
        description: 'Zaměstnavatel i zaměstnanec mohou okamžitě zrušit pracovní poměr pouze do 2 měsíců ode dne, kdy se o důvodu dozvěděli.',
        startTrigger: 'Den dozvězení se o důvodu ke zrušení'
    },
    {
        id: 'okamzite-zruseni-objektivni',
        title: 'Objektivní lhůta pro okamžité zrušení pracovního poměru',
        category: 'prace',
        law: '§ 58 odst. 1 zákoníku práce',
        durationYears: 1,
        type: 'years',
        description: 'Okamžitě zrušit pracovní poměr lze nejpozději do 1 roku ode dne, kdy důvod vznikl.',
        startTrigger: 'Den vzniku důvodu ke zrušení'
    },
    {
        id: 'vyplata-mzdy-splatnost',
        title: 'Lhůta pro splatnost mzdy nebo platu za uplynulý měsíc',
        category: 'prace',
        law: '§ 141 odst. 1 zákoníku práce',
        durationMonths: 1,
        type: 'months',
        description: 'Mzda je splatná nejpozději v kalendářním měsíci následujícím po měsíci, ve kterém vzniklo zaměstnanci právo na mzdu.',
        startTrigger: 'Poslední den měsíce následujícího po výkonu práce'
    },
    {
        id: 'okamzite-zruseni-zamestnancem-nevyplaceni-mzdy',
        title: 'Okamžité zrušení prac. poměru zaměstnancem pro nevyplacení mzdy',
        category: 'prace',
        law: '§ 56 odst. 1 písm. b) zákoníku práce',
        durationDays: 15,
        type: 'days',
        description: 'Zaměstnanec může okamžitě zrušit prac. poměr, pokud nedostal mzdu ani do 15 dnů po uplynutí období splatnosti.',
        startTrigger: '16. den měsíce následujícího po měsíci splatnosti'
    },
    {
        id: 'odstupne-splatnost',
        title: 'Lhůta pro vyplacení odstupné zaměstnavatelem',
        category: 'prace',
        law: '§ 67 odst. 4 zákoníku práce',
        durationMonths: 1,
        type: 'months',
        description: 'Odstupné je zaměstnavatel povinen vyplatit v nejbližším výplatním termínu po skončení pracovního poměru.',
        startTrigger: 'Den skončení pracovního poměru'
    },
    {
        id: 'promlceni-pohledavky-na-mzdu',
        title: 'Promlčecí lhůta pro nevyplacenou mzdu / cestovní náhrady',
        category: 'prace',
        law: '§ 629 občanského zákoníku v návaznosti na ZP',
        durationYears: 3,
        type: 'years',
        description: 'Nárok na vyplácení mzdy a jiných peněžitých plnění z pracovního poměru se promlčuje za 3 roky.',
        startTrigger: 'Den splatnosti mzdy'
    },
    {
        id: 'vypovedni-doba-dpp-dpc',
        title: 'Výpovědní doba u dohody o provedení práce (DPP) a pracovní činnosti (DPČ)',
        category: 'prace',
        law: '§ 77 odst. 5 zákoníku práce',
        durationDays: 15,
        type: 'days',
        description: 'Dohodu lze vypovědět z jakéhokoliv důvodu nebo bez uvedení důvodu s 15denní výpovědní dobou.',
        startTrigger: 'Den doručení výpovědi druhé straně'
    },
    {
        id: 'oznameni-pracovniho-urazu',
        title: 'Povinnost zamestnavatele ohlásit závažný pracovní úraz',
        category: 'prace',
        law: '§ 105 zákoníku práce',
        durationDays: 0,
        type: 'immediate',
        description: 'Zaměstnavatel je povinen ohlásit úraz bez zbytečného odkladu příslušnému oblastnímu inspektorátu práce a PČR.',
        startTrigger: 'Okamžik vzniku úrazu'
    },
    {
        id: 'lhuta-vydani-pracovniho-posudku',
        title: 'Lhůta pro vydání pracovního posudku zaměstnavatelem',
        category: 'prace',
        law: '§ 314 odst. 1 zákoníku práce',
        durationDays: 15,
        type: 'days',
        description: 'Požádá-li zaměstnanec o vydání posudku o pracovní činnosti, zaměstnavatel je povinen mu jej vydat do 15 dnů.',
        startTrigger: 'Den doručení žádosti zaměstnavateli'
    },
    // Nově přidané
    {
        id: 'lhuta-vydani-potvrzeni-o-zamestnani-zrucni-list',
        title: 'Lhůta pro vydání zápočtového listu při skončení zaměstnání',
        category: 'prace',
        law: '§ 313 odst. 1 zákoníku práce',
        durationDays: 0,
        type: 'immediate',
        description: 'Zaměstnavatel je povinen vydat zaměstnanci zápočtový list při skončení pracovního poměru (v den skončení).',
        startTrigger: 'Den skončení pracovního poměru'
    },
    {
        id: 'lhuta-cerpani-dovolené-nasedujici-rok',
        title: 'Termín pro určení čerpání nevypotřebované dovolené z minulého roku',
        category: 'prace',
        law: '§ 218 odst. 2 zákoníku práce',
        durationMonths: 6,
        type: 'months',
        description: 'Neurčí-li zaměstnavatel čerpání nevypotřebované dovolené do 30. června následujícího roku, má právo určit čerpání zaměstnanec.',
        startTrigger: '30. červen kalendářního roku'
    },
    {
        id: 'lhuta-nahrada-skody-zamestnanec-subjektivni',
        title: 'Subjektivní promlčecí lhůta pro vymáhání škody způsobené zaměstnancem',
        category: 'prace',
        law: '§ 263 zákoníku práce',
        durationYears: 2,
        type: 'years',
        description: 'Zaměstnavatel může vymáhat náhradu škody od zaměstnance do 2 let ode dne, kdy se dozvěděl o škodě.',
        startTrigger: 'Den zjištění škody a odpovídajícího zaměstnance'
    },
    {
        id: 'lhuta-nahrada-skody-zamestnanec-objektivni',
        title: 'Objektivní promlčecí lhůta pro náhradu škody zaměstnancem',
        category: 'prace',
        law: '§ 263 zákoníku práce',
        durationYears: 3,
        type: 'years',
        description: 'Zaměstnavatel může vymáhat škodu způsobenou zaměstnancem nejpozději do 3 let ode dne, kdy k ní došlo.',
        startTrigger: 'Den vzniknutí škody'
    },
    {
        id: 'max-delka-trvani-pracovniho-pomeru-urcito',
        title: 'Maximální celková doba trvání pracovního poměru na dobu určitou',
        category: 'prace',
        law: '§ 39 odst. 2 zákoníku práce',
        durationYears: 3,
        type: 'years',
        description: 'Pracovní poměr na dobu určitou mezi týmiž smluvními stranami nesmí přesáhnout 3 roky (opakován max. 2x).',
        startTrigger: 'Vznik prvního pracovního poměru na dobu určitou'
    },
    {
        id: 'lhuta-oznameni-prenosu-rodocovske-dovolene',
        title: 'Oznámení nástupu na rodičovskou dovolenou zaměstnavateli',
        category: 'prace',
        law: '§ 196 zákoníku práce',
        durationDays: 30,
        type: 'days',
        description: 'Zaměstnanec je povinen oznámit písemně žádost o rodičovskou dovolenou alespoň 30 dnů předem.',
        startTrigger: 'Alespoň 30 dní před plánovaným nástupem'
    },

    // ==========================================
    // --- 4. ÚŘADY, SPRÁVNÍ ŘÍZENÍ A DOPRAVA (53-[78]) ---
    // ==========================================
    {
        id: 'odvolani-spravni-rizeni',
        title: 'Odvolání proti správnímu rozhodnutí (úřady)',
        category: 'urady',
        law: '§ 83 odst. 1 správního řádu (zákon č. 500/2004 Sb.)',
        durationDays: 15,
        type: 'days',
        description: 'Odvolací lhůta činí 15 dnů ode dne oznámení (doručení) rozhodnutí.',
        startTrigger: 'Den následující po dni doručení rozhodnutí'
    },
    {
        id: 'zaloba-proti-vyhodnoceni-prestupku',
        title: 'Podání odporu proti příkazu za přestupek',
        category: 'urady',
        law: '§ 90 odst. 2 zákona o odpovědnosti za přestupky (č. 250/2016 Sb.)',
        durationDays: 8,
        type: 'days',
        description: 'Proti příkazu lze podat odpor do 8 dnů ode dne jeho doručení.',
        startTrigger: 'Den doručení příkazu'
    },
    {
        id: 'zaloba-ustavni-soud',
        title: 'Ústavní stížnost k Ústavnímu soudu ČR',
        category: 'urady',
        law: '§ 72 odst. 3 zákona o Ústavním soudu (č. 182/1993 Sb.)',
        durationMonths: 2,
        type: 'months',
        description: 'Ústavní stížnost lze podat ve lhůtě 2 měsíců od doručení rozhodnutí o posledním procesním prostředku.',
        startTrigger: 'Den doručení rozhodnutí o posledním prostředku'
    },
    {
        id: 'zadost-o-informace-106',
        title: 'Lhůta úřadu pro poskytnutí informace (zákon č. 106/1999 Sb.)',
        category: 'urady',
        law: '§ 14 odst. 5 písm. d) zákona o svobodném přístupu k informacím',
        durationDays: 15,
        type: 'days',
        description: 'Povinný subjekt poskytne žadateli požadovanou informaci nejpozději do 15 dnů od přijetí žádosti.',
        startTrigger: 'Den následující po doručení žádosti úřadu'
    },
    {
        id: 'stiznost-stavebni-povoleni-odvolani',
        title: 'Odvolání proti stavebnímu rozhodnutí',
        category: 'urady',
        law: '§ 83 odst. 1 správního řádu v návaznosti na stavební zákon',
        durationDays: 15,
        type: 'days',
        description: 'Proti stavebnímu rozhodnutí stavebního úřadu lze podat odvolání do 15 dnů ode dne doručení.',
        startTrigger: 'Den následující po doručení stavebního rozhodnutí'
    },
    {
        id: 'spravni-zaloba-nss',
        title: 'Správní žaloba proti rozhodnutí správního orgánu (krajský soud)',
        category: 'urady',
        law: '§ 72 odst. 1 soudního řádu správního (č. 150/2002 Sb.)',
        durationMonths: 2,
        type: 'months',
        description: 'Žalobu lze podat do dvou měsíců poté, co rozhodnutí bylo žalobci doručeno.',
        startTrigger: 'Den doručení rozhodnutí odvolacího správního orgánu'
    },
    {
        id: 'kasacni-stiznost-nss',
        title: 'Kasační stížnost k Nejvyššímu správnímu soudu',
        category: 'urady',
        law: '§ 106 odst. 2 soudního řádu správního',
        durationDays: 14,
        type: 'days',
        description: 'Kasační stížnost musí být podána do dvou týdnů po doručení rozhodnutí krajského soudu.',
        startTrigger: 'Den doručení rozhodnutí krajského soudu'
    },
    {
        id: 'fikce-doruceni-datova-schranka',
        title: 'Lhůta pro fikci doručení do datové schránky',
        category: 'urady',
        law: '§ 17 odst. 4 zákona o elektronických úkonech (č. 300/2008 Sb.)',
        durationDays: 10,
        type: 'days',
        description: 'Předpokládá se, že dokument byl doručen 10. dnem ode dne, kdy byl dodán do datové schránky.',
        startTrigger: 'Den dodání dokumentu do datové schránky'
    },
    {
        id: 'promlceni-odpovednosti-za-prestupek-1rok',
        title: 'Promlčecí doba odpovědnosti za přestupek (základní)',
        category: 'urady',
        law: '§ 30 písm. a) zákona o odpovědnosti za přestupky (č. 250/2016 Sb.)',
        durationYears: 1,
        type: 'years',
        description: 'Odpovědnost za přestupek zaniká uplynutím promlčecí doby 1 roku, pokud zákon nestanoví u závažnějších 3 roky.',
        startTrigger: 'Den následující po dni spáchání přestupku'
    },
    {
        id: 'promlceni-odpovednosti-za-prestupek-3roky',
        title: 'Promlčecí doba za závažnější přestupky (pokuta nad 100 tis. Kč)',
        category: 'urady',
        law: '§ 30 písm. b) zákona o odpovědnosti za přestupky',
        durationYears: 3,
        type: 'years',
        description: 'Promlčecí doba činí 3 roky, jde-li o přestupek, za který zákon stanoví sazbu pokuty s horní hranicí alespoň 100 000 Kč.',
        startTrigger: 'Den spáchání přestupku'
    },
    {
        id: 'obnova-rizeni-spravni-subjektivni',
        title: 'Subjektivní lhůta pro návrh na obnovu správního řízení',
        category: 'urady',
        law: '§ 100 odst. 2 správního řádu',
        durationMonths: 3,
        type: 'months',
        description: 'Účastník může podat žádost o obnovu řízení do 3 měsíců ode dne, kdy se o důvodu obnovy dozvěděl.',
        startTrigger: 'Den dozvězení se o důvodu obnovy'
    },
    {
        id: 'obnova-rizeni-spravni-objektivni',
        title: 'Objektivní lhůta pro návrh na obnovu správního řízení',
        category: 'urady',
        law: '§ 100 odst. 3 správního řádu',
        durationYears: 3,
        type: 'years',
        description: 'Obnovy řízení se lze domáhat nejpozději do 3 let od právní moci rozhodnutí.',
        startTrigger: 'Den právní moci správního rozhodnutí'
    },
    {
        id: 'rozklad-proti-rozhodnuti-ministra',
        title: 'Podání rozkladu proti rozhodnutí ústředního orgánu (ministerstva)',
        category: 'urady',
        law: '§ 152 odst. 1 správního řádu',
        durationDays: 15,
        type: 'days',
        description: 'Proti rozhodnutí, které vydal ministr nebo vedoucí ústředního správního úřadu, lze podat rozklad do 15 dnů.',
        startTrigger: 'Den doručení rozhodnutí'
    },
    {
        id: 'lhuta-zaplaceni-blokove-pokuty',
        title: 'Lhůta pro zaplacení pokuty uložené příkazem na místě',
        category: 'urady',
        law: '§ 91 zákona o odpovědnosti za přestupky',
        durationDays: 15,
        type: 'days',
        description: 'Pokuta uložená pokutovým blokem na místě na peněžní výzvu je splatná do 15 dnů.',
        startTrigger: 'Den převzetí pokutového bloku'
    },
    {
        id: 'lhuta-vydani-obcanskeho-prukazu',
        title: 'Lhůta pro vydání standardního občanského průkazu',
        category: 'urady',
        law: '§ 23 zákona č. 269/2021 Sb., o občanských průkazech',
        durationDays: 30,
        type: 'days',
        description: 'Občanský průkaz se vyhotoví do 30 dnů ode dne podání žádosti.',
        startTrigger: 'Den podání žádosti na úřadu'
    },
    {
        id: 'lhuta-vydani-pasu-standard',
        title: 'Standardní lhůta pro vyhotovení cestovního pasu',
        category: 'urady',
        law: '§ 5 odst. 2 zákona č. 329/1999 Sb., o cestovních dokladech',
        durationDays: 30,
        type: 'days',
        description: 'Cestovní pas se ve standardní lhůtě vyžaduje do 30 dnů od podání žádosti.',
        startTrigger: 'Den podání žádosti o pas'
    },
    // Nově přidané (úřady, doprava)
    {
        id: 'oznameni-zmeny-videni-vlasnictvi-vozidla',
        title: 'Lhůta pro oznámení změny vlastníka vozidla (přepis auta)',
        category: 'urady',
        law: '§ 8 odst. 2 zákona o podmínkách provozu vozidel na pozemních komunikacích (č. 56/2001 Sb.)',
        durationDays: 10,
        type: 'days',
        description: 'Žádost o zápis změny vlastníka silničního vozidla musí být podána do 10 pracovních dnů od převodu.',
        startTrigger: 'Den převodu vlastnického práva (podpis smlouvy / předání)'
    },
    {
        id: 'lhuta-prodlouzeni-informace-106',
        title: 'Maximální prodloužení lhůty úřadu pro poskytnutí informace (106/1999 Sb.)',
        category: 'urady',
        law: '§ 14 odst. 7 zákona č. 106/1999 Sb.',
        durationDays: 10,
        type: 'days',
        description: 'Povinný subjekt může ze závažných důvodů prodloužit lhůtu pro poskytnutí informace nejvýše o 10 dnů.',
        startTrigger: 'Uplynutí původní 15denní lhůty'
    },
    {
        id: 'lhuta-odvolani-stavebni-zrychlene',
        title: 'Lhůta pro vydání vyjádření dotčeného orgánu ve stavebním řízení',
        category: 'urady',
        law: '§ 176 nového stavebního zákona (č. 283/2021 Sb.)',
        durationDays: 30,
        type: 'days',
        description: 'Dotčený orgán vydá závazné stanovisko do 30 dnů ode dne doručení žádosti.',
        startTrigger: 'Den doručení žádosti dotčenému orgánu'
    },
    {
        id: 'vyrizeni-petice-uradem',
        title: 'Lhůta úřadu pro vyřízení petice občanů',
        category: 'urady',
        law: '§ 5 odst. 2 zákona o právu petičním (č. 85/1990 Sb.)',
        durationDays: 30,
        type: 'days',
        description: 'Státní orgán je povinen posoudit obsah petice a písemně odpovědět tomu, kdo ji podal, do 30 dnů.',
        startTrigger: 'Den doručení petice úřadu'
    },
    {
        id: 'lhuta-výměna-ridicskeho-prukazu-vyprsena',
        title: 'Lhůta pro podání žádosti o výměnu řidičského průkazu před vypršením',
        category: 'urady',
        law: '§ 110 odst. 2 zákona o silničním provozu (č. 361/2000 Sb.)',
        durationDays: 90,
        type: 'days',
        description: 'O výměnu řidičského průkazu z důvodu skončení platnosti lze požádat nejdříve 3 měsíce před vypršením.',
        startTrigger: '3 měsíce před vypršením platnosti řidičáku'
    },
    {
        id: 'lhuta-namitka-ztrata-bodu-ridic',
        title: 'Podání námitek proti zaznamenání bodů v registru řidičů',
        category: 'urady',
        law: '§ 123f odst. 1 zákona o silničním provozu',
        durationDays: 15,
        type: 'days',
        description: 'Nesouhlasí-li řidič s prováděným záznamem bodů, může podat písemné námitky příslušnému úřadu do 15 dnů.',
        startTrigger: 'Den doručení oznámení o dosažení bodového limitu / záznamu'
    },
    {
        id: 'stiznost-na-postup-spravniho-organu',
        title: 'Stížnost podle § 175 správního řádu na nevhodné chování úředníka',
        category: 'urady',
        law: '§ 175 odst. 1 a 4 správního řádu',
        durationDays: 60,
        type: 'days',
        description: 'Dotčené osoby mají právo obracet se na správní orgány se stížnostmi. Úřad musí stížnost vyřídit do 60 dnů.',
        startTrigger: 'Den doručení stížnosti správnímu orgánu'
    },
    {
        id: 'prekluze-spravniho-trestani-absolutni',
        title: 'Absolutní majetková prekluzivní lhůta pro zánik odpovědnosti za přestupek',
        category: 'urady',
        law: '§ 32 odst. 3 zákona o odpovědnosti za přestupky',
        durationYears: 3,
        type: 'years',
        description: 'Odpovědnost za přestupek zaniká nejpozději uplynutím 3 let (u závažných přestupků 5 let) od jeho spáchání i při přerušení.',
        startTrigger: 'Den spáchání přestupku'
    },

    // ==========================================
    // --- 5. OBČANSKÉ PRÁVO A CIVILNÍ PROCES (79–107) ---
    // ==========================================
    {
        id: 'zralost-promlceni-obecne',
        title: 'Obecná promlčecí lhůta majetkových práv',
        category: 'obcanske-pravo',
        law: '§ 629 odst. 1 občanského zákoníku',
        durationYears: 3,
        type: 'years',
        description: 'Promlčecí lhůta je trvání 3 let a běží ode dne, kdy právo mohlo být uplatněno poprvé.',
        startTrigger: 'Den následující po splatnosti nebo rozhodné události'
    },
    {
        id: 'odvolani-civilni-soud',
        title: 'Odvolání proti rozsudku okresního / krajského soudu',
        category: 'obcanske-pravo',
        law: '§ 204 odst. 1 občanského soudního řádu (č. 99/1963 Sb.)',
        durationDays: 15,
        type: 'days',
        description: 'Odvolání se podává do 15 dnů od doručení písemného vyhotovení rozsudku u soudu, proti jehož rozsudku směřuje.',
        startTrigger: 'Den doručení písemného vyhotovení rozsudku'
    },
    {
        id: 'odpor-platebni-rozkaz',
        title: 'Odpor proti platebnímu rozkazu / elektronickému platebnímu rozkazu',
        category: 'obcanske-pravo',
        law: '§ 172 odst. 1 občanského soudního řádu',
        durationDays: 15,
        type: 'days',
        description: 'Žalovaný může podat proti platebnímu rozkazu odpor do 15 dnů ode dne jeho doručení.',
        startTrigger: 'Den doručení platebního rozkazu žalovanému'
    },
    {
        id: 'dovolani-obcanske-rizeni',
        title: 'Dovolání k Nejvyššímu soudu ČR',
        category: 'obcanske-pravo',
        law: '§ 240 odst. 1 občanského soudního řádu',
        durationMonths: 2,
        type: 'months',
        description: 'Dovolání se podává do dvou měsíců od doručení rozhodnutí odvolacího soudu u soudu prvního stupně.',
        startTrigger: 'Den doručení rozhodnutí odvolacího soudu'
    },
    {
        id: 'zaloba-obnova-rizeni-civil',
        title: 'Žaloba na obnovu řízení (civilní proces)',
        category: 'obcanske-pravo',
        law: '§ 233 odst. 1 občanského soudního řádu',
        durationMonths: 3,
        type: 'months',
        description: 'Žalobu na obnovu řízení lze podat do 3 měsíců ode dne, kdy ten, kdo obnovu navrhuje, se dozvěděl o důvodu obnovy.',
        startTrigger: 'Den dozvězení se o důvodu obnovy'
    },
    {
        id: 'odpovednost-za-skodu-reklamace-dila',
        title: 'Uplatnění práv z vad díla (zhotovení stavby / opravy)',
        category: 'obcanske-pravo',
        law: '§ 2629 odst. 1 občanského zákoníku',
        durationYears: 2,
        type: 'years',
        description: 'Soud nepřizná právo z vady díla, pokud objednatel neoznámil vady bez zbytečného odkladu, nejpozději do 2 let od převzetí.',
        startTrigger: 'Den převzetí předmětu díla'
    },
    {
        id: 'objektivni-promlceni-skody',
        title: 'Objektivní promlčecí lhůta u náhrady škody',
        category: 'obcanske-pravo',
        law: '§ 636 občanského zákoníku',
        durationYears: 10,
        type: 'years',
        description: 'Právo na náhradu škody se promlčí nejpozději za 10 let ode dne, kdy škoda vznikla.',
        startTrigger: 'Den vzniknutí škody'
    },
    {
        id: 'subjektivni-promlceni-skody',
        title: 'Subjektivní promlčecí lhůta u náhrady škody',
        category: 'obcanske-pravo',
        law: '§ 636 občanského zákoníku',
        durationYears: 3,
        type: 'years',
        description: 'Právo na náhradu škody se promlčí za 3 roky ode dne, kdy se poškozený dozvěděl o škodě a o tom, kdo za ni odpovídá.',
        startTrigger: 'Den dozvězení se o škodě a škůdci'
    },
    {
        id: 'namitky-proti-exekuci',
        title: 'Návrh na zastavení exekuce',
        category: 'obcanske-pravo',
        law: '§ 55 exekučního řádu (č. 120/2001 Sb.)',
        durationDays: 15,
        type: 'days',
        description: 'Návrh na zastavení exekuce lze podat do 15 dnů ode dne, kdy se povinný dozvěděl o důvodu pro zastavení.',
        startTrigger: 'Den dozvězení se o důvodu pro zastavení'
    },
    {
        id: 'vypoved-pojisteni-do-dva-mesice',
        title: 'Výpověď pojistné smlouvy do 2 měsíců od uzavření',
        category: 'obcanske-pravo',
        law: '§ 2805 písm. a) občanského zákoníku',
        durationMonths: 2,
        type: 'months',
        description: 'Pojištění lze vypovědět do dvou měsíců ode dne uzavření pojistné smlouvy s osmidenní výpovědní dobou.',
        startTrigger: 'Den uzavření pojistné smlouvy'
    },
    {
        id: 'vydrzeni-nemovitosti',
        title: 'Lhůta pro řádné vydržení vlastnického práva k nemovitosti',
        category: 'obcanske-pravo',
        law: '§ 1091 odst. 2 občanského zákoníku',
        durationYears: 10,
        type: 'years',
        description: 'K vydržení vlastnického práva k nemovité věci je potřebná poctivá a řádná držba po dobu 10 let.',
        startTrigger: 'Den uchopení poctivé držby'
    },
    {
        id: 'vydrzeni-motech-veci',
        title: 'Lhůta pro řádné vydržení vlastnického práva k movité věci',
        category: 'obcanske-pravo',
        law: '§ 1091 odst. 1 občanského zákoníku',
        durationYears: 3,
        type: 'years',
        description: 'K vydržení vlastnického práva k movité věci je potřebná poctivá a řádná držba po dobu 3 let.',
        startTrigger: 'Den uchopení poctivé držby'
    },
    {
        id: 'promlceni-bezdvodneho-obohaceni-objektivni',
        title: 'Objektivní promlčení práva na vydání bezdůvodného obohacení',
        category: 'obcanske-pravo',
        law: '§ 638 občanského zákoníku',
        durationYears: 10,
        type: 'years',
        description: 'Právo na vydání bezdůvodného obohacení se promlčí nejpozději za 10 let ode dne, kdy k obohacení došlo.',
        startTrigger: 'Den, kdy k obohacení došlo'
    },
    {
        id: 'promlceni-pohledavky-z-smenky',
        title: 'Promlčecí doba nároků ze směnky vůči přímému dlužníkovi',
        category: 'obcanske-pravo',
        law: '§ 70 směnečného a šekového zákona (č. 191/1950 Sb.)',
        durationYears: 3,
        type: 'years',
        description: 'Směnečné nároky vůči příjemci se promlčují ve 3 letech ode dne splatnosti směnky.',
        startTrigger: 'Den splatnosti směnky'
    },
    {
        id: 'lhuta-vypoved-pojiseni-ke-konci-obdobi',
        title: 'Výpověď pojištění ke konci pojistného období',
        category: 'obcanske-pravo',
        law: '§ 2807 občanského zákoníku',
        durationDays: 6,
        type: 'days',
        description: 'Výpověď musí být doručena alespoň 6 týdnů před uplynutím pojistného období.',
        startTrigger: '6 týdnů před koncem pojistného roku'
    },
    {
        id: 'nahrada-skody-na-odlozenych-vecech',
        title: 'Lhůta pro uplatnění práva na náhradu škody na odložených věcech',
        category: 'obcanske-pravo',
        law: '§ 2945 občanského zákoníku',
        durationDays: 15,
        type: 'days',
        description: 'Právo na náhradu škody musí poškozený u provozovatele uplatnit bez zbytečného odkladu, nejpozději do 15 dnů.',
        startTrigger: 'Den, kdy se poškozený o škodě dozvěděl'
    },
    // Nově přidané (občanské právo)
    {
        id: 'zaloba-proti-zahajeni-exekuce-vyzva',
        title: 'Lhůta pro dobrovolné splnění povinnosti po doručení výzvy exekutora',
        category: 'obcanske-pravo',
        law: '§ 46 odst. 6 exekučního řádu (č. 120/2001 Sb.)',
        durationDays: 30,
        type: 'days',
        description: 'Splní-li povinný vymáhaný nárok do 30 dnů od doručení výzvy, má nárok na 50% snížení odměny exekutora.',
        startTrigger: 'Den doručení výzvy k dobrovolnému plnění'
    },
    {
        id: 'subjektivni-promlceni-bezdvodneho-obohaceni',
        title: 'Subjektivní promlčení práva na vydání bezdůvodného obohacení',
        category: 'obcanske-pravo',
        law: '§ 638 odst. 1 občanského zákoníku',
        durationYears: 3,
        type: 'years',
        description: 'Právo na vydání bezdůvodného obohacení se promlčí za 3 roky ode dne, kdy se ochuzený dozví o obohacení a obohaceném.',
        startTrigger: 'Den zjištění bezdůvodného obohacení a totožnosti obohaceného'
    },
    {
        id: 'zaloba-na-ochranu-rusene-drzby',
        title: 'Lhůta pro podání žaloby na ochranu rušené držby (posessorní žaloba)',
        category: 'obcanske-pravo',
        law: '§ 1040 odst. 2 / § 621 občanského zákoníku',
        durationDays: 6,
        type: 'days',
        description: 'Držitel se může domáhat ochrany u soudu v subjektivní lhutě 6 týdnů (nejpozději do 1 roku objektivně).',
        startTrigger: 'Den, kdy se držitel dozvěděl o rušení držby'
    },
    {
        id: 'lhuta-promlceni-pohledavky-priznane-soudem',
        title: 'Promlčecí lhůta práv přiznaných rozhodnutím soudu (exekuční titul)',
        category: 'obcanske-pravo',
        law: '§ 640 občanského zákoníku',
        durationYears: 10,
        type: 'years',
        description: 'Právo přiznané rozhodnutím orgánu veřejné moci (rozsudek, plat. rozkaz) se promlčuje za 10 let ode dne vykonatelnosti.',
        startTrigger: 'Den vykonatelnosti soudního rozhodnutí'
    },
    {
        id: 'vypoved-darovaci-smlouvy-nouze',
        title: 'Odvolání daru pro nouzi dárce',
        category: 'obcanske-pravo',
        law: '§ 2068 občanského zákoníku',
        durationDays: 0,
        type: 'immediate',
        description: 'Upadne-li dárce po darování do takové nouze, že nemá ani na nutnou výživu, může dar odvolat bezprostředně.',
        startTrigger: 'Vznik stavu nouze dárce'
    },
    {
        id: 'odvolani-daru-pro-nevdik',
        title: 'Lhůta pro odvolání daru pro nevděk obdarovaného',
        category: 'obcanske-pravo',
        law: '§ 2075 odst. 1 občanského zákoníku',
        durationYears: 1,
        type: 'years',
        description: 'Dárce může dar pro nevděk odvolat do 1 roku ode dne, kdy obdarovaný dárci ublížil nebo kdy se o tom dárce dozvěděl.',
        startTrigger: 'Den ublížení dárci nebo zjištění nevděku'
    },
    {
        id: 'nahrada-skody-zvlaste-zavazne-ulobky-zvirata',
        title: 'Lhůta pro uplatnění škody způsobené zvířetem',
        category: 'obcanske-pravo',
        law: '§ 2933 občanského zákoníku',
        durationYears: 3,
        type: 'years',
        description: 'Vlastník zvířete nahradí škodu jím způsobenou. Uplatnění podléhá běžné 3leté subjektivní promlčecí lhůtě.',
        startTrigger: 'Den dozvězení se o škodě a vlastníku zvířete'
    },
    {
        id: 'stiznost-proti-uzneseni-soudniho-exekutora',
        title: 'Námitky proti příkazu k úhradě nákladů exekuce',
        category: 'obcanske-pravo',
        law: '§ 88 odst. 3 exekučního řádu',
        durationDays: 8,
        type: 'days',
        description: 'Proti příkazu k úhradě nákladů exekuce může účastník podat námitky do 8 dnů od jeho doručení.',
        startTrigger: 'Den doručení příkazu k úhradě nákladů'
    },
    {
        id: 'lhuta-proti-zalobe-na-zamitnuti-vymery-lhuty',
        title: 'Lhůta pro vyjádření žalovaného na výzvu soudu (kvalifikovaná výzva)',
        category: 'obcanske-pravo',
        law: '§ 114b odst. 2 občanského soudního řádu',
        durationDays: 30,
        type: 'days',
        description: 'Určí-li soud kvalifikovanou výzvou lhůtu k vyjádření, nesmí být kratší než 30 dnů od doručení výzvy.',
        startTrigger: 'Den doručení kvalifikované výzvy soudu'
    },
    {
        id: 'mimořadne-vydrzeni-veci',
        title: 'Lhůta pro mimořádné vydržení vlastnického práva (bez poctivého titulu)',
        category: 'obcanske-pravo',
        law: '§ 1095 občanského zákoníku',
        durationYears: 20,
        type: 'years',
        description: 'Uplyne-li doba dvojnásobně dlouhá než u běžného vydržení (20 let u nemovitostí, 6 let u movitostí), vydrží držitel právo i bez prokázání právního důvodu, nebylo-li držení nepoctivé.',
        startTrigger: 'Den uchopení držby'
    },

    // ==========================================
    // --- 6. TRESTNÍ PRÁVO A PROCES (108–123) ---
    // ==========================================
    {
        id: 'promlceni-tc-3roky',
        title: 'Promlčení trestnosti trestného činu (3 roky - přečiny)',
        category: 'trestni-pravo',
        law: '§ 34 odst. 1 písm. e) trestního zákoníku (č. 40/2009 Sb.)',
        durationYears: 3,
        type: 'years',
        description: 'Trestnost zaniká uplynutím promlčecí doby 3 let u méně závažných trestných činů s horní hranicí sazby pod 3 roky.',
        startTrigger: 'Den dokonání trestného činu'
    },
    {
        id: 'promlceni-tc-5let',
        title: 'Promlčení trestnosti trestného činu (5 let)',
        category: 'trestni-pravo',
        law: '§ 34 odst. 1 písm. d) trestního zákoníku',
        durationYears: 5,
        type: 'years',
        description: 'Promlčecí doba činí 5 let, činí-li horní hranice trestní sazby odnětí svobody nejméně 3 roky.',
        startTrigger: 'Den dokonání trestného činu'
    },
    {
        id: 'promlceni-tc-10let',
        title: 'Promlčení trestnosti trestného činu (10 let - zločiny)',
        category: 'trestni-pravo',
        law: '§ 34 odst. 1 písm. c) trestního zákoníku',
        durationYears: 10,
        type: 'years',
        description: 'Promlčecí doba činí 10 let, činí-li horní hranice trestní sazby odnětí svobody nejméně 5 let.',
        startTrigger: 'Den dokonání trestného činu'
    },
    {
        id: 'promlceni-tc-15let',
        title: 'Promlčení trestnosti trestného činu (15 let - závažné zločiny)',
        category: 'trestni-pravo',
        law: '§ 34 odst. 1 písm. b) trestního zákoníku',
        durationYears: 15,
        type: 'years',
        description: 'Promlčecí doba činí 15 let, činí-li horní hranice trestní sazby odnětí svobody nejméně 10 let.',
        startTrigger: 'Den dokonání trestného činu'
    },
    {
        id: 'promlceni-tc-30let',
        title: 'Promlčení trestnosti trestného činu (30 let - výjimečné tresty)',
        category: 'trestni-pravo',
        law: '§ 34 odst. 1 písm. a) trestního zákoníku',
        durationYears: 30,
        type: 'years',
        description: 'Promlčecí doba činí 30 let u trestných činů, za které lze uložit výjimečný trest nebo vraždu.',
        startTrigger: 'Den dokonání trestného činu'
    },
    {
        id: 'odvolani-trestni-prikaz',
        title: 'Odpor proti trestnímu příkazu',
        category: 'trestni-pravo',
        law: '§ 314g trestního řádu (zákon č. 141/1961 Sb.)',
        durationDays: 8,
        type: 'days',
        description: 'Proti trestnímu příkazu může obviněný nebo státní zástupce podat odpor do 8 dnů od jeho doručení.',
        startTrigger: 'Den následující po dni doručení trestního příkazu'
    },
    {
        id: 'odvolani-trestni-rozsudek',
        title: 'Odvolání proti rozsudku v trestním řízení',
        category: 'trestni-pravo',
        law: '§ 248 odst. 1 trestního řádu',
        durationDays: 8,
        type: 'days',
        description: 'Odvolání se podává u soudu, proti jehož rozsudku směřuje, do 8 dnů od doručení opisu rozsudku.',
        startTrigger: 'Den následující po dni doručení opisu rozsudku'
    },
    {
        id: 'stiznost-usneseni-trestni',
        title: 'Stížnost proti usnesení v trestním řízení (např. vazba / zahájení stíhání)',
        category: 'trestni-pravo',
        law: '§ 137 odst. 2 trestního řádu',
        durationDays: 3,
        type: 'days',
        description: 'Stížnost se podává u orgánu, proti jehož usnesení směřuje, do 3 dnů od oznámení usnesení.',
        startTrigger: 'Den následující po dni oznámení usnesení'
    },
    {
        id: 'dovolani-trestni-rizeni',
        title: 'Dovolání v trestním řízení k Nejvyššímu soudu',
        category: 'trestni-pravo',
        law: '§ 265e odst. 1 trestního řádu',
        durationMonths: 2,
        type: 'months',
        description: 'Dovolání se podává u soudu, který rozhodl v prvním stupni, do 2 měsíců od doručení rozhodnutí.',
        startTrigger: 'Den doručení rozhodnutí odvolacího soudu'
    },
    {
        id: 'promlceni-výkonu-trestu-5let',
        title: 'Promlčení výkonu trestu (5 let - kratší tresty)',
        category: 'trestni-pravo',
        law: '§ 94 odst. 1 písm. d) trestního zákoníku',
        durationYears: 5,
        type: 'years',
        description: 'Uložený trest odnětí svobody do 2 let nelze vykonat po uplynutí promlčecí doby 5 let.',
        startTrigger: 'Den právní moci rozsudku'
    },
    {
        id: 'promlceni-vykonu-trestu-20let',
        title: 'Promlčení výkonu trestu (20 let - těžké tresty)',
        category: 'trestni-pravo',
        law: '§ 94 odst. 1 písm. b) trestního zákoníku',
        durationYears: 20,
        type: 'years',
        description: 'Trest odnětí svobody v trvání nejméně 10 let nelze vykonat po uplynutí 20 let.',
        startTrigger: 'Den právní moci rozsudku'
    },
    // Nově přidané (trestní právo)
    {
        id: 'lhuta-zadrzeni-pcr-max',
        title: 'Maximální lhůta pro zadržení osoby policií bez rozhodnutí soudu',
        category: 'trestni-pravo',
        law: 'Čl. 8 odst. 3 Listiny základních práv a svobod / § 76 trestního řádu',
        durationDays: 48,
        type: 'days',
        description: 'Zadrženou osobu musí policie do 48 hodin propustit na svobodu nebo odevzdat soudu s návrhem na vzatí do vazby.',
        startTrigger: 'Okamžik faktického omezení osobní svobody'
    },
    {
        id: 'lhuta-rozhodnuti-soudce-o-vazbe',
        title: 'Lhůta pro rozhodnutí soudce o vzatí odevzdané osoby do vazby',
        category: 'trestni-pravo',
        law: 'Čl. 8 odst. 3 Listiny / § 77 odst. 2 trestního řádu',
        durationDays: 24,
        type: 'days',
        description: 'Soudce je povinen odevzdanou zadrženou osobu vyslechnout a rozhodnout o vazbě do 24 hodin od převzetí.',
        startTrigger: 'Okamžik převzetí osoby soudem'
    },
    {
        id: 'lhuta-zadost-o-zahlazeni-odsouzeni-3roky',
        title: 'Žádost o zahlazení odsouzení (výmaz z rejstříku trestu - kratší tresty)',
        category: 'trestni-pravo',
        law: '§ 105 odst. 1 písm. c) trestního zákoníku',
        durationYears: 3,
        type: 'years',
        description: 'Soud zahladí odsouzení k trestu odnětí svobody nepřevyšujícímu 1 rok, vedl-li odsouzený po výkonu trestu řádný život po dobu 3 let.',
        startTrigger: 'Den skončení výkonu trestu'
    },
    {
        id: 'lhuta-zadost-o-podminecne-propusteni-polovina',
        title: 'Žádost o podmíněné propuštění z výkonu trestu odnětí svobody (standard)',
        category: 'trestni-pravo',
        law: '§ 88 odst. 1 trestního zákoníku',
        durationMonths: 0,
        type: 'immediate',
        description: 'Odsouzený může být podmíněně propuštěn po výkonu poloviny uloženého trestu odnětí svobody.',
        startTrigger: 'Odpykání 1/2 výměry uloženého trestu'
    },
    {
        id: 'lhuta-zadost-o-podminecne-propusteni-tretina',
        title: 'Žádost o podmíněné propuštění u přečinů (prvoodevzaní)',
        category: 'trestni-pravo',
        law: '§ 88 odst. 1 písm. a) trestního zákoníku',
        durationMonths: 0,
        type: 'immediate',
        description: 'Odsouzený za přečin, který dosud nebyl ve výkonu trestu, může žádat o podmíněné propuštění již po odpykání 1/3 trestu.',
        startTrigger: 'Odpykání 1/3 výměry uloženého trestu'
    },

    // ==========================================
    // --- 7. OBCHODNÍ PRÁVO, DAŇOVÉ ŘÍZENÍ A INSOLVENCE (124–142) ---
    // ==========================================
    {
        id: 'lhuta-zaplaceni-dane',
        title: 'Lhůta pro podání přiznání k dani z příjmů (fyzické osoby)',
        category: 'obchodni-pravo',
        law: '§ 136 daňového řádu (zákon č. 280/2009 Sb.)',
        durationMonths: 3,
        type: 'fixed_date',
        description: 'Standardně do 1. dubna (resp. 2. května elektronicky / 1. července s daňovým poradcem).',
        startTrigger: 'Konec zdaňovacího období (31. prosince)'
    },
    {
        id: 'pohledavka-insolvencni-rizeni',
        title: 'Přihláška pohledávky do insolvenčního řízení',
        category: 'obchodni-pravo',
        law: '§ 136 odst. 2 insolvenčního zákona (č. 182/2006 Sb.)',
        durationMonths: 2,
        type: 'months',
        description: 'Lhůta činí 2 měsíce od rozhodnutí o úpadku zveřejněného v insolvenčním rejstříku.',
        startTrigger: 'Zveřejnění rozhodnutí o úpadku v ISIR'
    },
    {
        id: 'odvolani-danove-rizeni',
        title: 'Odvolání proti platebnímu výměru (Finanční úřad)',
        category: 'obchodni-pravo',
        law: '§ 109 odst. 1 daňového řádu (č. 280/2009 Sb.)',
        durationDays: 30,
        type: 'days',
        description: 'Příjemce rozhodnutí se může odvolat do 30 dnů ode dne doručení platebního výměru.',
        startTrigger: 'Den doručení platebního výměru'
    },
    {
        id: 'neplatnost-usneseni-valne-hromady',
        title: 'Dovolání se neplatnosti usnesení valné hromady s.r.o. / a.s.',
        category: 'obchodni-pravo',
        law: '§ 191 zákona o obchodních korporacích (č. 90/2012 Sb.)',
        durationMonths: 3,
        type: 'months',
        description: 'Právo dovolat se neplatnosti usnesení zaniká, není-li uplatněno u soudu do 3 měsíců ode dne přijetí nebo doručení.',
        startTrigger: 'Den konání valné hromady nebo doručení rozhodnutí'
    },
    {
        id: 'dohoda-o-konkurencni-dolozce',
        title: 'Maximální délka konkurenční doložky v zaměstnání',
        category: 'obchodni-pravo',
        law: '§ 310 odst. 1 zákoníku práce',
        durationYears: 1,
        type: 'years',
        description: 'Konkurenční doložku lze sjednat nejdéle na dobu 1 roku po skončení zaměstnání.',
        startTrigger: 'Den skončení pracovního poměru'
    },
    {
        id: 'preziskatelnost-vady-obchodni-smlouva',
        title: 'Oznámení skryté vady kupujícího v podnikatelském vztahu (B2B)',
        category: 'obchodni-pravo',
        law: '§ 2112 občanského zákoníku',
        durationYears: 2,
        type: 'years',
        description: 'Neoznámí-li kupující podnikatel skrytou vadu bez zbytečného odkladu, nejpozději do 2 let, soud mu právo nepřizná.',
        startTrigger: 'Den odevzdání věci'
    },
    {
        id: 'promlceni-vymery-dane',
        title: 'Lhůta pro stanovení daně (prekluze daně)',
        category: 'obchodni-pravo',
        law: '§ 148 odst. 1 daňového řádu',
        durationYears: 3,
        type: 'years',
        description: 'Daň nelze stanovit po uplynutí lhůty 3 let, která začíná běžet dnem, v němž uplynula lhůta pro podání daňového přiznání.',
        startTrigger: 'Den uplynutí lhůty pro daňové přiznání'
    },
    {
        id: 'promlceni-vyberu-danoveho-nedoplatku',
        title: 'Lhůta pro placení daně (vybírání daňového nedoplatku)',
        category: 'obchodni-pravo',
        law: '§ 160 odst. 1 daňového řádu',
        durationYears: 6,
        type: 'years',
        description: 'Právo vybrat daňový nedoplatek se promlčuje za 6 let od splatnosti daně.',
        startTrigger: 'Den splatnosti daně'
    },
    {
        id: 'zalozeni-sro-zapis-do-or',
        title: 'Lhůta pro podání návrhu na zápis s.r.o. do obchodního rejstříku',
        category: 'obchodni-pravo',
        law: '§ 11 zákona o veřejných rejstřících (č. 304/2013 Sb.)',
        durationMonths: 6,
        type: 'months',
        description: 'Návrh na zápis musí být podán do 6 měsíců od založení společnosti, jinak zakladatelské právní jednání zaniká.',
        startTrigger: 'Den založení zakladatelskou listinou / společenskou smlouvou'
    },
    {
        id: 'lhuta-napadnout-vystoupeni-ze-spolecnosti',
        title: 'Lhůta pro podání námitky proti vyloučení společníka',
        category: 'obchodni-pravo',
        law: '§ 206 zákona o obchodních korporacích',
        durationMonths: 3,
        type: 'months',
        description: 'Vyloučený společník se může navrhnout soudu zrušení rozhodnutí o vyloučení do 3 měsíců.',
        startTrigger: 'Den doručení rozhodnutí o vyloučení'
    },
    {
        id: 'lhuta-namitky-veřejne-zakazky',
        title: 'Lhůta pro podání námitek proti zadávací dokumentaci veřejné zakázky',
        category: 'obchodni-pravo',
        law: '§ 242 odst. 4 zákona o zadávání veřejných zakázek (č. 134/2016 Sb.)',
        durationDays: 15,
        type: 'days',
        description: 'Námitky proti zadávací dokumentaci musí být doručeny zadavateli nejpozději do skončení lhůty pro podání nabídek.',
        startTrigger: 'Konec lhůty pro podání nabídek'
    },
    {
        id: 'popreni-pohledavky-prihlasenym-veritelem',
        title: 'Popření pohledávky přihlášeným věřitelem v insolvenci',
        category: 'obchodni-pravo',
        law: '§ 200 insolvenčního zákona',
        durationDays: 15,
        type: 'days',
        description: 'Přihlášený věřitel může popřít pohledávku jiného věřitele nejpozději při přezkumném jednání nebo do 15 dnů.',
        startTrigger: 'Zveřejnění výsledku přezkumu v ISIR'
    },
    {
        id: 'autorske-pravo-doba-trvani',
        title: 'Doba trvání majetkových autorských práv',
        category: 'obchodni-pravo',
        law: '§ 27 odst. 1 autorského zákona (č. 121/2000 Sb.)',
        durationYears: 70,
        type: 'years',
        description: 'Majetková práva autora trvají po dobu autorova života a 70 let po jeho smrti.',
        startTrigger: '1. leden roku následujícího po smrti autora'
    },
    // Nově přidané (obchod, daň, insolvence)
    {
        id: 'dph-kontrolni-hlaseni-lhuta-vyzva',
        title: 'Lhůta pro reakci na výzvu finančního úřadu k kontrolnímu hlášení DPH',
        category: 'obchodni-pravo',
        law: '§ 101g odst. 2 zákona o DPH (č. 235/2004 Sb.)',
        durationDays: 5,
        type: 'days',
        description: 'Plátce DPH je povinen odpovědět na výzvu k odstranění pochybností kontrolního hlášení do 5 pracovních dnů od doručení.',
        startTrigger: 'Den doručení výzvy do datové schránky'
    },
    {
        id: 'moratorium-insolvence-trvani',
        title: 'Maximální délka trvání moratoria před zahájením insolvenčního řízení',
        category: 'obchodni-pravo',
        law: '§ 115 insolvenčního zákona',
        durationMonths: 3,
        type: 'months',
        description: 'Moratorium vyhlášené soudem na návrh dlužníka trvá nejvýše 3 měsíce.',
        startTrigger: 'Vyhlášení moratoria v insolvenčním rejstříku'
    },
    {
        id: 'podani-priznani-dph-mesicni',
        title: 'Lhůta pro podání daňového přiznání k DPH a úhradu daně',
        category: 'obchodni-pravo',
        law: '§ 101 zákona o DPH',
        durationDays: 25,
        type: 'days',
        description: 'Přiznání k DPH se podává a daň je splatná do 25 dnů po skončení zdaňovacího období (měsíce/čtvrtletí).',
        startTrigger: 'Konec zdaňovacího období (poslední den měsíce)'
    },
    {
        id: 'zverejneni-uzavierky-obchodni-rejstrik',
        title: 'Lhůta pro založení účetní závěrky do sbírky listin obchodního rejstříku',
        category: 'obchodni-pravo',
        law: '§ 21a zákona o účetnictví (č. 563/1991 Sb.)',
        durationMonths: 12,
        type: 'months',
        description: 'Účetní jednotka založí schválenou účetní závěrku do sbírky listin nejpozději do 12 měsíců od rozvahového dne.',
        startTrigger: 'Rozvahový den (zpravidla 31. prosince)'
    },
    {
        id: 'lhuta-vypoved-licencni-smlouvy-neurcito',
        title: 'Výpovědní doba licenční smlouvy sjednané na dobu neurčitou',
        category: 'obchodni-pravo',
        law: '§ 2370 občanského zákoníku',
        durationMonths: 1,
        type: 'months',
        description: 'Není-li sjednáno jinak, nabývá výpověď licenční smlouvy účinnosti ke konci kalendářního měsíce následujícího po doručení.',
        startTrigger: 'Den doručení výpovědi'
    },
    {
        id: 'uplatneni-prava-z-ochranne-znatky-namitky',
        title: 'Lhůta pro podání námitek proti zápisu ochranné známky u ÚPV',
        category: 'obchodni-pravo',
        law: '§ 7 zákona o ochranných známkách (č. 441/2003 Sb.)',
        durationMonths: 3,
        type: 'months',
        description: 'Vlastník starší ochranné známky může podat námitky proti zápisu přihlášeného označení do 3 měsíců od zveřejnění.',
        startTrigger: 'Zveřejnění přihlášky ve Věstníku ÚPV'
    },

    // ==========================================
    // --- 8. RODINNÉ PRÁVO A DĚDICTVÍ (143–150) ---
    // ==========================================
    {
        id: 'odmitnuti-dedictvi',
        title: 'Lhůta pro odmítnutí dědictví',
        category: 'rodina',
        law: '§ 1487 občanského zákoníku',
        durationMonths: 1,
        type: 'months',
        description: 'Dědictví lze odmítnout do 1 měsíce ode dne, kdy byl dědic soudem nebo notářem vyrozuměn o svém právu dědictví odmítnout.',
        startTrigger: 'Den vyrozumění notářem či soudem'
    },
    {
        id: 'vzdani-se-dedictvi',
        title: 'Uplatnění výhrady soupisu pozůstalosti',
        category: 'rodina',
        law: '§ 1675 občanského zákoníku',
        durationMonths: 1,
        type: 'months',
        description: 'Dědic uplatní výhradu soupisu písemně nebo ústně do 1 měsíce ode dne vyrozumění soudem.',
        startTrigger: 'Den vyrozumění soudem nebo notářem'
    },
    {
        id: 'popreni-otcovstvi-manzel',
        title: 'Lhůta pro popření otcovství manželem matky',
        category: 'rodina',
        law: '§ 785 odst. 1 občanského zákoníku',
        durationMonths: 6,
        type: 'months',
        description: 'Manžel může popřít otcovství u soudu do 6 měsíců ode dne, kdy se dozvěděl o skutečnostech zpochybňujících otcovství.',
        startTrigger: 'Den dozvězení se o pochybnostech otcovství'
    },
    {
        id: 'popreni-otcovstvi-matka',
        title: 'Lhůta pro popření otcovství matkou dítěte',
        category: 'rodina',
        law: '§ 789 občanského zákoníku',
        durationMonths: 6,
        type: 'months',
        description: 'Matka může popřít, že otcem dítěte je její manžel, do 6 měsíců od narození dítěte.',
        startTrigger: 'Den narození dítěte'
    },
    {
        id: 'vyporadani-spolecneho-jmeni-manzelu-zakon',
        title: 'Lhůta pro zákonné vypořádání SJM po rozvodu (domněnka)',
        category: 'rodina',
        law: '§ 741 občanského zákoníku',
        durationYears: 3,
        type: 'years',
        description: 'Nedojde-li do 3 let od zániku SJM k dohodě ani k podání žaloby, nastupuje zákonná domněnka vypořádání.',
        startTrigger: 'Den právní moci rozsudku o rozvodu'
    },
    {
        id: 'vydedeni-promlceni-stiznosti',
        title: 'Promlčení práva napadnout platnost závěti nebo vydědění',
        category: 'rodina',
        law: '§ 630 občanského zákoníku',
        durationYears: 3,
        type: 'years',
        description: 'Právo požadovat relativní neplatnost závěti či vydědění se promlčí v 3leté lhůtě od smrti zůstavitele.',
        startTrigger: 'Den smrti zůstavitele'
    },
    {
        id: 'odmitnuti-dedictvi-zahranici',
        title: 'Lhůta pro odmítnutí dědictví pro žijící v zahraničí',
        category: 'rodina',
        law: '§ 1487 odst. 1 občanského zákoníku',
        durationMonths: 3,
        type: 'months',
        description: 'Žije-li dědic v zahraničí nebo má-li tam jediné bydliště, činí lhůta k odmítnutí dědictví 3 měsíce.',
        startTrigger: 'Den vyrozumění notářem či soudem'
    },
    {
        id: 'zaloba-na-urceni-otcovstvi-muzem',
        title: 'Lhůta pro podání žaloby na určování otcovství neprovdané matky',
        category: 'rodina',
        law: '§ 783 občanského zákoníku',
        durationYears: 6,
        type: 'years',
        description: 'Muž, jehož otcovství nebylo určeno souhlasným prohlášením, může podat žalobu do 6 let od narození dítěte.',
        startTrigger: 'Den narození dítěte'
    }
];
