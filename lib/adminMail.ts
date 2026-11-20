import { mailConfigured, sendMail } from './mail';

// Oznámení správci Kanceláře (platba, věci k vyřízení). Adresa je v ADMIN_NOTIFY_EMAIL; bez ní nebo bez nastaveného e-mailu
// se nic neposílá. Chyba e-mailu nikdy nesmí zrušit vlastní akci, proto se jen zaloguje.
export async function notifyAdmin(subject: string, lines: string[]): Promise<boolean> {
    const to = process.env.ADMIN_NOTIFY_EMAIL?.trim();
    if (!to || !mailConfigured()) return false;
    try { await sendMail(to, subject, lines.join('\n')); return true; } catch (e) { console.warn('[admin-mail]', (e as Error).message); return false; }
}
