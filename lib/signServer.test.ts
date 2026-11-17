import { afterEach, describe, expect, it, vi } from 'vitest';
import { originOf } from './signServer';

afterEach(() => vi.unstubAllEnvs());

describe('identity callback origin', () => {
    it('uses the configured HTTPS origin instead of request Host', () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://office.example/path');
        expect(originOf(new Request('https://attacker.example/api/callback'))).toBe('https://office.example');
    });

    it('fails closed in production if the canonical origin is missing', () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
        expect(() => originOf(new Request('https://attacker.example/api/callback'))).toThrow('NEXT_PUBLIC_SITE_URL');
    });

    it('allows request origin fallback only outside production', () => {
        vi.stubEnv('NODE_ENV', 'test');
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
        expect(originOf(new Request('http://localhost:3100/api/callback'))).toBe('http://localhost:3100');
    });
});
