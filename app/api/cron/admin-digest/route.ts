import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/serverSupabase';
import { notifyAdmin } from '@/lib/adminMail';
import { buildAdminDigest } from '@/lib/adminDigest';
import { getSiteOrigin } from '@/lib/siteUrl';

const sameSecret = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

// Denní shrnutí správci (Authorization: Bearer <CRON_SECRET>): ověření totožnosti, platby k vrácení, selhaná obnovení a nové registrace.
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || !sameSecret(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const since = new Date(Date.now() - 86_400_000).toISOString();

    const [ver, refunds, regs, failed] = await Promise.all([
        db.from('lawyer_access').select('email').eq('verification_status', 'pending').limit(50),
        db.from('lawyer_orders').select('user_id, price_czk').eq('status', 'refund_due').limit(50),
        db.from('lawyer_access').select('user_id', { count: 'exact', head: true }).gte('created_at', since),
        db.from('lawyer_recurring').select('user_id', { count: 'exact', head: true }).eq('active', false).gte('updated_at', since).gte('fails', 3),
    ]);
    const ids = (refunds.data ?? []).map((r) => r.user_id as string);
    const { data: owners } = ids.length ? await db.from('lawyer_access').select('user_id, email').in('user_id', ids) : { data: [] as { user_id: string; email: string }[] };
    const emailOf = new Map((owners ?? []).map((o) => [o.user_id as string, String(o.email ?? '')]));

    const origin = getSiteOrigin() || new URL(req.url).origin;
    const digest = buildAdminDigest({
        pendingVerifications: (ver.data ?? []).map((r) => String(r.email ?? '')),
        refundDue: (refunds.data ?? []).map((r) => ({ email: emailOf.get(r.user_id as string) || 'neznámý účet', price: Number(r.price_czk) })),
        newRegistrations: regs.count ?? 0,
        failedRenewals: failed.count ?? 0,
    }, `${origin}/admin`);
    if (!digest) return NextResponse.json({ sent: false });
    const sent = await notifyAdmin(digest.subject, digest.lines);
    return NextResponse.json({ sent });
}
