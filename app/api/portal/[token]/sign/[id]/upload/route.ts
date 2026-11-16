import { NextResponse } from 'next/server';
import { loadSignRequest, portalGuard } from '@/lib/signServer';

// Kvalifikovaný podpis se dělá mimo aplikaci: klient nahraje podepsaný soubor (běžným nahráváním ve věci) a tady ho přiřadí k žádosti.
// Advokát pak podpis ověří a potvrdí; aplikace platnost kvalifikovaného podpisu sama neposuzuje.
export async function POST(req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
    const { token, id } = await ctx.params;
    const g = await portalGuard(req, token, 'sgu', 30, 60 * 60_000);
    if (g instanceof NextResponse) return g;
    const { db, link } = g;
    const r = await loadSignRequest(db, link, id);
    if (!r || r.status !== 'pending' || r.level !== 'qualified') return NextResponse.json({ error: 'invalid' }, { status: 400 });
    const body = await req.json().catch(() => null) as { fileId?: unknown } | null;
    const fileId = typeof body?.fileId === 'string' ? body.fileId : '';
    const { data: file } = await db.from('case_files').select('id').eq('id', fileId).eq('case_id', link.case_id).eq('source', 'client').maybeSingle();
    if (!file) return NextResponse.json({ error: 'file' }, { status: 400 });
    const { data, error } = await db.from('signature_requests').update({ status: 'awaiting_check', external_file_id: file.id }).eq('id', r.id).eq('status', 'pending').select('id');
    return error || !data?.length ? NextResponse.json({ error: 'failed' }, { status: 500 }) : NextResponse.json({ ok: true });
}
