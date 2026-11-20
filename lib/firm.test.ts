import { describe, expect, it } from 'vitest';
import { FIRM_SIZES, traineeSeats } from './firm';

describe('traineeSeats', () => {
    it('každá velikost balíčku má místa pro koncipienty a neznámá žádná', () => {
        expect(FIRM_SIZES.map((n) => traineeSeats(n))).toEqual([1, 1, 2, 4, 8]);
        expect(traineeSeats(7)).toBe(0);
    });
});
