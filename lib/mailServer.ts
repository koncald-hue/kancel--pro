import { createHash } from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer';
import { simpleParser } from 'mailparser';

// Poštovní most (server): čtení a odesílání pošty přes IMAP a SMTP. Heslo přichází od přihlášeného advokáta jen k jednomu volání,
// server ho neukládá ani nezapisuje do logů. Spojení se vytváří jen s veřejnými adresami (ochrana před zneužitím serveru k průniku do vnitřní sítě).
export type MailCreds = { email: string; password: string; imapHost: string; imapPort: number; smtpHost: string; smtpPort: number; sentFolder?: string; skipAppend?: boolean };

export { PRESETS } from './mailPresets';
const ALLOWED_PORTS = new Set([993, 143, 465, 587]);

export function isPrivateIp(ip: string): boolean {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
    }
    if (net.isIPv6(ip)) {
        const l = ip.toLowerCase();
        if (l.startsWith('::ffff:')) return isPrivateIp(l.slice(7));
        return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe8') || l.startsWith('fe9') || l.startsWith('fea') || l.startsWith('feb');
    }
    return true;
}
// Přeloží název serveru na veřejnou adresu; adresa se pak používá přímo (proti podvržení DNS mezi kontrolou a připojením)
export async function resolvePublic(host: string): Promise<string> {
    if (!/^[A-Za-z0-9.-]{3,200}$/.test(host)) throw new Error('Neplatný název serveru.');
    const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('Tento server nelze použít.');
    return addrs[0].address;
}
export function validateCreds(c: Partial<MailCreds>): MailCreds {
    const email = String(c.email ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !c.password || String(c.password).length > 300) throw new Error('Chybí e-mail nebo heslo.');
    const imapPort = Number(c.imapPort); const smtpPort = Number(c.smtpPort);
    if (!ALLOWED_PORTS.has(imapPort) || !ALLOWED_PORTS.has(smtpPort)) throw new Error('Nepovolený port.');
    // Gmail zobrazuje heslo pro aplikace po čtveřicích oddělených mezerami; mezery se ignorují
    const imapHost = String(c.imapHost ?? '').trim().toLowerCase();
    const password = imapHost === 'imap.gmail.com' ? String(c.password).replace(/\s+/g, '') : String(c.password);
    return { email, password, imapHost: String(c.imapHost ?? '').trim().toLowerCase(), imapPort, smtpHost: String(c.smtpHost ?? '').trim().toLowerCase(), smtpPort, sentFolder: c.sentFolder ? String(c.sentFolder).slice(0, 120) : undefined, skipAppend: !!c.skipAppend };
}

// Spojení s poštovním serverem se krátce (do jedné minuty) drží otevřené, aby se při procházení pošty nemuselo pokaždé znovu navazovat a přihlašovat.
// Spojení je jen v paměti serveru, klíčované otiskem přihlašovacích údajů, a po nečinnosti se samo ukončí.
type Pooled = { client: ImapFlow; timer: ReturnType<typeof setTimeout> | null; dead: boolean };
const pool = new Map<string, Promise<Pooled>>();
const IDLE_MS = 60_000;
const keyOf = (c: MailCreds) => createHash('sha256').update(`${c.email}\n${c.imapHost}\n${c.imapPort}\n${c.password}`).digest('hex');

async function connect(c: MailCreds): Promise<ImapFlow> {
    const ip = await resolvePublic(c.imapHost);
    const client = new ImapFlow({ host: ip, port: c.imapPort, secure: c.imapPort === 993, servername: c.imapHost, auth: { user: c.email, pass: c.password }, logger: false, tls: { servername: c.imapHost, minVersion: 'TLSv1.2' }, socketTimeout: 25_000 });
    client.on('error', () => undefined);
    await client.connect();
    return client;
}
export async function withImap<T>(c: MailCreds, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    const key = keyOf(c);
    let entry = pool.get(key);
    if (entry) { const e = await entry.catch(() => null); if (!e || e.dead || !e.client.usable) { pool.delete(key); entry = undefined; } }
    if (!entry) {
        entry = connect(c).then((client) => { const p: Pooled = { client, timer: null, dead: false }; client.on('close', () => { p.dead = true; if (p.timer) clearTimeout(p.timer); if (pool.get(key) === entry) pool.delete(key); }); return p; });
        pool.set(key, entry);
        entry.catch(() => { if (pool.get(key) === entry) pool.delete(key); });
    }
    const p = await entry;
    if (p.timer) clearTimeout(p.timer);
    try { return await fn(p.client); }
    catch (e) { if (!p.client.usable) { p.dead = true; pool.delete(key); } throw e; }
    finally {
        if (!p.dead) { p.timer = setTimeout(() => { p.dead = true; pool.delete(key); void p.client.logout().catch(() => undefined); }, IDLE_MS); p.timer.unref?.(); }
    }
}
export async function smtpTransport(c: MailCreds) {
    const ip = await resolvePublic(c.smtpHost);
    return nodemailer.createTransport({ host: ip, port: c.smtpPort, secure: c.smtpPort === 465, requireTLS: c.smtpPort === 587, auth: { user: c.email, pass: c.password }, tls: { servername: c.smtpHost, minVersion: 'TLSv1.2' }, connectionTimeout: 15_000, socketTimeout: 25_000 });
}

