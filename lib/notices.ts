// Upozornění od správce přímo v Kanceláři: kontrola před odesláním a výběr adresátů. Čisté funkce.
export type NoticeDraft = { title: string; body: string; link: string };
export const NOTICE_TITLE = [3, 120] as const;
export const NOTICE_BODY = [5, 1500] as const;

export function validateNotice(d: NoticeDraft, recipients: number): string | null {
    if (recipients < 1) return 'Vyberte aspoň jednoho uživatele.';
    const t = d.title.trim().length, b = d.body.trim().length;
    if (t < NOTICE_TITLE[0] || t > NOTICE_TITLE[1]) return `Nadpis musí mít ${NOTICE_TITLE[0]} až ${NOTICE_TITLE[1]} znaků.`;
    if (b < NOTICE_BODY[0] || b > NOTICE_BODY[1]) return `Zpráva musí mít ${NOTICE_BODY[0]} až ${NOTICE_BODY[1]} znaků.`;
    if (!isInternalLink(d.link)) return 'Odkaz musí začínat lomítkem, například /kancelar/veci.';
    return null;
}

// Odkaz smí vést jen na stránku uvnitř aplikace (ne na cizí web), aby ho nešlo zneužít k podvodu
export function isInternalLink(link: string): boolean {
    const l = link.trim();
    return l === '' || (l.startsWith('/') && !l.startsWith('//') && !/[\s\\]/.test(l) && l.length <= 200);
}

export type Recipient = { user_id: string; email: string; display_name: string; status: string };
export function filterRecipients(list: Recipient[], q: string): Recipient[] {
    const n = q.trim().toLowerCase();
    return n ? list.filter((r) => `${r.email} ${r.display_name}`.toLowerCase().includes(n)) : list;
}
