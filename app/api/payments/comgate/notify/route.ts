import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/serverSupabase';
import { notifyAdmin } from '@/lib/adminMail';
import { sendInvoiceForOrder } from '@/lib/invoiceMail';
import { comgateConfig, getStatus, isPaidFor } from '@/lib/comgate';

// Oznámení o změně stavu platby od Comgate (adresu nastavte v klientském portálu Comgate).
// Přijatým údajům se nevěří: stav se znovu zjistí přímo u Comgate podle transId a porovná s naší objednávkou.
// Comgate očekává odpověď "code=0&message=OK", jinak oznámení opakuje.
const reply = (ok: boolean, status = 200) => new NextResponse(ok ? 'code=0&message=OK' : 'code=1&message=ERROR', { status, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

export async function POST(req: Request) {
    const cfg = comgateConfig();
    if (!cfg) return reply(false, 503);
    const form = new URLSearchParams(await req.text().catch(() => ''));
    const transId = form.get('transId') ?? '';
    if (!/^[A-Za-z0-9-]{4,40}$/.test(transId)) return reply(false, 400);

    const st = await getStatus(cfg, transId);
    if (!st) return reply(false, 502);
    if (!/^[0-9a-f-]{36}$/i.test(st.refId)) return reply(false, 400);
    const db = serviceClient();
    if (!db) return reply(false, 503);

    if (st.status === 'CANCELLED') {
        await db.from('lawyer_orders').update({ status: 'cancelled' }).eq('id', st.refId).eq('status', 'pending');
        return reply(true);
    }
    if (st.status !== 'PAID') return reply(true); // PENDING a další stavy: počká se na další oznámení
    const { data: order } = await db.from('lawyer_orders').select('user_id, price_czk, status, recurring_kind').eq('id', st.refId).maybeSingle();
    if (!order || !isPaidFor(cfg, st, st.refId, Number(order.price_czk))) { console.warn('[comgate] platba neodpovídá objednávce'); return reply(false, 400); }
    const { error } = await db.rpc('apply_lawyer_payment', { p_order: st.refId, p_ref: `comgate:${transId}` });
    if (error) { console.warn('[comgate] uplatnění selhalo:', error.message); return reply(false, 500); }
    // První platba s opakováním: uloží se její číslo, ze kterého se strhávají další období
    if (order.recurring_kind === 'init') await db.from('lawyer_recurring').update({ init_trans: transId, active: true, fails: 0, updated_at: new Date().toISOString() }).eq('user_id', order.user_id).eq('active', false);
    // Oznámení správci o nové platbě (jen poprvé; opakované oznámení od Comgate už e-mail nespustí). Platba od neověřeného se musí vrátit.
    if (order.status !== 'paid') {
        const { data: after } = await db.from('lawyer_orders').select('status').eq('id', st.refId).maybeSingle();
        const refund = after?.status === 'refund_due';
        await notifyAdmin(refund ? `Kancelář: platba ${Number(order.price_czk)} Kč k VRÁCENÍ` : `Kancelář: nová platba ${Number(order.price_czk)} Kč`, [
            refund ? `Zaplatil někdo, kdo nemá ověřenou totožnost. Peníze je třeba vrátit (objednávka č. ${st.refId}).` : `Někdo zaplatil objednávku Kanceláře č. ${st.refId}.`,
            `Částka: ${Number(order.price_czk)} Kč`,
        ]);
        if (!refund) await sendInvoiceForOrder(st.refId, 'predplatne');
    }
    return reply(true);
}
