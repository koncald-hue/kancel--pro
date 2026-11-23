import { NextResponse } from 'next/server';
import { clientIp, rateLimited, serviceClient } from '@/lib/serverSupabase';

// Ověření kódu pro inzerci zdarma na studujpravo.cz: platí jen u kanceláře s aktivním (placeným nebo zkušebním) přístupem.
export async function GET(req: Request) {
    if (await rateLimited(`jc:${clientIp(req)}`, 20, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const code = (new URL(req.url).searchParams.get('code') ?? '').trim().toUpperCase();
    if (!/^KP-[A-F0-9]{10}$/.test(code)) return NextResponse.json({ valid: false });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const { data } = await db.from('lawyer_access').select('status, until, firm_name, display_name').eq('job_code', code).maybeSingle();
    const today = new Date().toISOString().slice(0, 10);
    const valid = !!data && (data.status === 'active' || data.status === 'trial') && (!data.until || String(data.until) >= today);
    return NextResponse.json({ valid, firm: valid ? String(data.firm_name || data.display_name || '') : '' }, { headers: { 'Cache-Control': 'no-store' } });
}
