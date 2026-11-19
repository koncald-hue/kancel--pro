import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimited, serviceClient } from '@/lib/serverSupabase';
import { comgateConfig, createPayment } from '@/lib/comgate';

// Založí platbu u Comgate pro čekající objednávku přihlášeného advokáta a vrátí adresu platební brány.
export async function POST(req: Request) {
    const cfg = comgateConfig();
    if (!cfg) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder', { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: u, error } = await user.auth.getUser(token);
    if (error || !u.user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (await rateLimited(`pay:${u.user.id}`, 10, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });

    const body = await req.json().catch(() => null) as { orderId?: unknown } | null;
    const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: 'invalid' }, { status: 400 });

    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const { data: order } = await db.from('lawyer_orders').select('id, user_id, price_czk, status').eq('id', orderId).maybeSingle();
    if (!order || order.user_id !== u.user.id || order.status !== 'pending') return NextResponse.json({ error: 'notfound' }, { status: 404 });

    const pay = await createPayment(cfg, { orderId, priceCzk: Number(order.price_czk), label: 'Kancelar', email: u.user.email });
    if (!pay) return NextResponse.json({ error: 'gateway' }, { status: 502 });
    return NextResponse.json({ redirect: pay.redirect });
}
