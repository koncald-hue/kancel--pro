import { hasLawyerAccess, useLawyerAccess } from './lawyer';

// Co smí běžný (bezplatný) uživatel a co advokát. Stejné hodnoty hlídá i databáze (supabase/tiers.sql).
export const FREE_LIMITS = {
    cases: 3,
    filesPerCase: 10,
    bytesPerCase: 25 * 1024 * 1024,
    foldersPerCase: 3,
    contactsPerCase: 5,
    defensePerDay: 2,
} as const;

export const LAWYER_LIMITS = {
    cases: Infinity,
    filesPerCase: Infinity,
    bytesPerCase: 100 * 1024 * 1024,
    foldersPerCase: Infinity,
    contactsPerCase: Infinity,
    defensePerDay: 12,
} as const;

export const limitsFor = (lawyer: boolean) => (lawyer ? LAWYER_LIMITS : FREE_LIMITS);
export const UPGRADE_HREF = '/';

// Advokátský režim: člen týmu nebo uživatel s aktivním či zkušebním přístupem do kanceláře
export function useLawyerTier(userId: string | undefined, isStaff: boolean): boolean {
    const { access } = useLawyerAccess(userId);
    return isStaff || hasLawyerAccess(access);
}
