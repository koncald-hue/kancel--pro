// Značky ukázkových dat: podle nich se ukázka nepočítá do průvodce, připomínkových e-mailů ani trychtýře
export const DEMO_CASE_PREFIX = 'Ukázka:';
export const DEMO_MARK = '(ukázka)';
export const isDemoTitle = (title?: string | null) => (title ?? '').startsWith(DEMO_CASE_PREFIX);
export const isDemoName = (name?: string | null) => (name ?? '').toLowerCase().includes(DEMO_MARK);
// Filtry pro dotazy do databáze (počty skutečné práce bez ukázky)
export const DEMO_CASE_LIKE = `${DEMO_CASE_PREFIX}%`;
export const DEMO_MARK_LIKE = `%${DEMO_MARK}%`;
