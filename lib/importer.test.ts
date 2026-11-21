// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { buildRecords, decodeText, detectEntity, minutesFrom, normPhone, parseAnyDate, parseVcf, parseXlsx, planImport, planWorkbook, readFile, suggestMapping, summarize, type Existing } from './importer';

const csv = `Jméno;Příjmení;E-mail;Telefon;Ulice;Město;PSČ;IČO;Datum narození;Poznámka
Jan;Novák;JAN@Example.cz;777123456;Dlouhá 12;Plzeň;30100;27082440;2.3.1985;VIP
Petra;Svobodová;petra@x;603 111 222;Krátká 5;Praha;11000;;1.1.90;`;

describe('import: reading files', () => {
    it('reads CSV, maps columns and builds clients with a composed name and address', async () => {
        const [sheet] = await readFile(new TextEncoder().encode(csv));
        const map = suggestMapping('klienti', sheet.table.headers);
        expect(map.slice(0, 3)).toEqual(['first', 'last', 'email']);
        const rows = buildRecords('klienti', sheet.table, map);
        expect(rows[0].rec).toMatchObject({ name: 'Jan Novák', email: 'jan@example.cz', phone: '+420 777 123 456', address: 'Dlouhá 12, 30100 Plzeň', ico: '27082440', birth: '1985-03-02' });
        expect(rows[1].rec.birth).toBe('1990-01-01');
        expect(rows[1].issues.some((i) => /E-mail/.test(i.text))).toBe(true);
    });
    it('detects the Windows-1250 encoding of Czech Excel exports', () => {
        const bytes = Uint8Array.from([0x4a, 0x6d, 0xe9, 0x6e, 0x6f]); // „Jméno“ v cp1250
        expect(decodeText(bytes)).toBe('Jméno');
    });
    it('reads vCard contacts', () => {
        const t = parseVcf('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Jan Novák\r\nORG:Firma s.r.o.\r\nEMAIL;TYPE=INTERNET:jan@firma.cz\r\nTEL;TYPE=CELL:+420777123456\r\nBDAY:19850302\r\nEND:VCARD\r\n');
        expect(t.rows[0].slice(0, 4)).toEqual(['Jan Novák', 'Firma s.r.o.', 'jan@firma.cz', '+420777123456']);
        expect(t.rows[0][5]).toBe('1985-03-02');
    });
    it('reads the first sheet of an XLSX with shared strings and numbers', async () => {
        const zip = new JSZip();
        zip.file('xl/workbook.xml', '<workbook xmlns="x" xmlns:r="r"><sheets><sheet name="Klienti" sheetId="1" r:id="rId1"/></sheets></workbook>');
        zip.file('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');
        zip.file('xl/sharedStrings.xml', '<sst><si><t>Název</t></si><si><t>IČO</t></si><si><t>Firma A</t></si></sst>');
        zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>27082440</v></c></row></sheetData></worksheet>');
        const sheets = await parseXlsx(await zip.generateAsync({ type: 'uint8array' }));
        expect(sheets[0].name).toBe('Klienti');
        expect(sheets[0].table).toEqual({ headers: ['Název', 'IČO'], rows: [['Firma A', '27082440']] });
    });
});

describe('import: values', () => {
    it('parses dates (also Excel serials and two-digit years), phones and durations', () => {
        expect(parseAnyDate('15.3.2026')).toBe('2026-03-15'); expect(parseAnyDate('45000')).toBe('2023-03-15'); expect(parseAnyDate('1.2.26')).toBe('2026-02-01'); expect(parseAnyDate('blabla')).toBeNull();
        expect(normPhone('00420 603 111 222')).toBe('+420 603 111 222');
        expect(minutesFrom({ duration: '1:30' })).toBe(90); expect(minutesFrom({ hours: '1,5' })).toBe(90); expect(minutesFrom({ minutes: '45' })).toBe(45); expect(minutesFrom({ duration: '0,5' })).toBe(30);
    });
    it('guesses what the file contains', () => {
        expect(detectEntity(['Datum', 'Spis', 'Hodiny', 'Popis']).entity).toBe('cas');
        expect(detectEntity(['Spisová značka', 'Soud', 'Klient', 'Název spisu']).entity).toBe('veci');
        expect(detectEntity(['Spis', 'Lhůta', 'Konec lhůty']).entity).toBe('lhuty');
    });
});

