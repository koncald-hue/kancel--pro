import { describe, expect, it } from 'vitest';
import { DEMO_CASE_LIKE, DEMO_MARK_LIKE, isDemoName, isDemoTitle } from './demoMarks';
import { DEMO_TITLE } from './demoCase';

describe('značky ukázky', () => {
    it('pozná ukázkový spis a klienta', () => {
        expect(isDemoTitle(DEMO_TITLE)).toBe(true);
        expect(isDemoTitle('Novák proti Dvořákovi')).toBe(false);
        expect(isDemoName('Jan Novák (ukázka)')).toBe(true);
        expect(isDemoName('Jan Novák')).toBe(false);
    });
    it('vzory pro databázi odpovídají značkám', () => {
        expect(DEMO_CASE_LIKE).toBe('Ukázka:%');
        expect(DEMO_MARK_LIKE).toBe('%(ukázka)%');
    });
});
