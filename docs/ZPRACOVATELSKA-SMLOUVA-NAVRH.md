# Smlouva o zpracování osobních údajů (NÁVRH)

> **Návrh připravený programem, nikoli právní služba. Před použitím jej musí zkontrolovat a upravit advokát.** Položky v hranatých závorkách jsou k doplnění. Struktura vychází z čl. 28 nařízení (EU) 2016/679 (GDPR).

**Správce:** [jméno advokáta nebo název kanceláře, IČO, adresa] (dále „Správce“)
**Zpracovatel:** [provozovatel Kanceláře, IČO, adresa] (dále „Zpracovatel“)

## 1. Předmět a doba trvání
1.1. Zpracovatel poskytuje Správci softwarovou službu „Kancelář“ (správa spisů, lhůt, klientů, komunikace s klienty, výkazů a faktur). Při tom zpracovává osobní údaje jménem Správce.
1.2. Smlouva trvá po dobu poskytování služby. Po jejím skončení platí článek 10.

## 2. Povaha, účel a rozsah zpracování
2.1. Povaha: ukládání, zobrazování, přenos, zálohování a mazání údajů v databázi a úložišti služby; odesílání e-mailů s kódy na pokyn Správce.
2.2. Účel: výkon advokacie Správcem (vedení spisů, komunikace s klienty, fakturace).
2.3. Kategorie subjektů údajů: klienti Správce, protistrany a jiné osoby uvedené ve spisech, uchazeči o službu (zájemci o zastoupení), zaměstnanci Správce.
2.4. Druhy údajů: identifikační a kontaktní údaje, údaje ve spisech a dokumentech (mohou zahrnovat zvláštní kategorie a údaje o trestních věcech), platební údaje, údaje o komunikaci, technické záznamy o přístupu.

## 3. Pokyny Správce
3.1. Zpracovatel zpracovává údaje jen na základě doložených pokynů Správce. Pokynem je tato smlouva a nastavení služby Správcem. Pokud by pokyn porušoval právní předpisy, Zpracovatel Správce upozorní.

## 4. Mlčenlivost
4.1. Zpracovatel a jeho osoby oprávněné k přístupu jsou vázáni povinností mlčenlivosti. Zpracovatel bere na vědomí povinnost mlčenlivosti Správce podle zákona o advokacii a nepřistupuje k obsahu spisů, ledaže je to nezbytné pro vyřešení technického problému na žádost Správce.
4.2. Zprávy a soubory klientského kanálu, které Správce šifruje end-to-end, Zpracovatel technicky nemůže přečíst.

## 5. Bezpečnost zpracování (čl. 32 GDPR)
Zpracovatel zavádí tato opatření, jejichž stav popisuje dokumentace služby:
a) oddělení dat uživatelů a kanceláří a kontrola přístupu přímo v databázi (řádková bezpečnost), ověřovaná automatickými testy;
b) šifrování přenosu (TLS); volitelné end-to-end šifrování komunikace a souborů s klientem;
c) dvoufázové přihlášení (TOTP) vynucené v databázi;
d) auditní záznam otevření a změn ve spisech, který nelze upravit;
e) omezení četnosti požadavků, ochrana proti běžným útokům na webové aplikace, bezpečnostní hlavičky;
f) šifrované zálohy a postup obnovy;
g) postup při oznámení incidentu (článek 8).
Zpracovatel opatření průběžně prověřuje. Nezaručuje, že je systém zcela bez zranitelností.

## 6. Další zpracovatelé
6.1. Správce uděluje obecný souhlas s využitím zpracovatelů uvedených v příloze 1 (`docs/HOSTING-A-ZPRACOVATELE.md`).
6.2. Změnu seznamu Zpracovatel oznámí Správci nejméně [30] dní předem. Správce může změně z vážného důvodu odporovat, a pokud se strany nedohodnou, může smlouvu vypovědět bez sankce.
6.3. Se zpracovateli uzavírá Zpracovatel smlouvy s povinnostmi odpovídajícími této smlouvě.

## 7. Předávání do třetích zemí
7.1. Údaje se zpracovávají v EU/EHP. Předání mimo EU/EHP (např. při volitelné AI funkci) se děje jen po výslovném souhlasu Správce u konkrétního úkonu a na základě [standardních smluvních doložek / rozhodnutí o odpovídající ochraně].

## 8. Porušení zabezpečení
8.1. Zpracovatel oznámí Správci porušení zabezpečení osobních údajů bez zbytečného odkladu, nejpozději do [48] hodin od zjištění, a poskytne informace potřebné pro oznámení Úřadu pro ochranu osobních údajů a subjektům údajů.

## 9. Součinnost a kontrola
9.1. Zpracovatel pomáhá Správci s vyřizováním žádostí subjektů údajů, posouzením vlivu na ochranu údajů a s plněním povinností podle čl. 32 až 36 GDPR.
9.2. Zpracovatel poskytne informace potřebné k doložení souladu a umožní audity [jednou ročně, po předchozím oznámení], včetně kontrol provedených Správcem nebo jím pověřenou osobou.

## 10. Vrácení a výmaz
10.1. Po skončení služby Zpracovatel na žádost Správce vrátí údaje v běžném strojově čitelném formátu (export spisu, CSV, ZIP) a do [30] dnů je z produkčních systémů vymaže. Záložní kopie se přepíší v rámci běžného cyklu, nejpozději do [90] dnů.
10.2. Údaje, které musí Zpracovatel uchovat podle právního předpisu, uchovává jen po nezbytnou dobu.

## 11. Odpovědnost a závěrečná ustanovení
11.1. [Ujednání o odpovědnosti a jejím omezení doplní advokát.]
11.2. Smlouva se řídí právem České republiky. [Příslušnost soudů doplnit.]

Za Správce: ____________  Za Zpracovatele: ____________  V ________ dne ________

---

**Poznámky ke kontrole advokátem (nejsou součástí smlouvy):**
- Zda je Správce (advokát) vždy správcem, nebo u některých činností společným správcem či samostatným správcem.
- Vztah k povinné mlčenlivosti a k předpisům České advokátní komory o používání externích služeb. ČAK podle dostupných výsledků nemá jednotné doporučení pro cloud, ověřte aktuální stav.
- Právní základ předání při AI funkci a rozsah zakrývání identifikátorů.
- Doba oznámení incidentu (48 hodin je návrh, lhůta zákonná je pro správce 72 hodin).
