import { NextResponse } from 'next/server';
import { clientIp, findActiveLink, rateLimited, serviceClient } from '@/lib/serverSupabase';
import { secondFactorBlock, type FactorLink } from '@/lib/portalSession';

// Stažení souboru klientem: jen zpřístupněné soubory a jeho vlastní nahrané; odkaz platí 60 sekund
export async function GET(req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
    const { token, id } = await ctx.params;
    if (await rateLimited(`dl:${clientIp(req)}`, 120, 60 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const link = await findActiveLink(db, token);
    if (!link) return NextResponse.json({ error: 'notfound' }, { status: 404 });
    if (!link.verified) return NextResponse.json({ error: 'unverified' }, { status: 403 });
    if (!link.subscribed) return NextResponse.json({ error: 'inactive' }, { status: 403 });
    const block = await secondFactorBlock(db, link as FactorLink, req);
    if (block) return block;
    if (!(link as { onboarded_at?: string | null }).onboarded_at) return NextResponse.json({ error: 'not-onboarded' }, { status: 403 });

    const { data: file } = await db.from('case_files').select('path, name, client_visible, source, enc').eq('id', id).eq('case_id', link.case_id).maybeSingle();
    if (!file || !(file.client_visible || file.source === 'client')) return NextResponse.json({ error: 'notfound' }, { status: 404 });

    // Šifrované soubory se stahují jako zašifrovaná data a dešifruje je prohlížeč; název nesmí být v adrese
    const encrypted = Boolean(file.enc);
    const { data, error } = await db.storage.from('case-files').createSignedUrl(file.path as string, 60, encrypted ? undefined : { download: file.name as string });
    if (error || !data) return NextResponse.json({ error: 'failed' }, { status: 500 });
    if (new URL(req.url).searchParams.get('json') === '1') return NextResponse.json({ url: data.signedUrl, name: file.name, enc: encrypted });
    return NextResponse.redirect(data.signedUrl, 302);
}
