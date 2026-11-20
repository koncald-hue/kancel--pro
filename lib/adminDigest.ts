// Denní shrnutí pro správce: co čeká na vyřízení a co je nového. Posílá se jen tehdy, když je co hlásit.
export type DigestInput = {
    pendingVerifications: string[]; // e-maily, kteří čekají na ověření totožnosti
    refundDue: { email: string; price: number }[];
    newRegistrations: number;
    failedRenewals: number;
};

export function buildAdminDigest(d: DigestInput, adminUrl: string): { subject: string; lines: string[] } | null {
    const needsAction = d.pendingVerifications.length > 0 || d.refundDue.length > 0;
    if (!needsAction && d.newRegistrations === 0 && d.failedRenewals === 0) return null;
    const lines: string[] = [];
    if (d.pendingVerifications.length) {
        lines.push(`Čeká na ověření totožnosti: ${d.pendingVerifications.length}`, ...d.pendingVerifications.slice(0, 10).map((e) => `  · ${e}`));
        if (d.pendingVerifications.length > 10) lines.push(`  … a dalších ${d.pendingVerifications.length - 10}`);
        lines.push('');
    }
    if (d.refundDue.length) {
        lines.push(`Platby k vrácení peněz: ${d.refundDue.length}`, ...d.refundDue.slice(0, 10).map((r) => `  · ${r.email} (${r.price} Kč)`), '');
    }
    if (d.failedRenewals) lines.push(`Selhalo automatické obnovení předplatného (za posledních 24 h): ${d.failedRenewals}`, '');
    if (d.newRegistrations) lines.push(`Nových registrací za posledních 24 h: ${d.newRegistrations}`, '');
    lines.push(adminUrl);
    return { subject: needsAction ? 'Kancelář Pro: vyžaduje vaši akci' : 'Kancelář Pro: denní shrnutí', lines };
}
