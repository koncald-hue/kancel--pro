import { describe, expect, it } from 'vitest';
import { initialsOf } from './avatar';

describe('avatar', () => {
    it('builds initials from the first two name parts, skipping titles without letters', () => {
        expect(initialsOf('JUDr. Jana Králová')).toBe('JJ');
        expect(initialsOf('Petr Novák')).toBe('PN');
        expect(initialsOf('Čeněk')).toBe('Č');
        expect(initialsOf('   ')).toBe('?');
    });
});
