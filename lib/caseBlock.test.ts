import { describe, expect, it } from 'vitest';
import { clientBlock, deadlinesBlock } from './caseBlock';

describe('clientBlock', () => {
    it('vynechá prázdné řádky a zachová pořadí', () => {
        const t = clientBlock({ title: 'Spor', client_name: 'Jan Novák', reference: '12 C 5/2026', authority: '', client_email: '', client_phone: '' }, 'AK Dvořák');
        expect(t).toBe('Spisová značka: 12 C 5/2026\nKlient: Jan Novák\nVěc: Spor\nZastoupení: AK Dvořák\n');
    });
});

describe('lhůty věci pro vložení do dokumentu', () => {
    it('vloží jen nesplněné, od nejbližší', () => {
        expect(deadlinesBlock([{ title: 'Odvolání', due_date: '2026-12-20', done: false }, { title: 'Hotovo', due_date: '2026-11-01', done: true }, { title: 'Vyjádření', due_date: '2026-12-01', done: false }]))
            .toBe('Lhůty ve věci:\n– 1. 12. 2026: Vyjádření\n– 20. 12. 2026: Odvolání\n');
    });
    it('bez lhůt vrátí prázdný text', () => { expect(deadlinesBlock([{ title: 'x', due_date: '2026-11-01', done: true }])).toBe(''); });
});
