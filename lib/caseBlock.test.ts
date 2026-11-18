import { describe, expect, it } from 'vitest';
import { clientBlock } from './caseBlock';

describe('clientBlock', () => {
    it('vynechá prázdné řádky a zachová pořadí', () => {
        const t = clientBlock({ title: 'Spor', client_name: 'Jan Novák', reference: '12 C 5/2026', authority: '', client_email: '', client_phone: '' }, 'AK Dvořák');
        expect(t).toBe('Spisová značka: 12 C 5/2026\nKlient: Jan Novák\nVěc: Spor\nZastoupení: AK Dvořák\n');
    });
});
