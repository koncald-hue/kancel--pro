import { describe, expect, it } from 'vitest';
import { cleanLabels, MAX_LABELS } from './caseMeta';

describe('cleanLabels', () => {
    it('odstraní prázdné a duplicity a zkrátí dlouhé', () => {
        expect(cleanLabels([' Důležité ', 'důležité', '', 'x'.repeat(40)])).toEqual(['Důležité', 'x'.repeat(24)]);
    });
    it('omezí počet', () => { expect(cleanLabels(Array.from({ length: 30 }, (_, i) => `s${i}`))).toHaveLength(MAX_LABELS); });
});
