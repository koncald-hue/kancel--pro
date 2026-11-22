// Adresy „Skrýt můj e-mail“ od Applu (xxx@privaterelay.appleid.com) přeposílají poštu na skrytou adresu. Pro účty v Kanceláři je
// nepřijímáme: nelze podle nich spolehlivě poznat advokáta ani ho kontaktovat (např. při smazání účtu nebo kvůli platbě).
const BLOCKED_DOMAINS = ['privaterelay.appleid.com'];

export function isBlockedRelayEmail(email: string): boolean {
    const domain = email.trim().toLowerCase().split('@').pop() ?? '';
    return BLOCKED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export const BLOCKED_EMAIL_MESSAGE = 'Adresy ze služby „Skrýt můj e-mail“ od Applu (privaterelay.appleid.com) nepřijímáme. Zadejte prosím svůj skutečný e-mail.';
