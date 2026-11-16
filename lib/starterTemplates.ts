// Základní sada vzorů pro advokáty. Jde o obecné, konzervativně psané vzory; před použitím je vždy upravte podle konkrétního případu.
// Pole {{...}} se vyplní z věci, klienta a profilu advokáta (viz lib/templates.ts), ostatní se při vyplňování zeptají.
// Značení textu (nadpisy, číslování, tabulky, podpisy) je popsáno v lib/docx.ts.
export type StarterTemplate = { id: string; title: string; category: string; description: string; note: string; body: string };

export const STARTER_CATEGORIES = ['Smlouvy a plné moci', 'Klient a poučení', 'Výzvy a dohody', 'Podání a žádosti'] as const;

export const STARTER_TEMPLATES: StarterTemplate[] = [
    {
        id: 'smlouva-pravni-sluzby',
        title: 'Smlouva o poskytování právních služeb',
        category: 'Smlouvy a plné moci',
        description: 'Obecná smlouva advokáta s klientem: rozsah služeb, odměna, mlčenlivost, AML, osobní údaje, ukončení.',
        note: 'Před použitím zkontrolujte: (1) způsob sjednání odměny a fakturační jednotku, (2) výši a splatnost zálohy, (3) údaje o pojištění odpovědnosti, (4) zda se na věc nevztahují zvláštní požadavky stavovských předpisů ČAK. Při spotřebitelském klientovi posuďte, zda nejsou potřeba další informační povinnosti. Odkazy na předpisy ověřte, jejich znění se mění.',
        body: `# Smlouva o poskytování právních služeb

>> č. {{cislo_smlouvy}}

uzavřená podle zákona č. 85/1996 Sb., o advokacii, a zákona č. 89/2012 Sb., občanského zákoníku, mezi smluvními stranami:

**{{advokat.jmeno}}**, advokát zapsaný v seznamu advokátů České advokátní komory pod ev. č. {{advokat.cak}}
se sídlem {{advokat.adresa}}, IČO: {{advokat.ico}}
(dále jen „**advokát**“)

a

**{{klient.jmeno}}**, {{klient.identifikace}}
bytem / se sídlem {{klient.adresa}}
(dále jen „**klient**“)

## I. Předmět smlouvy
1. Advokát se zavazuje poskytnout klientovi právní služby ve věci: {{vec.nazev}} (dále jen „věc“), a to v tomto rozsahu: {{rozsah_sluzeb}}.
2. Advokát poskytuje služby s odbornou péčí, v souladu s právními předpisy a předpisy České advokátní komory, nezávisle a v zájmu klienta. Advokát se řídí pokyny klienta, pokud nejsou v rozporu s právními předpisy nebo stavovskými předpisy.
3. Služby mimo rozsah podle odstavce 1 poskytne advokát jen na základě dalšího ujednání, které může být uzavřeno i v elektronické podobě.
4. Advokát odpovídá za řádný výkon služeb, nikoli za výsledek věci. Klient bere na vědomí, že výsledek řízení závisí také na rozhodnutí soudů a orgánů a na jednání dalších osob.

## II. Odměna a náklady
1. Odměna advokáta je sjednána jako hodinová odměna ve výši {{hodinova_sazba}} Kč bez DPH za hodinu, účtovaná za každých započatých {{fakturacni_jednotka}} minut skutečně vynaloženého času.
2. Je-li advokát plátcem daně z přidané hodnoty, připočte se k odměně a k náhradám daň v zákonné výši.
3. Vedle odměny je klient povinen hradit hotové výdaje vynaložené v souvislosti s věcí, zejména soudní a správní poplatky, znalečné, cestovné, náklady na ověření a doručování. Výdaje přesahující {{limit_vydaju}} Kč advokát předem projedná s klientem.
4. Advokát je oprávněn požadovat zálohu na odměnu a náklady. Záloha ve výši {{zaloha}} Kč je splatná do {{zaloha_splatnost}} dnů od podpisu smlouvy. Advokát ji použije na úhradu odměny a nákladů; nevyčerpanou část po skončení věci vrátí.
5. Odměnu a náklady advokát vyúčtuje {{vyuctovani_obdobi}}. Daňový doklad je splatný do {{splatnost_dnu}} dnů od vystavení na účet advokáta č. {{advokat.ucet}}. Při prodlení s úhradou je advokát oprávněn požadovat úrok z prodlení v zákonné výši.
6. Klient bere na vědomí, že náhrada nákladů řízení, kterou by soud nebo orgán přiznal klientovi proti protistraně, nemusí odpovídat sjednané odměně, a že povinnost zaplatit sjednanou odměnu tím není dotčena.

## III. Povinnosti klienta
1. Klient poskytne advokátovi pravdivé a úplné informace, listiny a součinnost potřebné pro poskytování služeb, a to včas. Za následky nepravdivých nebo neúplných podkladů odpovídá klient.
2. Klient bez zbytečného odkladu oznámí změnu kontaktních údajů a převezme doručované zásilky.
3. Klient sdělí advokátovi všechny osoby, které jsou ve věci protistranou nebo na ní mají zájem, aby advokát mohl posoudit možný střet zájmů.

## IV. Mlčenlivost a střet zájmů
1. Advokát je vázán zákonnou povinností mlčenlivosti o všech skutečnostech, o nichž se dozvěděl v souvislosti s poskytováním právních služeb. Tato povinnost trvá i po skončení smlouvy a lze ji prolomit jen v případech stanovených zákonem.
2. Advokát prohlašuje, že mu v době uzavření smlouvy není známa okolnost, která by znamenala střet zájmů bránící poskytnutí služeb.

## V. Pojištění odpovědnosti
Advokát prohlašuje, že je pojištěn pro případ odpovědnosti za škodu způsobenou při výkonu advokacie u pojišťovny {{pojistitel}}, pojistná smlouva č. {{cislo_pojistky}}, s limitem pojistného plnění {{pojistna_castka}} Kč.

## VI. Identifikace klienta a zákon č. 253/2008 Sb.
Klient bere na vědomí, že advokát je při některých činnostech povinnou osobou podle zákona č. 253/2008 Sb., o některých opatřeních proti legalizaci výnosů z trestné činnosti a financování terorismu, a je povinen klienta identifikovat a kontrolovat. Klient se zavazuje poskytnout potřebnou součinnost, zejména doklady totožnosti a informace o původu finančních prostředků. Neposkytne-li klient součinnost, je advokát oprávněn odmítnout další poskytování služeb.

## VII. Osobní údaje
Advokát zpracovává osobní údaje klienta jako správce podle nařízení (EU) 2016/679 (GDPR) a zákona o zpracování osobních údajů. Informace o zpracování osobních údajů klient obdrží samostatně a jejich převzetí potvrzuje podpisem této smlouvy.

## VIII. Komunikace
1. Advokát a klient komunikují zejména e-mailem ({{klient.email}}), telefonicky ({{klient.telefon}}), datovou schránkou nebo prostřednictvím klientského portálu.
2. Klient bere na vědomí, že elektronická komunikace přináší riziko neoprávněného přístupu třetích osob, a souhlasí s ní. Citlivé dokumenty advokát na žádost klienta zasílá zabezpečeným způsobem.
3. Písemnosti se považují za doručené třetí pracovní den po odeslání na kontaktní údaje uvedené v této smlouvě, pokud se neprokáže dřívější doručení.

## IX. Plná moc
Je-li pro poskytování služeb nutné zastupování před soudy, orgány nebo třetími osobami, udělí klient advokátovi plnou moc samostatnou listinou.

## X. Doba trvání a ukončení smlouvy
1. Smlouva se uzavírá na dobu určenou splněním věci.
2. Kterákoli strana může smlouvu vypovědět kdykoli i bez udání důvodu. Výpověď je účinná dnem doručení druhé straně.
3. Po skončení smlouvy je advokát povinen učinit neodkladné úkony potřebné k ochraně práv klienta, které nesnesou odkladu, a klient je povinen uhradit odměnu a náklady za služby poskytnuté do skončení smlouvy.

## XI. Spisy
Advokát uchovává spisy po dobu stanovenou stavovskými předpisy. Po skončení věci vrátí klientovi na jeho žádost převzaté originály listin.

## XII. Stížnosti a závěrečná ustanovení
1. Klient může podat stížnost na postup advokáta u České advokátní komory.
2. Smlouva se řídí právním řádem České republiky. Spory budou řešeny příslušnými soudy České republiky.
3. Změny smlouvy vyžadují písemnou formu, včetně elektronického podpisu, pokud se strany nedohodnou jinak.
4. Bude-li některé ustanovení smlouvy neplatné nebo neúčinné, nedotýká se to ostatních ustanovení.
5. Smlouva nabývá účinnosti dnem podpisu poslední ze stran a je vyhotovena ve dvou stejnopisech, z nichž každá strana obdrží jeden, nebo v elektronické podobě.

>> V {{misto}} dne {{datum}}

::podpisy {{klient.jmeno}}, klient | {{advokat.jmeno}}, advokát`,
    },
    {
        id: 'plna-moc-obecna',
        title: 'Plná moc k zastupování ve věci',
        category: 'Smlouvy a plné moci',
        description: 'Obecná plná moc advokáta k zastupování před soudy, správními orgány a dalšími orgány v jedné věci.',
        note: 'Před použitím zkontrolujte: (1) rozsah vyloučených úkonů (smír, uznání nároku, převzetí plnění), (2) zda daný soud nebo úřad nevyžaduje zvláštní formu (např. ověřený podpis zmocnitele u některých řízení, včetně katastru nemovitostí), (3) doplnění spisové značky, je-li už řízení vedeno. U nevýdělečných subjektů a firem doplňte oprávnění osoby, která plnou moc podepisuje.',
        body: `# Plná moc

**Zmocnitel:** {{klient.jmeno}}, {{klient.identifikace}}, {{klient.adresa}}

tímto uděluje plnou moc

**Zmocněnci:** {{advokat.jmeno}}, advokát, ev. č. ČAK {{advokat.cak}}, se sídlem {{advokat.adresa}}

aby zmocnitele zastupoval ve věci: {{vec.nazev}} (spisová značka / číslo jednací, je-li známo: {{vec.spisova_znacka}}), vedené u: {{vec.urad}}.

## Rozsah zastoupení
1. Zmocněnec je oprávněn zmocnitele zastupovat ve všech řízeních souvisejících s uvedenou věcí před soudy všech stupňů, správními a jinými orgány veřejné moci, rozhodčími orgány a ve vztahu k třetím osobám, a to v řízení před zahájením, v průběhu a po skončení řízení, včetně řízení o opravných prostředcích a vykonávacího řízení.
2. Zmocněnec je oprávněn zejména podávat návrhy, žaloby, vyjádření a opravné prostředky, činit procesní úkony, nahlížet do spisů a pořizovat z nich kopie, přijímat písemnosti a rozhodnutí, jednat s protistranou a orgány a zastupovat zmocnitele při jednáních.
3. Zmocněnec je oprávněn uzavřít smír, vzít podání zpět, vzdát se práva na opravný prostředek, uznat nárok a převzít plnění, pokud nejsou tyto úkony vyloučeny dále: {{vyloucene_ukony}}.
4. Zmocněnec je oprávněn udělit substituční plnou moc jinému advokátovi.

## Platnost
Plná moc se uděluje do odvolání, nejdéle do skončení věci včetně řízení o opravných prostředcích. Zmocnitel může plnou moc kdykoli odvolat a zmocněnec může zastoupení kdykoli vypovědět. Odvolání nebo výpověď je vůči orgánu účinné, jakmile mu je oznámeno.

Zmocněnec plnou moc v plném rozsahu přijímá.

>> V {{misto}} dne {{datum}}

::podpisy {{klient.jmeno}}, zmocnitel | {{advokat.jmeno}}, zmocněnec`,
    },
    {
        id: 'plna-moc-jednorazova',
        title: 'Plná moc k jednomu úkonu',
        category: 'Smlouvy a plné moci',
        description: 'Plná moc omezená na konkrétní úkon nebo na omezenou dobu (např. převzetí listin, nahlížení do spisu, podpis jednoho dokumentu).',
        note: 'Před použitím zkontrolujte, zda je úkon popsán dostatečně určitě. Pro úkony, u nichž zákon nebo úřad vyžaduje zvláštní formu (např. úředně ověřený podpis), formu zajistěte. Platnost pečlivě omezte na nezbytnou dobu.',
        body: `# Plná moc k jednomu úkonu

**Zmocnitel:** {{klient.jmeno}}, {{klient.identifikace}}, {{klient.adresa}}

uděluje plnou moc

**Zmocněnci:** {{advokat.jmeno}}, advokát, ev. č. ČAK {{advokat.cak}}, se sídlem {{advokat.adresa}}

k tomuto úkonu: {{ukon}}.

Plná moc se uděluje jen k uvedenému úkonu ve věci {{vec.nazev}} a jen na dobu do {{platnost_do}}. Zmocněnec není oprávněn činit jiné právní úkony za zmocnitele a nesmí udělit substituční plnou moc.

Zmocněnec plnou moc přijímá.

>> V {{misto}} dne {{datum}}

::podpisy {{klient.jmeno}}, zmocnitel | {{advokat.jmeno}}, zmocněnec`,
    },
    {
        id: 'informace-osobni-udaje',
        title: 'Informace o zpracování osobních údajů klienta',
        category: 'Klient a poučení',
        description: 'Informační povinnost advokáta jako správce podle čl. 13 GDPR a potvrzení převzetí klientem.',
        note: 'Před použitím zkontrolujte: (1) úplnost příjemců a poskytovatelů služeb, které skutečně používáte (úložiště, e-mail, účetní), (2) dobu uchování podle stavovských předpisů a AML zákona, (3) zda neprovádíte předání údajů mimo EU a EHP. Dokument je obecný; konkrétní povinnosti správce posuzujte podle své kanceláře.',
        body: `# Informace o zpracování osobních údajů klienta

podle čl. 13 nařízení (EU) 2016/679 (GDPR)

## 1. Správce
Správcem Vašich osobních údajů je {{advokat.jmeno}}, advokát, ev. č. ČAK {{advokat.cak}}, se sídlem {{advokat.adresa}}, IČO: {{advokat.ico}}. Kontakt: {{advokat.email}}, {{advokat.telefon}}.

## 2. Účely a právní základy zpracování
a) poskytování právních služeb a plnění smlouvy s Vámi (čl. 6 odst. 1 písm. b) GDPR);
b) plnění právních povinností advokáta, zejména podle zákona o advokacii, zákona č. 253/2008 Sb. a daňových a účetních předpisů (čl. 6 odst. 1 písm. c) GDPR);
c) ochrana právních nároků advokáta a jeho oprávněné zájmy, například při vymáhání odměny nebo obhajobě při stížnosti (čl. 6 odst. 1 písm. f) GDPR);
d) údaje zvláštních kategorií, pokud jsou zpracovávány, zpracováváme pro určení, výkon nebo obhajobu právních nároků (čl. 9 odst. 2 písm. f) GDPR).

## 3. Rozsah údajů
Zpracováváme zejména identifikační a kontaktní údaje, údaje o Vaší věci, listiny a informace, které nám poskytnete, a údaje získané z veřejných rejstříků nebo od soudů a orgánů, je-li to pro věc nutné.

## 4. Příjemci údajů
Údaje předáváme jen v nezbytném rozsahu soudům a orgánům veřejné moci, protistraně a jejím zástupcům, České advokátní komoře při výkonu kontroly, pojišťovně advokáta, orgánům, kterým jsme povinni údaje poskytnout na základě zákona, a poskytovatelům služeb, kteří nám pomáhají s provozem (úložiště dokumentů, e-mail, účetnictví, klientský portál). Povinnost mlčenlivosti advokáta tím není dotčena.

## 5. Doba uchování
Údaje uchováváme po dobu {{doba_uchovani}}. Poté je bezpečně vymažeme nebo anonymizujeme.

## 6. Předání mimo EU a EHP
Osobní údaje nepředáváme mimo EU a EHP, pokud není uvedeno jinak: {{treti_zeme}}.

## 7. Vaše práva
Máte právo na přístup k údajům, jejich opravu, omezení zpracování, přenositelnost a vznést námitku. Právo na výmaz lze uplatnit v rozsahu, v jakém tomu nebrání zákonné povinnosti a povinnost mlčenlivosti advokáta. Máte právo podat stížnost u Úřadu pro ochranu osobních údajů (uoou.gov.cz).

## 8. Automatizované rozhodování
Nedochází k automatizovanému rozhodování ani profilování, které by mělo právní účinky na Vás.

Potvrzuji, že jsem tuto informaci převzal(a).

>> V {{misto}} dne {{datum}}

::podpisy {{klient.jmeno}} | {{advokat.jmeno}}`,
    },
    {
        id: 'souhlas-elektronicka-komunikace',
        title: 'Souhlas s elektronickou komunikací a klientským portálem',
        category: 'Klient a poučení',
        description: 'Souhlas klienta s komunikací e-mailem a přes klientskou stránku včetně poučení o rizicích.',
        note: 'Před použitím zkontrolujte, jaké kanály skutečně používáte. Souhlas nenahrazuje zabezpečení; u zvlášť citlivých dokumentů zvažte šifrování nebo osobní předání.',
        body: `# Souhlas s elektronickou komunikací

Klient: {{klient.jmeno}}, {{klient.identifikace}}
Advokát: {{advokat.jmeno}}, ev. č. ČAK {{advokat.cak}}

## Souhlas
1. Souhlasím s tím, aby advokát se mnou komunikoval ve věci {{vec.nazev}} elektronicky, a to na e-mailovou adresu {{klient.email}}, na telefonní číslo {{klient.telefon}} a prostřednictvím klientské stránky, kterou mi advokát zpřístupní.
2. Beru na vědomí, že elektronická komunikace není vždy bezpečná. Zprávy v e-mailu mohou být zachyceny nebo doručeny nesprávné osobě. Advokát proto citlivé dokumenty zasílá přes zabezpečené úložiště, nebo je předá osobně.
3. Zavazuji se chránit přístup k své e-mailové schránce a k odkazu na klientskou stránku, nikomu ho nepředávat a oznámit advokátovi ztrátu nebo podezření na zneužití.
4. Beru na vědomí, že dokument zaslaný elektronicky se považuje za doručený okamžikem, kdy je dostupný v mé schránce nebo na klientské stránce.
5. Tento souhlas mohu kdykoli odvolat písemným oznámením advokátovi.

>> V {{misto}} dne {{datum}}

::podpisy {{klient.jmeno}} | {{advokat.jmeno}}`,
    },
    {
        id: 'zaznam-porada-pouceni',
        title: 'Záznam o poradě a poučení klienta',
        category: 'Klient a poučení',
        description: 'Záznam, co bylo s klientem projednáno, jak byl poučen o rizicích, lhůtách a nákladech, a jak se rozhodl postupovat.',
        note: 'Záznam slouží k ochraně advokáta i klienta. Vyplňte ho konkrétně (lhůty uveďte datem) a nechte klienta podepsat. Nepopisujte v něm zbytečně citlivé podrobnosti.',
        body: `# Záznam o poradě a poučení klienta

Věc: {{vec.nazev}}
Klient: {{klient.jmeno}}
Advokát: {{advokat.jmeno}}
Datum a místo porady: {{datum}}, {{misto}}

## 1. Projednaný stav
{{projednany_stav}}

## 2. Doporučený postup
{{doporuceny_postup}}

## 3. Poučení klienta
a) o možných variantách řešení a jejich rizicích: {{rizika}};
b) o lhůtách, které je třeba dodržet: {{lhuty}};
c) o předpokládaných nákladech a odměně: {{naklady}};
d) o povinnosti klienta předložit podklady a součinnost: {{podklady}}.

## 4. Úkoly
| Kdo | Úkol | Termín |
| Klient | {{ukol_klient}} | {{termin_klient}} |
| Advokát | {{ukol_advokat}} | {{termin_advokat}} |

## 5. Rozhodnutí klienta
Klient po poučení rozhodl takto: {{rozhodnuti_klienta}}.

>> V {{misto}} dne {{datum}}

::podpisy {{klient.jmeno}}, klient | {{advokat.jmeno}}, advokát`,
    },
    {
        id: 'predavaci-protokol',
        title: 'Předávací protokol listin',
        category: 'Klient a poučení',
        description: 'Protokol o předání nebo převzetí listin a věcí mezi advokátem a klientem.',
        note: 'U originálů listin uveďte jejich stav a počet stran. Při vracení spisu klientovi uveďte, že advokát si ponechává kopie.',
        body: `# Předávací protokol

Věc: {{vec.nazev}} (spisová značka: {{vec.spisova_znacka}})

**Předávající:** {{predavajici}}
**Přebírající:** {{prebirajici}}

Předávající tímto předává a přebírající přebírá tyto listiny a věci:

| Č. | Označení listiny nebo věci | Počet stran / kusů | Originál / kopie |
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |

Přebírající potvrzuje, že listiny převzal v uvedeném rozsahu a stavu. Poznámky: {{poznamky}}

>> V {{misto}} dne {{datum}}

::podpisy Předávající | Přebírající`,
    },
    {
        id: 'predzalobni-vyzva',
        title: 'Předžalobní výzva k plnění',
        category: 'Výzvy a dohody',
        description: 'Výzva dlužníkovi k zaplacení před podáním žaloby, zasílaná advokátem jménem klienta.',
        note: 'Před odesláním zkontrolujte: (1) výši jistiny a příslušenství (zákonný úrok z prodlení dopočítejte, v aplikaci je kalkulačka), (2) přiměřenost lhůty (běžně 7 až 15 dní), (3) plnou moc k zastupování, (4) způsob doručení tak, aby šlo prokázat doručení. Při spotřebitelském dluhu zvažte další požadavky.',
        body: `# Předžalobní výzva k plnění

>> V {{misto}} dne {{datum}}

**Odesílatel:** {{advokat.jmeno}}, advokát, ev. č. ČAK {{advokat.cak}}, {{advokat.adresa}}, jednající jménem klienta {{klient.jmeno}} na základě plné moci (příloha)
**Adresát:** {{dluznik_jmeno}}, {{dluznik_adresa}}

**Věc: Předžalobní výzva k zaplacení – {{vec.nazev}}**

Vážená paní, vážený pane,

zastupuji klienta {{klient.jmeno}}, {{klient.identifikace}} (dále jen „věřitel“), ve věci jeho pohledávky za Vámi.

1. Skutkový stav: {{popis_naroku}}.
2. Výše pohledávky: jistina {{castka}} Kč; dále úrok z prodlení v zákonné výši od {{den_prodleni}} do zaplacení.
3. Jménem věřitele Vás vyzývám, abyste uvedenou pohledávku uhradili nejpozději do {{lhuta_dnu}} dnů od doručení této výzvy na účet č. {{cislo_uctu}}, variabilní symbol {{vs}}.
4. Nebude-li pohledávka ve stanovené lhůtě uhrazena, věřitel bude nucen bez dalšího upozornění podat u příslušného soudu žalobu. V takovém případě bude požadovat také úrok z prodlení a náhradu nákladů řízení včetně nákladů právního zastoupení.
5. Jsem připraven projednat případné dohodnuté řešení, zejména úhradu ve splátkách. Za tím účelem mě kontaktujte na {{advokat.email}} nebo {{advokat.telefon}}.

S pozdravem

{{advokat.jmeno}}
advokát

Přílohy: plná moc; doklady k pohledávce ({{prilohy}})`,
    },
    {
        id: 'odstoupeni-od-smlouvy',
        title: 'Odstoupení od smlouvy',
        category: 'Výzvy a dohody',
        description: 'Oznámení o odstoupení od smlouvy pro podstatné porušení, odesílané klientem nebo advokátem jeho jménem.',
        note: 'Před odesláním zkontrolujte: (1) že jde o podstatné porušení nebo že odstoupení umožňuje smlouva či zákon, (2) zda nebylo potřeba dát nejprve náhradní lhůtu, (3) lhůty a formu odstoupení ve smlouvě, (4) způsob doručení tak, aby šlo prokázat, kdy odstoupení došlo druhé straně. Odstoupení je jednostranný úkon, jehož účinky těžko vzít zpět.',
        body: `# Odstoupení od smlouvy

>> V {{misto}} dne {{datum}}

**Odstupující strana:** {{klient.jmeno}}, {{klient.identifikace}}, {{klient.adresa}}
**Druhá strana:** {{druha_strana}}, {{druha_strana_adresa}}

**Věc: Odstoupení od smlouvy ze dne {{smlouva_datum}}**

1. Mezi námi byla dne {{smlouva_datum}} uzavřena smlouva {{smlouva_nazev}} (dále jen „smlouva“).
2. Druhá strana porušila smlouvu podstatným způsobem, a to tím, že: {{duvod}}.
3. Předchozí výzva k nápravě: {{predchozi_vyzva}}.
4. Podle smlouvy a podle ustanovení § 2001 a násl. občanského zákoníku od smlouvy tímto **odstupuji**. Odstoupení je účinné dnem, kdy dojde druhé straně.
5. Odstoupením se smlouva ruší. Žádám o vrácení všeho, co jste na základě smlouvy obdrželi, do {{lhuta_dnu}} dnů od doručení tohoto oznámení, a to na účet č. {{cislo_uctu}}.
6. Nárok na náhradu škody a smluvní pokuty tímto není dotčen.

{{klient.jmeno}}{{zastoupeni_poznamka}}`,
    },
    {
        id: 'uznani-dluhu-splatky',
        title: 'Uznání dluhu a dohoda o splátkách',
        category: 'Výzvy a dohody',
        description: 'Dohoda věřitele s dlužníkem: uznání dluhu co do důvodu a výše, splátkový kalendář, ztráta výhody splátek.',
        note: 'Před použitím zkontrolujte: (1) přesné označení dluhu, (2) splátkový kalendář a splatnost, (3) smluvní pokutu a úrok (ujednání, která by byla v rozporu s dobrými mravy nebo s ochranou spotřebitele, mohou být neplatná). Chcete-li dohodu použít jako exekuční titul, zvažte notářský zápis se svolením k vykonatelnosti.',
        body: `# Uznání dluhu a dohoda o splátkách

**Věřitel:** {{klient.jmeno}}, {{klient.identifikace}}, {{klient.adresa}}
**Dlužník:** {{dluznik_jmeno}}, {{dluznik_identifikace}}, {{dluznik_adresa}}

## I. Uznání dluhu
1. Dlužník tímto uznává co do důvodu i výše svůj dluh vůči věřiteli ve výši {{castka}} Kč, který vznikl z titulu {{duvod_dluhu}}.
2. Dlužník prohlašuje, že dluh je pravý, v uvedené výši trvá a že proti němu nemá námitky.

## II. Splátkový kalendář
Dlužník se zavazuje dluh uhradit na účet věřitele č. {{cislo_uctu}}, variabilní symbol {{vs}}, takto:

| Splátka | Splatnost | Částka v Kč |
| 1. | {{splatnost_1}} | {{splatka_1}} |
| 2. | {{splatnost_2}} | {{splatka_2}} |
| 3. | {{splatnost_3}} | {{splatka_3}} |

## III. Ztráta výhody splátek
Je-li dlužník v prodlení s úhradou kterékoli splátky déle než {{dny_prodleni}} dnů, stává se celý zbývající dluh splatným dnem následujícím po uplynutí této lhůty.

## IV. Příslušenství
{{urok_pokuta}}

## V. Závěrečná ustanovení
1. Uhrazením všech splátek v řádné výši a lhůtě dluh zaniká.
2. Dohoda nabývá účinnosti dnem podpisu obou stran a je vyhotovena ve dvou stejnopisech, každá strana obdrží jeden.

>> V {{misto}} dne {{datum}}

::podpisy {{klient.jmeno}}, věřitel | {{dluznik_jmeno}}, dlužník`,
    },
    {
        id: 'oznameni-o-zastoupeni',
        title: 'Oznámení o zastoupení',
        category: 'Podání a žádosti',
        description: 'Podání soudu nebo úřadu, kterým advokát oznamuje, že klienta zastupuje, přikládá plnou moc a žádá o doručování.',
        note: 'Před odesláním zkontrolujte spisovou značku a přiložení plné moci. U datové schránky uveďte její identifikátor. Pokud orgán vyžaduje plnou moc v originále nebo s ověřeným podpisem, zajistěte to.',
        body: `{{vec.urad}}

>> V {{misto}} dne {{datum}}

**Spisová značka / číslo jednací:** {{vec.spisova_znacka}}
**Věc:** {{vec.nazev}}
**Účastník / strana:** {{klient.jmeno}}, {{klient.identifikace}}

# Oznámení o zastoupení

1. Oznamuji, že ve výše uvedené věci zastupuji {{klient.jmeno}} na základě plné moci, kterou přikládám.
2. Žádám, aby byly veškeré písemnosti doručovány na adresu zástupce {{advokat.adresa}}, případně do datové schránky {{datova_schranka}}, nikoli přímo zastoupenému.
3. Žádám o umožnění nahlédnutí do spisu a o poskytnutí kopií jeho obsahu.

{{advokat.jmeno}}
advokát, ev. č. ČAK {{advokat.cak}}
{{advokat.telefon}}, {{advokat.email}}

Příloha: plná moc`,
    },
    {
        id: 'zadost-informace-106',
        title: 'Žádost o poskytnutí informace',
        category: 'Podání a žádosti',
        description: 'Žádost úřadu nebo jinému povinnému subjektu podle zákona č. 106/1999 Sb., o svobodném přístupu k informacím.',
        note: 'Před odesláním zkontrolujte, že adresát je povinným subjektem podle zákona, a formulujte požadované informace co nejpřesněji. Povinný subjekt může požadovat úhradu nákladů; v žádosti lze určit limit. Žádost lze podat i e-mailem nebo datovou schránkou.',
        body: `{{povinny_subjekt}}
{{povinny_subjekt_adresa}}

>> V {{misto}} dne {{datum}}

# Žádost o poskytnutí informace

podle zákona č. 106/1999 Sb., o svobodném přístupu k informacím

**Žadatel:** {{klient.jmeno}}, {{klient.adresa}}
zastoupený advokátem {{advokat.jmeno}}, {{advokat.adresa}}

Dobrý den,

žádám o poskytnutí těchto informací:

{{pozadovane_informace}}

Informace žádám poskytnout elektronicky na e-mail {{advokat.email}}. Pokud by poskytnutí informací bylo spojeno s úhradou nákladů, žádám o předchozí sdělení jejich výše, nejvýše však do částky {{limit_nakladu}} Kč.

Děkuji za vyřízení žádosti ve lhůtě stanovené zákonem.

S pozdravem

{{advokat.jmeno}}
advokát`,
    },
    {
        id: 'ukonceni-zastoupeni',
        title: 'Oznámení o ukončení zastoupení',
        category: 'Podání a žádosti',
        description: 'Oznámení soudu nebo úřadu, že zastoupení klienta advokátem skončilo (výpověď plné moci klientem nebo advokátem).',
        note: 'Před odesláním zkontrolujte, kdy zastoupení skutečně skončilo, a zda advokát splnil povinnost učinit neodkladné úkony. Neuvádějte důvody, které by porušovaly povinnost mlčenlivosti.',
        body: `{{vec.urad}}

>> V {{misto}} dne {{datum}}

**Spisová značka / číslo jednací:** {{vec.spisova_znacka}}
**Věc:** {{vec.nazev}}
**Účastník / strana:** {{klient.jmeno}}

# Oznámení o ukončení zastoupení

1. Oznamuji, že zastoupení {{klient.jmeno}} v uvedené věci skončilo dne {{datum_ukonceni}} {{zpusob_ukonceni}}.
2. Od uvedeného dne prosím doručujte písemnosti přímo zastoupenému na adresu {{klient.adresa}}, nebo osobě, kterou si zvolí.
3. Zastoupený je seznámen s dosud nařízenými úkony a lhůtami.

{{advokat.jmeno}}
advokát, ev. č. ČAK {{advokat.cak}}`,
    },
    {
        id: 'cestne-prohlaseni',
        title: 'Čestné prohlášení',
        category: 'Podání a žádosti',
        description: 'Obecné čestné prohlášení osoby o určité skutečnosti.',
        note: 'Čestné prohlášení musí být konkrétní a pravdivé. Pro některá řízení a úřady existují vlastní formuláře nebo zvláštní požadavky na formu (např. úředně ověřený podpis). Poučte prohlašujícího o následcích nepravdivého prohlášení.',
        body: `# Čestné prohlášení

Já, níže podepsaný(á) **{{klient.jmeno}}**, {{klient.identifikace}}, bytem / se sídlem {{klient.adresa}},

tímto čestně prohlašuji, že:

{{obsah_prohlaseni}}

Prohlášení činím svobodně, vážně a pravdivě. Jsem si vědom(a) následků nepravdivého prohlášení.

>> V {{misto}} dne {{datum}}

::podpisy {{klient.jmeno}} | `,
    },
];
