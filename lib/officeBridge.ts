// Tenký obal nad Office.js (Word a Outlook) s příslibovým rozhraním. Office se dá podstrčit, takže jde otestovat bez Office.
/* eslint-disable @typescript-eslint/no-explicit-any */
type OfficeLike = any;
const call = <T>(fn: (cb: (r: any) => void) => void, officeOk: string): Promise<T> => new Promise((resolve, reject) => {
    try { fn((r) => (r.status === officeOk ? resolve(r.value as T) : reject(new Error(r.error?.message ?? 'Operace v Office selhala.')))); } catch (e) { reject(e instanceof Error ? e : new Error('Office není dostupný.')); }
});
const officeOf = (o?: OfficeLike): OfficeLike => { const x = o ?? (typeof window !== 'undefined' ? (window as any).Office : undefined); if (!x) throw new Error('Rozhraní Office není načtené. Otevřete doplněk uvnitř Wordu nebo Outlooku.'); return x; };
const OK = 'succeeded';

export type MailInfo = { subject: string; fromName: string; fromEmail: string; to: string[]; body: string; received: string | null; attachments: { id: string; name: string; size: number; contentType: string; inline: boolean }[] };

// ---- Word
export async function wordFile(office?: OfficeLike): Promise<{ name: string; blob: Blob }> {
    const O = officeOf(office); const doc = O.context.document;
    const file = await call<any>((cb) => doc.getFileAsync(O.FileType.Compressed, { sliceSize: 262144 }, cb), OK);
    try {
        const parts: Uint8Array[] = [];
        for (let i = 0; i < file.sliceCount; i++) { const s = await call<any>((cb) => file.getSliceAsync(i, cb), OK); parts.push(Uint8Array.from(s.data as number[])); }
        const url: string = doc.url || '';
        const base = decodeURIComponent(url.split(/[\\/]/).pop() || '') || 'Dokument.docx';
        return { name: /\.docx?$/i.test(base) ? base : `${base}.docx`, blob: new Blob(parts as BlobPart[], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }) };
    } finally { try { file.closeAsync(() => undefined); } catch { /* nic */ } }
}
export function wordInsertText(text: string, office?: OfficeLike): Promise<void> {
    const O = officeOf(office);
    return call<void>((cb) => O.context.document.setSelectedDataAsync(text, { coercionType: O.CoercionType.Text }, cb), OK);
}

// ---- Outlook
export async function mailInfo(office?: OfficeLike): Promise<MailInfo> {
    const O = officeOf(office); const item = O.context.mailbox?.item; if (!item) throw new Error('Otevřete zprávu v Outlooku.');
    const body = await call<string>((cb) => item.body.getAsync(O.CoercionType.Text, cb), OK);
    const addr = (a: any) => (a?.emailAddress ?? '').toString();
    return {
        subject: item.subject ?? '', fromName: item.from?.displayName ?? '', fromEmail: addr(item.from), to: (item.to ?? []).map(addr).filter(Boolean), body: body ?? '',
        received: item.dateTimeCreated ? new Date(item.dateTimeCreated).toISOString() : null,
        attachments: (item.attachments ?? []).map((a: any) => ({ id: a.id, name: a.name, size: a.size ?? 0, contentType: a.contentType ?? '', inline: !!a.isInline })),
    };
}
export async function mailAttachment(id: string, name: string, contentType: string, office?: OfficeLike): Promise<File | null> {
    const O = officeOf(office); const item = O.context.mailbox.item;
    const v = await call<any>((cb) => item.getAttachmentContentAsync(id, cb), OK);
    if (v.format !== 'base64') return null; // vložené zprávy a odkazy se neukládají jako soubor
    const bin = atob(v.content); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type: contentType || 'application/octet-stream' });
}
export const insideOffice = () => typeof window !== 'undefined' && !!(window as any).Office?.context;
