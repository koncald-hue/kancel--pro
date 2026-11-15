import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/serverSupabase';

// Webhook platební brány: potvrdí zaplacenou objednávku předplatného advokáta a automaticky mu prodlouží přístup.
// Požadavek musí být podepsaný (HMAC-SHA256 z "<orderId>.<reference>" tajemstvím PAYMENT_WEBHOOK_SECRET, hlavička x-signature).
// Platba od advokáta bez vyplněného profilu se v databázi neaktivuje, ale označí se k vrácení peněz.
export async function POST(req: Request) {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

    const body = await req.json().catch(() => null);
    const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
    const reference = typeof body?.reference === 'string' ? body.reference : '';
    const signature = req.headers.get('x-signature') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(orderId) || !reference) return NextResponse.json({ error: 'invalid' }, { status: 400 });

    const expected = createHmac('sha256', secret).update(`${orderId}.${reference}`).digest('hex');
    const a = Buffer.from(signature, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const { data, error } = await db.rpc('apply_lawyer_payment', { p_order: orderId, p_ref: reference });
    if (error) { console.warn('[lawyer-webhook] failed:', error.message); return NextResponse.json({ error: 'failed' }, { status: 500 }); }
    return NextResponse.json({ result: data });
}
