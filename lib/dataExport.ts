import { csvFile, zipFiles, type ExportFile } from './accountantExport';

// Export všech dat kanceláře do tabulek (ZIP s CSV pro Excel). Slouží k zálohování, přechodu jinam a k žádosti klienta o jeho údaje.
// Sloupce odpovídají tomu, co umí načíst import (Věci → Klienti → Lhůty → Kontakty → Čas), takže export jde vrátit zpět.
type Row = Record<string, unknown>;
export type DataExportInput = { clients: Row[]; cases: Row[]; deadlines: Row[]; contacts: Row[]; entries: Row[]; time: Row[] };

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const dmy = (iso: unknown) => { const t = s(iso); return /^\d{4}-\d{2}-\d{2}/.test(t) ? `${Number(t.slice(8, 10))}. ${Number(t.slice(5, 7))}. ${t.slice(0, 4)}` : t; };
const STATUS: Record<string, string> = { open: 'otevřená', done: 'uzavřená', waiting: 'čeká' };

export function buildDataExport(d: DataExportInput): { files: ExportFile[]; counts: Record<string, number> } {
    const titleOf = new Map(d.cases.map((c) => [s(c.id), s(c.title)]));
    const caseTitle = (r: Row) => titleOf.get(s(r.case_id)) ?? '';
    const files: ExportFile[] = [
        csvFile('klienti.csv', ['Jméno', 'E-mail', 'Telefon', 'Adresa', 'IČO', 'DIČ', 'Datum narození', 'Hodinová sazba', 'Poznámka'],
            d.clients.map((c) => [s(c.name), s(c.email), s(c.phone), s(c.address), s(c.ico), s(c.dic), dmy(c.birth), s(c.hourly_rate), s(c.note)])),
        csvFile('veci.csv', ['Název spisu', 'Klient', 'Spisová značka', 'Soud nebo úřad', 'Stav', 'Popis', 'Poznámka', 'Založeno'],
            d.cases.map((c) => [s(c.title), s(c.client_name), s(c.reference), s(c.authority), STATUS[s(c.status)] ?? s(c.status), s(c.situation), s(c.note), dmy(c.created_at)])),
        csvFile('lhuty.csv', ['Spis', 'Úkol nebo lhůta', 'Termín', 'Splněno'],
            d.deadlines.map((r) => [caseTitle(r), s(r.title), dmy(r.due_date), r.done ? 'ano' : 'ne'])),
        csvFile('kontakty-ve-vecech.csv', ['Spis', 'Role', 'Jméno', 'E-mail', 'Telefon', 'IČO', 'Poznámka'],
            d.contacts.map((r) => [caseTitle(r), s(r.role), s(r.name), s(r.email), s(r.phone), s(r.ico), s(r.note)])),
        csvFile('zapisy-ve-vecech.csv', ['Spis', 'Datum', 'Druh', 'Nadpis', 'Text'],
            d.entries.filter((r) => !r.enc).map((r) => [caseTitle(r), dmy(r.happened_on), s(r.kind), s(r.title), s(r.body)])),
        csvFile('vykazy-casu.csv', ['Spis', 'Datum', 'Minuty', 'Popis', 'Sazba', 'Vyúčtováno'],
            d.time.map((r) => [caseTitle(r), dmy(r.entry_date), s(r.minutes), s(r.description), s(r.rate), r.billed ? 'ano' : 'ne'])),
    ];
    files.push({ name: 'CTI-ME.txt', content: 'Export dat z aplikace Kancelář. Soubory CSV (středník, UTF-8) otevřete v Excelu nebo je načtěte do jiného systému.\r\nNejsou v nich soubory ve spisech, šifrované zprávy klientů ani faktury: faktury jsou v Peníze → Export pro účetní, soubory ve spisu v kartě spisu (Export spisu).\r\n' });
    return { files, counts: { klienti: d.clients.length, veci: d.cases.length, lhuty: d.deadlines.length, kontakty: d.contacts.length, zapisy: d.entries.filter((r) => !r.enc).length, vykazy: d.time.length } };
}
export { zipFiles };
