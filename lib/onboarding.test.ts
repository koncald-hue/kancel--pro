import { describe, expect, it } from 'vitest';
import { hasBillingBasics, onboardingComplete, onboardingSteps } from './onboarding';
import type { LawyerAccess } from './lawyer';

const base = { user_id: 'u', email: 'a@b.cz', status: 'active', until: null, firm_name: '', default_rate: 0 } as LawyerAccess;
const full = { ...base, verification_status: 'verified', firm_name: 'AK Novák', ico: '27082440', bank_account: '19-2000145399/0800', e2ee_salt: 's', e2ee_wrapped_master: 'w' } as LawyerAccess;

describe('onboarding', () => {
    it('is incomplete for a new account and lists all three steps', () => {
        expect(onboardingSteps(base).map((s) => s.done)).toEqual([false, false, false]);
        expect(onboardingComplete(base)).toBe(false);
    });
    it('is complete once profile, firm data and encryption are set', () => { expect(onboardingComplete(full)).toBe(true); });
    it('needs a valid IČO and a valid account number', () => {
        expect(hasBillingBasics({ firm_name: 'X', ico: '12345678', bank_account: '19-2000145399/0800' })).toBe(false);
        expect(hasBillingBasics({ firm_name: 'X', ico: '27082440', bank_account: '123' })).toBe(false);
        expect(hasBillingBasics({ firm_name: ' ', ico: '27082440', bank_account: '19-2000145399/0800' })).toBe(false);
        expect(hasBillingBasics({ firm_name: 'X', ico: '27082440', bank_account: 'CZ6508000000192000145399' })).toBe(true);
    });
    it('reports a single missing step', () => { expect(onboardingSteps({ ...full, e2ee_salt: null }).filter((s) => !s.done).map((s) => s.id)).toEqual(['sifrovani']); });
});
