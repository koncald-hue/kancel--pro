// Zpětná vazba od uživatelů: druhy zpráv a kontrola před odesláním. Čisté funkce.
export type FeedbackKind = 'problem' | 'napad' | 'jine';
export const FEEDBACK_KINDS: { id: FeedbackKind; label: string }[] = [
    { id: 'problem', label: 'Něco nejde' },
    { id: 'napad', label: 'Něco mi chybí' },
    { id: 'jine', label: 'Jiné' },
];
export const FEEDBACK_MIN = 5;
export const FEEDBACK_MAX = 2000;

export function validateFeedback(d: { kind: string; message: string }): string | null {
    if (!FEEDBACK_KINDS.some((k) => k.id === d.kind)) return 'Vyberte, o co jde.';
    const n = d.message.trim().length;
    if (n < FEEDBACK_MIN) return `Napište alespoň ${FEEDBACK_MIN} znaků.`;
    if (n > FEEDBACK_MAX) return `Zpráva může mít nejvýše ${FEEDBACK_MAX} znaků.`;
    return null;
}

// Do zprávy se ukládá jen cesta stránky, bez parametrů a odkazů (mohly by obsahovat citlivé údaje)
export function pageOnly(path: string): string {
    return path.split(/[?#]/)[0].replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id').slice(0, 200);
}