const existing: Existing = { clients: [{ id: 'c1', name: 'Jan Novák', email: 'jan@example.cz', phone: '', ico: '' }], cases: [{ id: 'k1', title: 'Spor o dluh', reference: '12 C 34/2026' }] };
describe('import: linking and planning', () => {
    const table = { headers: ['Název', 'Spisová značka', 'Klient', 'Stav'], rows: [['Dědictví', '5 D 1/2026', 'Jan Novák', 'Aktivní'], ['Rozvod', '', 'Nová Klientka', 'Uzavřeno'], ['Duplicitní', '12 C 34/2026', 'Jan Novák', '']] };
    it('links cases to existing clients, creates missing ones and skips duplicates by file number', () => {
        const rows = buildRecords('veci', table, suggestMapping('veci', table.headers));
        const plan = planImport('veci', rows, existing, { createMissingClients: true, fillExisting: true });
        expect(plan[0]).toMatchObject({ action: 'create', clientId: 'c1' });
        expect(plan[1]).toMatchObject({ action: 'create', newClient: { name: 'Nová Klientka' } }); expect(rows[1].rec.status).toBe('done');
        expect(plan[2].action).toBe('skip');
        expect(summarize(plan)).toMatchObject({ create: 2, skip: 1, newClients: 1 });
    });
    it('does not create clients when switched off', () => {
        const rows = buildRecords('veci', table, suggestMapping('veci', table.headers));
        expect(planImport('veci', rows, existing, { createMissingClients: false, fillExisting: true })[1]).toMatchObject({ action: 'create', clientId: null, newClient: null });
    });
    it('attaches deadlines and time entries to cases by file number or title and reports unknown cases', () => {
        const lt = { headers: ['Spisová značka', 'Lhůta', 'Datum'], rows: [['12 C 34/2026', 'Vyjádření', '30.11.2026'], ['neexistuje', 'X', '1.1.2027'], ['12 C 34/2026', 'Špatné', 'xx']] };
        const plan = planImport('lhuty', buildRecords('lhuty', lt, suggestMapping('lhuty', lt.headers)), existing, { createMissingClients: false, fillExisting: false });
        expect(plan.map((p) => p.action)).toEqual(['create', 'error', 'error']); expect(plan[0].caseId).toBe('k1');
        const tt = { headers: ['Datum', 'Spis', 'Hodiny', 'Popis'], rows: [['2.11.2026', 'Spor o dluh', '1,5', 'Porada']] };
        const p = planImport('cas', buildRecords('cas', tt, suggestMapping('cas', tt.headers)), existing, { createMissingClients: false, fillExisting: false });
        expect(p[0]).toMatchObject({ action: 'create', caseId: 'k1' }); expect(p[0].row.rec.minutesOut).toBe('90');
    });
    it('fills only empty fields of an existing client and detects the same client by e-mail', () => {
        const t = { headers: ['Jméno', 'E-mail', 'Telefon', 'IČO'], rows: [['J. Novák', 'jan@example.cz', '777123456', '']] };
        const plan = planImport('klienti', buildRecords('klienti', t, suggestMapping('klienti', t.headers)), existing, { createMissingClients: false, fillExisting: true });
        expect(plan[0]).toMatchObject({ action: 'update', clientId: 'c1', patch: { phone: '+420 777 123 456' } });
    });
    it('treats a repeated client inside the file as a duplicate', () => {
        const t = { headers: ['Název'], rows: [['Firma A'], ['firma a']] };
        const plan = planImport('klienti', buildRecords('klienti', t, suggestMapping('klienti', t.headers)), { clients: [], cases: [] }, { createMissingClients: false, fillExisting: false });
        expect(plan.map((p) => p.action)).toEqual(['create', 'skip']);
    });
});

