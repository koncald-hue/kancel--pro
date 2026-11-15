import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/serverSupabase';
import { FIRM_SIZES } from '@/lib/firm';
import { PLANS } from '@/lib/plans';

const keyOf = (seats: number, plan: string) => `firm_price_${seats}_${plan}`;

// Veřejné ceny předplatného: jednotlivec (3 čísla) a balíčky pro kanceláře (3 velikosti × 3 tarify)
export async function GET() {
    const db = serviceClient();
    const empty = { month: 0, half: 0, year: 0, firm: Object.fromEntries(FIRM_SIZES.map((s) => [s, { month: 0, half: 0, year: 0 }])) };
    if (!db) return NextResponse.json(empty);
    const keys = ['lawyer_price_month', 'lawyer_price_half', 'lawyer_price_year', ...FIRM_SIZES.flatMap((s) => PLANS.map((p) => keyOf(s, p.id)))];
    const { data } = await db.from('app_settings').select('key, value').in('key', keys);
    const map = Object.fromEntries((data ?? []).map((r) => [r.key as string, Number(r.value) || 0]));
    return NextResponse.json({
        month: map.lawyer_price_month ?? 0, half: map.lawyer_price_half ?? 0, year: map.lawyer_price_year ?? 0,
        firm: Object.fromEntries(FIRM_SIZES.map((s) => [s, Object.fromEntries(PLANS.map((p) => [p.id, map[keyOf(s, p.id)] ?? 0]))])),
    });
}
