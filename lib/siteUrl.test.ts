import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCanonicalUrl, getSiteOrigin } from './siteUrl';

afterEach(() => vi.unstubAllEnvs());

describe('public SEO origin', () => {
    it('uses the configured public origin and drops any path suffix', () => {
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://pravo.example/cesta');
        expect(getSiteOrigin()).toBe('https://pravo.example');
        expect(getCanonicalUrl('/clanky/1-test')).toBe('https://pravo.example/clanky/1-test');
    });

    it('does not publish localhost canonicals in production when no public URL exists', () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
        expect(getSiteOrigin()).toBeUndefined();
        expect(getCanonicalUrl('/')).toBeUndefined();
    });

    it('rejects a localhost URL even if mistakenly configured for production', () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
        expect(getCanonicalUrl('/clanky')).toBeUndefined();
    });
});
