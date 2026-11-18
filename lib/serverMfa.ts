import type { User } from '@supabase/supabase-js';

// Server: účet se zapnutým druhým faktorem smí volat API jen s tokenem úrovně aal2.
// Token už ověřil Supabase (getUser); tady se jen čte jeho tvrzení „aal“.
export function jwtAal(token: string): string {
    try { return String((JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { aal?: unknown }).aal ?? 'aal1'); } catch { return 'aal1'; }
}
export function mfaBlocked(user: Pick<User, 'factors'>, token: string): boolean {
    const enrolled = (user.factors ?? []).some((f) => f.factor_type === 'totp' && f.status === 'verified');
    return enrolled && jwtAal(token) !== 'aal2';
}
