// Recenze uživatelů: kdy se zeptat, jak je ověřit a jak se zobrazí na úvodní stránce. Čisté funkce.
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type Review = { id: string; rating: number; body: string; display_name: string; role_label: string; status: ReviewStatus; created_at: string };
export type ReviewDraft = { rating: number; body: string; display_name: string; role_label: string; consent: boolean };

export const REVIEW_BODY_MIN = 20;
export const REVIEW_BODY_MAX = 600;
// Zeptáme se, až si uživatel aplikaci několik dní zkouší; pak nejdřív za dva týdny po odložení
export const ASK_AFTER_DAYS = 5;
export const SNOOZE_DAYS = 14;

export function validateReview(d: ReviewDraft): string | null {
    if (!Number.isInteger(d.rating) || d.rating < 1 || d.rating > 5) return 'Vyberte počet hvězdiček.';
    const body = d.body.trim();
    if (body.length < REVIEW_BODY_MIN) return `Napište aspoň ${REVIEW_BODY_MIN} znaků.`;
    if (body.length > REVIEW_BODY_MAX) return `Nejvýš ${REVIEW_BODY_MAX} znaků.`;
    const name = d.display_name.trim();
    if (name.length < 2) return 'Uveďte jméno, pod kterým se má recenze zobrazit.';
    if (name.length > 80 || d.role_label.trim().length > 80) return 'Jméno a popis mohou mít nejvýš 80 znaků.';
    if (!d.consent) return 'Bez souhlasu se zveřejněním recenzi poslat nejde.';
    return null;
}

const DAY = 86_400_000;
// Má se uživateli nabídnout recenze? Ne, když už ji poslal nebo ji nedávno odložil, nebo když aplikaci zkouší krátce.
export function shouldAskReview(i: { registeredAt: string | null; hasReview: boolean; snoozedAt: number | null; now?: number }): boolean {
    const now = i.now ?? Date.now();
    if (i.hasReview || !i.registeredAt) return false;
    if (now - new Date(i.registeredAt).getTime() < ASK_AFTER_DAYS * DAY) return false;
    if (i.snoozedAt && now - i.snoozedAt < SNOOZE_DAYS * DAY) return false;
    return true;
}

// Výchozí jméno z profilu: celé jméno a příjmení
export const suggestName = (displayName: string | undefined | null) => (displayName ?? '').trim().slice(0, 80);
