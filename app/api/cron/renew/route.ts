import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/serverSupabase';
import { chargeRecurring, comgateConfig } from '@/lib/comgate';
import { mailConfigured, sendMail } from '@/lib/mail';
import { planName, type PlanId } from '@/lib/plans';

const sameSecret = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
const MAX_FAILS = 3;
const day = (d: string) => new Date(`${d}T12:00:00Z`).getTime();

// Denní obnovení předplatného (Authorization: Bearer <CRON_SECRET>): v den skonce přístupu strhne další období z uložené karty,
// 3 dny předem pošle upozornění. Po třech neúspěších se obnovování samo vypne. Výsledek platby dojde jako běžné oznámení od Comgate.
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || !sameSecret(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const cfg = comgateConfig();
    const db = serviceClient();
    if (!cfg || !db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date());
    const { data: prices } = await db.rpc('lawyer_prices');
    const mail = (to: string, subject: string, text: string) => mailConfigured() && to ? sendMail(to, subject, text).catch(() => undefined) : Promise.resolve();
    let charged = 0, failed = 0, notified = 0;

    const { data: list } = await db.from('lawyer_recurring').select('user_id, plan, init_trans, fails, last_notice_for').eq('active', true).not('init_trans', 'is', null);
    for (const r of list ?? []) {
        const { data: la } = await db.from('lawyer_access').select('email, until').eq('user_id', r.user_id).maybeSingle();
        if (!la?.until) continue;
        const price = Number((prices as Record<string, number> | null)?.[r.plan] ?? 0);
        if (price <= 0) continue;
        const inDays = Math.round((day(la.until) - day(today)) / 86_400_000);

        if (inDays === 3 && r.last_notice_for !== la.until) {
            await mail(la.email, 'Kancelář: předplatné se za 3 dny obnoví', `Vaše předplatné Kanceláře (${planName(r.plan)}) skončí ${new Date(`${la.until}T12:00:00`).toLocaleDateString('cs-CZ')} a automaticky se obnoví. Bude strženo ${price} Kč z karty, kterou jste použili při první platbě.\n\nAutomatické obnovování můžete kdykoli zrušit v Nastavení → Předplatné.`);
            await db.from('lawyer_recurring').update({ last_notice_for: la.until }).eq('user_id', r.user_id);
            notified++;
        }
        if (inDays > 0) continue;

        // Neuzavřený pokus z posledních dvou dnů se nezdvojuje, počká se na oznámení od Comgate
        const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
        const { data: open } = await db.from('lawyer_orders').select('id').eq('user_id', r.user_id).eq('recurring_kind', 'renewal').eq('status', 'pending').gte('created_at', since).limit(1);
        if (open?.length) continue;

        const { data: order } = await db.from('lawyer_orders').insert({ user_id: r.user_id, plan: r.plan as PlanId, price_czk: price, recurring_kind: 'renewal' }).select('id').single();
        if (!order) continue;
        const res = await chargeRecurring(cfg, { initTransId: r.init_trans as string, orderId: order.id, priceCzk: price, label: 'Kancelar', email: la.email });
        if (res) { charged++; continue; }
        failed++;
        await db.from('lawyer_orders').update({ status: 'cancelled' }).eq('id', order.id);
        const fails = r.fails + 1;
        const stop = fails >= MAX_FAILS;
        await db.from('lawyer_recurring').update({ fails, active: !stop, updated_at: new Date().toISOString() }).eq('user_id', r.user_id);
        await mail(la.email, 'Kancelář: obnovení předplatného se nezdařilo', stop
            ? 'Předplatné se nepodařilo obnovit ani na třetí pokus, proto jsme automatické obnovování vypnuli. Předplatné můžete znovu zaplatit v Nastavení → Předplatné.'
            : `Předplatné se nepodařilo obnovit (strhnutí ${price} Kč z uložené karty selhalo). Zkusíme to znovu zítra. Zkontrolujte prosím platnost karty nebo zaplaťte ručně v Nastavení → Předplatné.`);
    }
    return NextResponse.json({ charged, failed, notified });
}
