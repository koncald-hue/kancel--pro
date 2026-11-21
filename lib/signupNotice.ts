// Oznámení správci o nové registraci: posílá se jen u právě potvrzeného účtu a jen jednou.
export const FRESH_MINUTES = 30;

type U = { email_confirmed_at?: string | null; app_metadata?: Record<string, unknown> | null };

export function isFreshSignup(user: U, now = Date.now()): boolean {
    if (user.app_metadata?.signup_notified) return false;
    if (!user.email_confirmed_at) return false;
    const age = now - new Date(user.email_confirmed_at).getTime();
    return age >= 0 && age <= FRESH_MINUTES * 60_000;
}
