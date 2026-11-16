import type { PlanId } from './plans';

// Balíčky pro advokátní kanceláře: počet míst
export const FIRM_SIZES = [3, 5, 10] as const;
export type FirmSize = (typeof FIRM_SIZES)[number];
export type FirmPrices = Record<FirmSize, Record<PlanId, number>>;
export const EMPTY_FIRM_PRICES: FirmPrices = { 3: { month: 0, half: 0, year: 0 }, 5: { month: 0, half: 0, year: 0 }, 10: { month: 0, half: 0, year: 0 } };

export type FirmRole = 'owner' | 'admin' | 'member';
export const ROLE_LABELS: Record<FirmRole, string> = { owner: 'Vedoucí', admin: 'Správce', member: 'Člen' };
export const ROLE_HELP: Record<FirmRole, string> = {
    owner: 'Spravuje kancelář: název, balíček, pozvánky, odebírání členů a přidělování rolí. Jen jeden.',
    admin: 'Zve a odebírá členy. Nemění název, balíček ani role a neodebírá vedoucího a jiné správce.',
    member: 'Pracuje jen se svým profilem a svými daty. Kancelář nespravuje.',
};
export const canManageFirm = (role?: FirmRole | null) => role === 'owner' || role === 'admin';
export type FirmMember = { user_id: string; role: FirmRole; joined_at: string; email: string; name: string; verification: 'none' | 'pending' | 'verified' | 'rejected'; status: string; until: string | null };
export type FirmInvite = { id: string; email: string; name?: string; token: string; expires_at: string };
export type FirmOverview = { firm: { id: string; name: string; seats: number; until: string | null; role: FirmRole }; members?: FirmMember[]; invites?: FirmInvite[] };

export const inviteUrl = (token: string) => `${typeof window === 'undefined' ? '' : window.location.origin}/pozvanka/${token}`;
export const VERIFICATION_LABEL: Record<string, string> = { none: 'Profil nevyplněn', pending: 'Profil nevyplněn', verified: 'Profil vyplněn', rejected: 'Profil nevyplněn' };
