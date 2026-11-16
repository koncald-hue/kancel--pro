// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { buildRecords, decodeText, detectEntity, minutesFrom, normPhone, parseAnyDate, parseVcf, parseXlsx, planImport, readFile, suggestMapping, summarize, type Existing } from './importer';

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
        expect(detectEntity(['Datum', 'Věc', 'Hodiny', 'Popis']).entity).toBe('cas');
        expect(detectEntity(['Spisová značka', 'Soud', 'Klient', 'Název věci']).entity).toBe('veci');
        expect(detectEntity(['Věc', 'Lhůta', 'Konec lhůty']).entity).toBe('lhuty');
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
        const tt = { headers: ['Datum', 'Věc', 'Hodiny', 'Popis'], rows: [['2.11.2026', 'Spor o dluh', '1,5', 'Porada']] };
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