describe('import: whole workbook', () => {
    const sheets = {
        Klienti: { headers: ['Jméno / název', 'E-mail', 'Telefon', 'Adresa', 'IČO', 'DIČ', 'Datum narození', 'Hodinová sazba', 'Poznámka'], rows: [['Jan Novotný', 'jan.novotny@example.cz', '603111222', 'Vinohradská 12, Praha', '', '', '12. 4. 1981', '2 500', ''], ['Stavby Dvořák s.r.o.', 'info@dvorak.cz', '224555666', 'Plzeň', '27082440', 'CZ27082440', '', '3 000', '']] },
        'Spisy': { headers: ['Název spisu', 'Spisová značka', 'Soud nebo úřad', 'Klient', 'Stav', 'Popis spisu', 'Poznámka'], rows: [['Rozvod', '12 C 45/2026', 'OS Praha 2', 'Jan Novotný', 'Otevřená', 'Rozvod', ''], ['Spor o dílo', '31 C 77/2025', 'OS Plzeň', 'Stavby Dvořák s.r.o.', 'Otevřená', '', ''], ['Revize smlouvy', '', '', 'Nový Klient', 'Uzavřená', '', '']] },
        'Lhůty': { headers: ['Spis', 'Název lhůty', 'Datum', 'Splněno'], rows: [['12 C 45/2026', 'Vyjádření', '15. 1. 2027', 'ne'], ['31 C 77/2025', 'Poplatek', '2. 11. 2026', 'ano'], ['99 C 1/2026', 'Odvolání', '1. 2. 2027', 'ne']] },
        'Kontakty ve spisech': { headers: ['Spis', 'Jméno / název', 'Role', 'E-mail', 'Telefon', 'Poznámka'], rows: [['12 C 45/2026', 'Lucie Novotná', 'protistrana', 'lucie@example.cz', '604123456', '']] },
        'Čas': { headers: ['Spis', 'Datum', 'Hodiny', 'Popis činnosti', 'Sazba', 'Vyfakturováno'], rows: [['Revize smlouvy', '4. 11. 2026', '1,5', 'Porada', '2500', 'ano'], ['Spor o dluh', '5. 11. 2026', '2', 'Studium', '3000', 'ne']] },
    };
    it('recognises every sheet and maps every column', () => {
        const want: Record<string, string> = { Klienti: 'klienti', 'Spisy': 'veci', 'Lhůty': 'lhuty', 'Kontakty ve spisech': 'kontakty', 'Čas': 'cas' };
        for (const [name, t] of Object.entries(sheets)) {
            const { entity } = detectEntity(t.headers, name, t.rows);
            expect(entity).toBe(want[name]);
            expect(suggestMapping(entity, t.headers, t.rows).filter((m) => !m)).toEqual([]);
        }
        expect(suggestMapping('veci', sheets['Spisy'].headers)).toEqual(['title', 'reference', 'authority', 'client', 'status', 'description', 'note']);
        expect(suggestMapping('lhuty', sheets['Lhůty'].headers)).toEqual(['case', 'title', 'date', 'done']);
        expect(suggestMapping('cas', sheets['Čas'].headers)).toEqual(['case', 'date', 'hours', 'description', 'rate', 'billed']);
    });
    it('detects sheets by headers alone, without a sheet name', () => {
        expect(detectEntity(sheets['Spisy'].headers).entity).toBe('veci');
        expect(detectEntity(sheets['Čas'].headers).entity).toBe('cas');
    });
    it('recognises unnamed columns by their content', () => {
        const t = { headers: ['A', 'B', 'C'], rows: [['Jan Novák', 'jan@novak.cz', '27082440'], ['Eva Malá', 'eva@mala.cz', '45274649']] };
        expect(suggestMapping('klienti', t.headers, t.rows).slice(1)).toEqual(['email', 'ico']);
    });
    it('links later sheets to clients and cases created by earlier ones and creates missing cases once', () => {
        const parts = (Object.entries(sheets) as [string, { headers: string[]; rows: string[][] }][]).map(([name, t]) => { const e = detectEntity(t.headers, name, t.rows).entity; return { entity: e, rows: buildRecords(e, t, suggestMapping(e, t.headers, t.rows)) }; });
        const plans = planWorkbook(parts, existing, { createMissingClients: true, fillExisting: true, createMissingCases: true });
        const [kl, ve, lh, ko, ca] = plans;
        expect(kl.map((p) => p.action)).toEqual(['create', 'create']);
        // věc se připojí ke klientovi, který vznikne o list dřív (žádný duplicitní klient)
        expect(ve[0]).toMatchObject({ action: 'create', clientId: kl[0].selfId, newClient: null });
        expect(ve[2]).toMatchObject({ action: 'create', newClient: { name: 'Nový Klient' } });
        // lhůty a kontakty se připojí k věcem z listu Věci podle spisové značky
        expect(lh[0].caseId).toBe(ve[0].selfId); expect(lh[1].caseId).toBe(ve[1].selfId);
        expect(lh[2]).toMatchObject({ action: 'create', newCase: { title: '99 C 1/2026', reference: '99 C 1/2026' } });
        expect(ko[0].caseId).toBe(ve[0].selfId);
        // čas: podle názvu věci z listu i podle stávající věci v kanceláři
        expect(ca[0].caseId).toBe(ve[2].selfId); expect(ca[1].caseId).toBe('k1');
        expect(summarize(lh)).toMatchObject({ create: 3, newCases: 1 });
    });
    it('reports a missing case as an error when creating cases is switched off', () => {
        const t = sheets['Lhůty'];
        const plan = planImport('lhuty', buildRecords('lhuty', t, suggestMapping('lhuty', t.headers)), existing, { createMissingClients: false, fillExisting: false, createMissingCases: false });
        expect(plan.map((p) => p.action)).toEqual(['error', 'error', 'error']);
    });
});