export type MsgSummary = { uid: number; seq: number; from: string; fromEmail: string; to: string; subject: string; date: string | null; seen: boolean; attachments: boolean };
const addr = (a?: { name?: string; address?: string }[]) => (a ?? []).map((x) => (x.name ? `${x.name} <${x.address ?? ''}>` : x.address ?? '')).join(', ');

export async function listFolders(c: MailCreds) {
    return withImap(c, async (cl) => (await cl.list()).map((f) => ({ path: f.path, name: f.name, special: f.specialUse ?? '' })));
}
type Node = { part?: string; type?: string; disposition?: string; dispositionParameters?: Record<string, string>; parameters?: Record<string, string>; size?: number; childNodes?: Node[] };
const fileName = (n: Node) => n.dispositionParameters?.filename ?? n.parameters?.name ?? '';
const isAttachment = (n: Node) => !n.childNodes?.length && !!n.part && (n.disposition === 'attachment' || (!!fileName(n) && n.disposition !== 'inline'));
const hasAttach = (n: Node | undefined): boolean => !!n && (isAttachment(n) || (n.childNodes ?? []).some(hasAttach));
function attachmentsOf(n: Node | undefined, out: { part: string; filename: string; contentType: string; size: number }[] = []) {
    if (!n) return out;
    if (isAttachment(n)) out.push({ part: n.part as string, filename: fileName(n) || `priloha-${out.length + 1}`, contentType: n.type ?? 'application/octet-stream', size: n.size ?? 0 });
    for (const ch of n.childNodes ?? []) attachmentsOf(ch, out);
    return out;
}

// `before` je pořadové číslo nejstarší už načtené zprávy; novější zprávy se berou přímo z konce schránky bez prohledávání celé schránky
export async function listMessages(c: MailCreds, folder: string, opt: { before?: number; query?: string; limit?: number }): Promise<{ messages: MsgSummary[]; total: number }> {
    return withImap(c, async (cl) => {
        const lock = await cl.getMailboxLock(folder, { readOnly: true });
        try {
            const total = (cl.mailbox && typeof cl.mailbox === 'object' ? cl.mailbox.exists : 0) ?? 0;
            const limit = Math.min(opt.limit ?? 30, 60);
            const out: MsgSummary[] = [];
            const push = (m: { uid: number; seq: number; envelope?: { from?: { name?: string; address?: string }[]; to?: { name?: string; address?: string }[]; subject?: string; date?: Date | string }; flags?: Set<string>; bodyStructure?: unknown }) => out.push({ uid: m.uid, seq: m.seq, from: addr(m.envelope?.from), fromEmail: m.envelope?.from?.[0]?.address ?? '', to: addr(m.envelope?.to), subject: m.envelope?.subject ?? '(bez předmětu)', date: m.envelope?.date ? new Date(m.envelope.date).toISOString() : null, seen: m.flags?.has('\\Seen') ?? false, attachments: hasAttach(m.bodyStructure as Node) });
            const fields = { uid: true, envelope: true, flags: true, bodyStructure: true } as const;
            if (opt.query?.trim()) {
                const q = opt.query.trim().slice(0, 120);
                const seqs = ((await cl.search({ or: [{ from: q }, { subject: q }, { to: q }] })) || []).sort((a, b) => b - a).filter((n) => !opt.before || n < opt.before).slice(0, limit);
                if (seqs.length) for await (const m of cl.fetch(seqs, fields)) push(m);
            } else if (total > 0) {
                const end = (opt.before ?? total + 1) - 1; const start = Math.max(1, end - limit + 1);
                if (end >= start) for await (const m of cl.fetch(`${start}:${end}`, fields)) push(m);
            }
            return { messages: out.sort((a, b) => b.seq - a.seq), total };
        } finally { lock.release(); }
    });
}

