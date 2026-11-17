import { NextResponse } from 'next/server';
import { clientIp, findActiveLink, rateLimited, serviceClient } from '@/lib/serverSupabase';
import { isAllowedUpload, MAX_UPLOAD_BYTES } from '@/lib/portal';
import { safeFileName } from '@/lib/caseFile';
import { secondFactorBlock, type FactorLink } from '@/lib/portalSession';

const MAX_CASE_BYTES = 100 * 1024 * 1024;

// Klient nahrává soubor ke své věci; uloží se do soukromého úložiště advokáta
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
    const { token } = await ctx.params;
    if (await rateLimited(`up:${clientIp(req)}`, 30, 60 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const link = await findActiveLink(db, token);
    if (!link) return NextResponse.json({ error: 'notfound' }, { status: 404 });
    if (!link.verified) return NextResponse.json({ error: 'unverified' }, { status: 403 });
    if (!link.subscribed) return NextResponse.json({ error: 'inactive' }, { status: 403 });
    const block = await secondFactorBlock(db, link as FactorLink, req);
    if (block) return block;
    if (!(link as { onboarded_at?: string | null }).onboarded_at) return NextResponse.json({ error: 'not-onboarded' }, { status: 403 });

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    const requestIdRaw = form?.get('requestId');
    if (!(file instanceof File)) return NextResponse.json({ error: 'nofile' }, { status: 400 });
    // End-to-end šifrovaný soubor: obsah i název jsou zašifrované v prohlížeči klienta, server vidí jen náhodná data
    const encName = typeof form?.get('encName') === 'string' ? String(form?.get('encName')) : '';
    const encrypted = form?.get('enc') === '1' && encName.startsWith('e1:') && encName.length <= 900;
    if (form?.get('enc') === '1' && !encrypted) return NextResponse.json({ error: 'invalid', message: 'Neplatný šifrovaný soubor.' }, { status: 400 });
    if (encrypted) {
        if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES + 64) return NextResponse.json({ error: 'invalid', message: 'Soubor je větší než 15 MB.' }, { status: 400 });
    } else {
        const problem = isAllowedUpload(file.name, file.size);
        if (problem) return NextResponse.json({ error: 'invalid', message: problem }, { status: 400 });
        if (link.e2ee) return NextResponse.json({ error: 'invalid', message: 'Tato věc vyžaduje šifrované nahrávání.' }, { status: 400 });
    }

    let requestId: string | null = null;
    if (typeof requestIdRaw === 'string' && requestIdRaw) {
        const { data } = await db.from('client_requests').select('id').eq('id', requestIdRaw).eq('case_id', link.case_id).maybeSingle();
        if (!data) return NextResponse.json({ error: 'invalid', message: 'Neplatná položka.' }, { status: 400 });
        requestId = data.id as string;
    }

    const { data: sizes } = await db.from('case_files').select('size').eq('case_id', link.case_id);
    const used = (sizes ?? []).reduce((s, r) => s + Number(r.size ?? 0), 0);
    if (used + file.size > MAX_CASE_BYTES) return NextResponse.json({ error: 'invalid', message: 'Spis dosáhl limitu velikosti. Kontaktujte prosím advokáta.' }, { status: 400 });

    const path = `${link.user_id}/${link.case_id}/${crypto.randomUUID()}-${encrypted ? 'sifrovano.bin' : safeFileName(file.name)}`;
    const { error: uploadError } = await db.storage.from('case-files').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: encrypted ? 'application/octet-stream' : file.type || undefined });
    if (uploadError) { console.warn('[portal] upload failed:', uploadError.message); return NextResponse.json({ error: 'failed' }, { status: 500 }); }

    const { data: row, error: insertError } = await db.from('case_files').insert({ case_id: link.case_id, user_id: link.user_id, name: encrypted ? encName : file.name, path, size: file.size, mime: encrypted ? '' : file.type, source: 'client', client_visible: true, request_id: requestId, enc: encrypted }).select('id, name, size, created_at, source, request_id, client_visible, enc').single();
    if (insertError) { await db.storage.from('case-files').remove([path]); return NextResponse.json({ error: 'failed' }, { status: 500 }); }
    return NextResponse.json({ file: row });
}
