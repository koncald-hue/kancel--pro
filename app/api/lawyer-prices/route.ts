import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/serverSupabase';

// Veřejné ceny předplatného advokátů (tři čísla z nastavení)
export async function GET() {
    const db = serviceClient();
    if (!db) return NextResponse.json({ month: 0, half: 0, year: 0 });
    const { data } = await db.from('app_settings').select('key, value').in('key', ['lawyer_price_month', 'lawyer_price_half', 'lawyer_price_year']);
    const map = Object.fromEntries((data ?? []).map((r) => [r.key as string, Number(r.value) || 0]));
    return NextResponse.json({ month: map.lawyer_price_month ?? 0, half: map.lawyer_price_half ?? 0, year: map.lawyer_price_year ?? 0 });
}