export type FullMessage = { uid: number; messageId: string; references: string[]; from: string; fromEmail: string; to: string; cc: string; subject: string; date: string | null; text: string; html: string; attachments: { index: number; filename: string; contentType: string; size: number }[] };
export async function readMessage(c: MailCreds, folder: string, uid: number, markSeen: boolean): Promise<FullMessage> {
    return withImap(c, async (cl) => {
        const lock = await cl.getMailboxLock(folder);
        try {
            // Stahuje se jen začátek zprávy (texty); přílohy se stahují zvlášť, až o ně uživatel požádá
            const msg = await cl.fetchOne(String(uid), { uid: true, bodyStructure: true, source: { maxLength: 400_000 } }, { uid: true });
            if (!msg || !msg.source) throw new Error('Zpráva nebyla nalezena.');
            const p = await simpleParser(msg.source);
            if (markSeen) void cl.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true }).catch(() => undefined);
            const atts = attachmentsOf(msg.bodyStructure as Node);
            return { uid, messageId: p.messageId ?? '', references: Array.isArray(p.references) ? p.references : p.references ? [p.references] : [], from: p.from?.text ?? '', fromEmail: p.from?.value?.[0]?.address ?? '', to: p.to ? (Array.isArray(p.to) ? p.to.map((x) => x.text).join(', ') : p.to.text) : '', cc: p.cc ? (Array.isArray(p.cc) ? p.cc.map((x) => x.text).join(', ') : p.cc.text) : '', subject: p.subject ?? '(bez předmětu)', date: p.date ? p.date.toISOString() : null, text: (p.text ?? '').slice(0, 200_000), html: typeof p.html === 'string' ? p.html.slice(0, 600_000) : '', attachments: atts.map((a, i) => ({ index: i, filename: a.filename, contentType: a.contentType, size: a.size })) };
        } finally { lock.release(); }
    });
}
export async function readAttachment(c: MailCreds, folder: string, uid: number, index: number): Promise<{ filename: string; contentType: string; base64: string }> {
    return withImap(c, async (cl) => {
        const lock = await cl.getMailboxLock(folder, { readOnly: true });
        try {
            const msg = await cl.fetchOne(String(uid), { uid: true, bodyStructure: true }, { uid: true });
            const a = msg ? attachmentsOf(msg.bodyStructure as Node)[index] : undefined;
            if (!a) throw new Error('Příloha nebyla nalezena.');
            if (a.size > 20 * 1024 * 1024) throw new Error('Příloha je větší než 15 MB.');
            const dl = await cl.download(String(uid), a.part, { uid: true, maxBytes: 22 * 1024 * 1024 });
            if (!dl?.content) throw new Error('Příloha nebyla nalezena.');
            const chunks: Buffer[] = []; let total = 0;
            for await (const ch of dl.content) { const b = Buffer.from(ch); total += b.length; if (total > 15 * 1024 * 1024) throw new Error('Příloha je větší než 15 MB.'); chunks.push(b); }
            return { filename: a.filename, contentType: a.contentType, base64: Buffer.concat(chunks).toString('base64') };
        } finally { lock.release(); }
    });
}

export type OutMail = { to: string; cc?: string; subject: string; text: string; inReplyTo?: string; references?: string[]; attachments?: { filename: string; contentType: string; base64: string }[] };
export async function sendMail(c: MailCreds, m: OutMail): Promise<{ saved: boolean }> {
    const tr = await smtpTransport(c);
    const mail = { from: c.email, to: m.to, cc: m.cc || undefined, subject: m.subject, text: m.text, inReplyTo: m.inReplyTo || undefined, references: m.references?.length ? m.references : undefined, attachments: (m.attachments ?? []).map((a) => ({ filename: a.filename, contentType: a.contentType, content: Buffer.from(a.base64, 'base64') })) };
    await tr.sendMail(mail);
    // Kopie do složky Odeslané (Gmail ji ukládá sám)
    if (c.skipAppend) return { saved: true };
    try {
        const raw = await new MailComposer(mail).compile().build();
        await withImap(c, async (cl) => {
            const folder = c.sentFolder || (await cl.list()).find((f) => f.specialUse === '\\Sent')?.path;
            if (!folder) throw new Error('no sent folder');
            await cl.append(folder, raw, ['\\Seen']);
        });
        return { saved: true };
    } catch { return { saved: false }; }
}

export async function testAccount(c: MailCreds): Promise<{ sentFolder: string }> {
    const sent = await withImap(c, async (cl) => (await cl.list()).find((f) => f.specialUse === '\\Sent')?.path ?? '');
    const tr = await smtpTransport(c);
    await tr.verify();
    return { sentFolder: sent };
}
