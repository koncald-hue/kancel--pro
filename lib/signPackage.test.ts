import { describe, expect, it } from 'vitest';
import { leadOf, packageProblem, planReminder, type PackageRow, type ReminderRow } from './signing';
import { buildClientReminder, buildExpiryNotice, remindersElapsed } from './signReminders';
import { buildContract, missingContractData } from './contractTemplate';
import { buildContractPdf, paginate } from './contractPdf';

const row = (o: Partial<PackageRow> = {}): PackageRow => ({ id: 'a', created_at: '2026-11-01T10:00:00Z', signer_name: 'Jan Novák', signer_phone: '', signer_email: '', identity_method: 'lawyer', level: 'advanced', status: 'pending', ...o });
const rem = (o: Partial<ReminderRow> = {}): ReminderRow => ({ id: 'a', status: 'pending', created_at: '2026-11-01T10:00:00Z', expires_at: '2026-11-15T10:00:00Z', reminder_count: 0, expiry_notified: false, signer_email: 'a@b.cz', level: 'advanced', ...o });
const at = (d: string) => new Date(`${d}T12:00:00Z`);

describe('balíček', () => {
    it('povolí stejnou osobu a ověření, odmítne rozdíly a kvalifikovaný podpis', () => {
        expect(packageProblem([row(), row({ id: 'b', signer_name: 'novak jan' })])).toBeNull();
        expect(packageProblem([row(), row({ id: 'b', signer_name: 'Eva Svobodová' })])).toMatch(/táž osoba/);
        expect(packageProblem([row(), row({ id: 'b', identity_method: 'none' })])).toMatch(/táž osoba/);
        expect(packageProblem([row(), row({ id: 'b', level: 'qualified' })])).toMatch(/podpisem/);
        expect(packageProblem([])).toMatch(/neexistuje/);
    });
    it('první dokument je nejstarší, při shodě rozhoduje id', () => {
        expect(leadOf([row({ id: 'b', created_at: '2026-11-02T00:00:00Z' }), row({ id: 'c' }), row({ id: 'a' })]).id).toBe('a');
    });
});

describe('plán připomínek', () => {
    it('před 2. dnem nic, po 2. a po 5. dni připomene', () => {
        expect(planReminder(rem(), at('2026-11-02'))).toBeNull();
        expect(planReminder(rem(), at('2026-11-03'))).toBe('remind');
        expect(planReminder(rem({ reminder_count: 1 }), at('2026-11-04'))).toBeNull();
        expect(planReminder(rem({ reminder_count: 1 }), at('2026-11-06'))).toBe('remind');
        expect(planReminder(rem({ reminder_count: 2 }), at('2026-11-10'))).toBeNull();
    });
    it('bez e-mailu nepřipomíná, vypršelou hlásí jednou, podepsané ignoruje', () => {
        expect(planReminder(rem({ signer_email: '' }), at('2026-11-06'))).toBeNull();
        expect(planReminder(rem(), at('2026-11-16'))).toBe('expire');
        expect(planReminder(rem({ expiry_notified: true }), at('2026-11-16'))).toBeNull();
        expect(planReminder(rem({ status: 'signed' }), at('2026-11-06'))).toBeNull();
        expect(planReminder(rem({ level: 'qualified' }), at('2026-11-06'))).toBeNull();
    });
    it('počet uplynulých připomínek', () => {
        expect(remindersElapsed('2026-11-01T10:00:00Z', at('2026-11-02'))).toBe(0);
        expect(remindersElapsed('2026-11-01T10:00:00Z', at('2026-11-03'))).toBe(1);
        expect(remindersElapsed('2026-11-01T10:00:00Z', at('2026-11-07'))).toBe(2);
    });
    it('e-maily neobsahují odkaz a jmenují dokumenty', () => {
        const c = buildClientReminder({ lawyer: 'JUDr. Eva Svobodová', titles: ['Smlouva', 'Plná moc'], expiresAt: '2026-11-15T10:00:00Z' });
        expect(c.text).toContain('• Smlouva'); expect(c.text).toContain('JUDr. Eva Svobodová'); expect(c.text).not.toMatch(/https?:/);
        const e = buildExpiryNotice({ who: 'Jan Novák', titles: ['Smlouva'] });
        expect(e.subject).toContain('Jan Novák'); expect(e.text).toContain('• Smlouva');
    });
});

describe('smlouva z karty klienta', () => {
    const base = { lawyer: { display_name: 'JUDr. Eva Svobodová', bar_number: '12345', office: 'Dlouhá 1, Plzeň', default_rate: 2500, vat_payer: false }, client: { name: 'Jan Novák', email: '', phone: '', hourly_rate: null, address: 'Krátká 5, Praha', birth: '1985-03-02' }, item: { title: 'Spor o dluh', reference: '12 C 34/2026', authority: 'Okresní soud Plzeň-město' }, date: new Date('2026-11-21T12:00:00') };
    it('předvyplní strany, předmět a sazbu', () => {
        const t = buildContract(base).lines.join('\n');
        expect(t).toContain('JUDr. Eva Svobodová'); expect(t).toContain('ev. č. 12345'); expect(t).toContain('Jan Novák'); expect(t).toContain('Krátká 5, Praha');
        expect(t).toContain('Spor o dluh'); expect(t).toContain('12 C 34/2026'); expect(t).toContain('2 500 Kč'); expect(t).toContain('2. 3. 1985'); expect(t).toContain('není plátcem');
        expect(t).not.toContain('[');
    });
    it('sazba klienta má přednost a plátce DPH se uvede', () => {
        const t = buildContract({ ...base, lawyer: { ...base.lawyer, vat_payer: true }, client: { ...base.client, hourly_rate: 3000 } }).lines.join('\n');
        expect(t).toContain('3 000 Kč'); expect(t).toContain('připočítá daň');
    });
    it('hlásí chybějící údaje', () => {
        expect(missingContractData(base)).toEqual([]);
        expect(missingContractData({ ...base, lawyer: {}, client: { ...base.client, address: '' } })).toEqual(expect.arrayContaining(['jméno advokáta (profil)', 'adresa kanceláře (profil)', 'adresa klienta (karta klienta)', 'hodinová sazba']));
    });
});

describe('PDF smlouvy', () => {
    it('rozdělí dlouhý text na víc stránek', () => {
        const lines = ['Nadpis', ...Array.from({ length: 80 }, (_, i) => `Odstavec ${i} ${'slovo '.repeat(30)}`)];
        const pages = paginate(lines, (t) => t.length * 12);
        expect(pages.length).toBeGreaterThan(1);
        expect(pages.every((p) => p.length > 0)).toBe(true);
    });
    it('složí PDF s jednou stránkou na každý vykreslený obrázek', async () => {
        const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
        const bytes = await buildContractPdf(['a'], async () => [png, png]);
        expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('%PDF');
        const { PDFDocument } = await import('pdf-lib');
        expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
    });
});
