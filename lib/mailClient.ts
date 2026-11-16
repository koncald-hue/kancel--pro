import { supabase } from './supabase';
import { decryptText } from './e2ee';
import type { MailCreds } from './mailServer';

export type MailAccountRow = { id: string; label: string; email: string; preset: string; imap_host: string; imap_port: number; smtp_host: string; smtp_port: number; sent_folder: string; skip_append: boolean; enc_password: string };
export type MsgSummary = { uid: number; from: string; fromEmail: string; to: string; subject: string; date: string | null; seen: boolean; attachments: boolean };
export type FullMessage = { uid: number; messageId: string; references: string[]; from: string; fromEmail: string; to: string; cc: string; subject: string; date: string | null; text: string; html: string; attachments: { index: number; filename: string; contentType: string; size: number }[] };

export async function credsOf(master: CryptoKey, a: MailAccountRow): Promise<MailCreds> {
    return { email: a.email, password: await decryptText(master, a.enc_password), imapHost: a.imap_host, imapPort: a.imap_port, smtpHost: a.smtp_host, smtpPort: a.smtp_port, sentFolder: a.sent_folder || undefined, skipAppend: a.skip_append };
}

export async function mailApi<T = Record<string, unknown>>(action: string, creds: MailCreds, extra: Record<string, unknown> = {}): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/mail', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ action, creds, ...extra }) });
    const json = await res.json().catch(() => ({})) as T & { message?: string };
    if (!res.ok) throw new Error(json.message ?? 'Pošta zatím neodpovídá. Zkuste to znovu.');
    return json;
}

export const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
export async function fileToB64(f: File): Promise<string> {
    const bytes = new Uint8Array(await f.arrayBuffer()); let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
}
// Dokument pro bezpečné zobrazení: žádné skripty, žádné vzdálené obrázky (sledovací pixely), jen vložená data
export const safeHtml = (html: string) => `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><base target="_blank"><style>body{font:14px/1.5 system-ui,sans-serif;color:#0f172a;margin:12px;word-wrap:break-word}img{max-width:100%;height:auto}</style>${html}`;
export const quoted = (m: Pick<FullMessage, 'from' | 'date' | 'text'>) => `\n\nDne ${m.date ? new Date(m.date).toLocaleString('cs-CZ') : ''} napsal(a) ${m.from}:\n${m.text.split('\n').slice(0, 60).map((l) => `> ${l}`).join('\n')}`;
