import { describe, expect, it } from 'vitest';
import { findConflicts, matchParty, normalizeName, partiesFromTitle } from './conflicts';

const pool = [
    { kind: 'klient' as const, name: 'Jan Novák', ico: '', email: 'jan@x.cz' },
    { kind: 'klient' as const, name: 'ACME s.r.o.', ico: '12345678' },
    { kind: 'protistrana' as const, name: 'Petr Dvořák', caseId: 'c1', caseTitle: 'Spor' },
];

describe('conflicts', () => {
    it('normalizuje diakritiku, tituly a právní formy', () => {
        expect(normalizeName('JUDr. Jan Novák, Ph.D.')).toBe('jan novak');
        expect(normalizeName('ACME, s.r.o.')).toBe('acme');
    });
    it('stejná osoba v jiném pořadí jmen', () => { expect(matchParty({ name: 'Novák Jan' }, pool[0])?.score).toBe(100); });
    it('IČO a e-mail mají přednost před jménem', () => {
        expect(matchParty({ name: 'Úplně jiný název', ico: '123 456 78' }, pool[1])?.why).toBe('ico');
        expect(matchParty({ name: 'Nikdo', email: 'JAN@x.cz' }, pool[0])?.why).toBe('email');
    });
    it('klient dnešní protistranou je vysoká závažnost', () => {
        const h = findConflicts({ name: 'Jan Novák' }, 'protistrana', pool);
        expect(h[0]).toMatchObject({ severity: 'high' });
    });
    it('dřívější protistrana jako nový klient je vysoká závažnost', () => {
        const h = findConflicts({ name: 'Petr Dvořák' }, 'klient', pool);
        expect(h[0]).toMatchObject({ severity: 'high', entry: { kind: 'protistrana' } });
    });
    it('shoda se stejnou stranou není střet', () => {
        const h = findConflicts({ name: 'Jan Novák' }, 'klient', pool);
        expect(h[0].severity).not.toBe('high');
    });
    it('samotné příjmení jen jako slabá shoda, cizí jméno nic', () => {
        expect(findConflicts({ name: 'Novák' }, 'protistrana', pool)[0]?.score).toBeLessThan(60);
        expect(findConflicts({ name: 'Marie Svobodová' }, 'protistrana', pool)).toEqual([]);
    });
    it('podobný tvar příjmení (Nováková/Novák) s křestním jménem', () => {
        expect(findConflicts({ name: 'Jan Nováka' }, 'protistrana', pool)[0]?.entry.name).toBe('Jan Novák');
    });
    it('stejný klient na kartě i ve věci se ukáže jednou, s věcí', () => {
        const h = findConflicts({ name: 'Jan Novák' }, 'protistrana', [{ kind: 'klient', name: 'Jan Novák' }, { kind: 'klient', name: 'Novák Jan', caseId: 'c9', caseTitle: 'Žaloba' }]);
        expect(h).toHaveLength(1); expect(h[0].entry.caseId).toBe('c9');
    });
    it('skloňované jméno z názvu věci (Dvořákovi, Apolovi) se najde jako podobné', () => {
        expect(findConflicts({ name: 'Petru Dvořákovi' }, 'klient', pool)[0]?.entry.name).toBe('Petr Dvořák');
        expect(findConflicts({ name: 'Dvořákovi' }, 'klient', pool)[0]?.entry.name).toBe('Petr Dvořák');
        expect(findConflicts({ name: 'Svobodovi' }, 'klient', pool)).toEqual([]);
    });
    it('strany z názvu věci', () => {
        expect(partiesFromTitle('Novák proti Dvořákovi')).toEqual(['Novák', 'Dvořákovi']);
        expect(partiesFromTitle('Pokuta za rychlost')).toEqual([]);
    });
});
