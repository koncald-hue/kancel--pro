// Registr plných mocí: platnost, stav a řazení
export type PowerKind = 'general' | 'special' | 'procedural';
export type Power = { id: string; case_id: string | null; grantor: string; grantee: string; kind: PowerKind; valid_from: string | null; valid_to: string | null; note: string; created_at: string };
export type PowerState = 'planned' | 'valid' | 'ending' | 'expired';

export const KIND_LABEL: Record<PowerKind, string> = { general: 'Generální', special: 'Zvláštní', procedural: 'Procesní' };
export const STATE_LABEL: Record<PowerState, string> = { planned: 'Platí od budoucna', valid: 'Platná', ending: 'Brzy končí', expired: 'Vypršela' };
export const ENDING_DAYS = 30;

const dayMs = 86_400_000;
const t = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime();

export function powerState(p: Pick<Power, 'valid_from' | 'valid_to'>, today: string): PowerState {
    if (p.valid_from && p.valid_from > today) return 'planned';
    if (!p.valid_to) return 'valid';
    if (p.valid_to < today) return 'expired';
    return Math.round((t(p.valid_to) - t(today)) / dayMs) <= ENDING_DAYS ? 'ending' : 'valid';
}

export const daysLeft = (p: Pick<Power, 'valid_to'>, today: string) => (p.valid_to ? Math.round((t(p.valid_to) - t(today)) / dayMs) : null);

// Nejdřív ty, které brzy končí, pak platné, pak budoucí a vypršelé na konci
const ORDER: Record<PowerState, number> = { ending: 0, valid: 1, planned: 2, expired: 3 };
export const sortPowers = <T extends Pick<Power, 'valid_from' | 'valid_to'>>(list: T[], today: string): T[] =>
    [...list].sort((a, b) => ORDER[powerState(a, today)] - ORDER[powerState(b, today)] || (a.valid_to ?? '9999').localeCompare(b.valid_to ?? '9999'));
