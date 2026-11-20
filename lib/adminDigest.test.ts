import { describe, expect, it } from 'vitest';
import { buildAdminDigest } from './adminDigest';

const empty = { pendingVerifications: [], refundDue: [], newRegistrations: 0, failedRenewals: 0 };

describe('buildAdminDigest', () => {
    it('když není co hlásit, nic neposílá', () => {
        expect(buildAdminDigest(empty, 'https://x/admin')).toBeNull();
    });
    it('věc k vyřízení dostane předmět „vyžaduje akci“ a vypíše e-maily', () => {
        const r = buildAdminDigest({ ...empty, pendingVerifications: ['a@x.cz'], refundDue: [{ email: 'b@x.cz', price: 649 }] }, 'https://x/admin');
        expect(r?.subject).toBe('Kancelář: vyžaduje vaši akci');
        expect(r?.lines.join('\n')).toContain('a@x.cz');
        expect(r?.lines.join('\n')).toContain('b@x.cz (649 Kč)');
    });
    it('jen nové registrace je běžné shrnutí', () => {
        expect(buildAdminDigest({ ...empty, newRegistrations: 3 }, 'https://x/admin')?.subject).toBe('Kancelář: denní shrnutí');
    });
});
