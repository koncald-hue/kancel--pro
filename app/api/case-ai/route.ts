import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { rateLimited } from '@/lib/serverSupabase';
import { mfaBlocked } from '@/lib/serverMfa';
import { AI_MAX_CHARS, redact } from '@/lib/redact';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
let client: OpenAI | null = null;

const SYSTEM = {
    summary: 'Jsi asistent českého advokáta. Stručně a věcně shrň poskytnutý text v češtině: o co jde, kdo co požaduje, jaké jsou uvedené lhůty a data, co zbývá udělat. Nic nedomýšlej. Pokud něco v textu chybí nebo je nejasné, napiš to. Údaje v hranatých závorkách (např. [E-MAIL]) jsou zakryté identifikátory, nedoplňuj je.',
    reply: 'Jsi asistent českého advokáta. Na základě poskytnutého textu navrhni stručný, zdvořilý koncept odpovědi v češtině jako PODKLAD pro advokáta. Nevymýšlej fakta, čísla paragrafů ani judikaturu, které v textu nejsou. Kde potřebuješ údaj, který neznáš, napiš [DOPLNIT]. Údaje v hranatých závorkách jsou zakryté identifikátory, ponech je.',
    route: 'Jsi asistent českého advokáta. Dostaneš e-mail a očíslovaný seznam otevřených věcí. Rozhodni, ke které věci e-mail patří. Odpověz POUZE JSON ve tvaru {"vec": číslo věci, "duvod": "jedna krátká věta česky"}. Když si nejsi jistý nebo žádná věc nesedí, dej "vec": 0. Nic si nevymýšlej.',
    brief: 'Jsi asistent českého advokáta. Z podkladů věci připrav v češtině stručný přehled před jednáním: 1) o co ve věci jde, 2) dosavadní průběh v bodech s daty, 3) otevřené lhůty a úkoly, 4) co zjevně chybí nebo je nejasné. Vycházej VÝHRADNĚ z podkladů, nic nedomýšlej, nepřidávej paragrafy ani judikaturu, které v podkladech nejsou.',
    client: 'Jsi asistent českého advokáta. Z podkladů věci napiš klientovi srozumitelné shrnutí v češtině, bez právnického žargonu: co se ve věci stalo, v jaké je fázi a co bude dál. Maximálně 12 vět, vykej. Nic nedomýšlej, neslibuj výsledek. Kde podklady neříkají, co bude dál, napiš, že to advokát upřesní.',
    draft: 'Jsi asistent českého advokáta. Podle ÚKOLU, pokynů advokáta a podkladů věci připrav v češtině KONCEPT dokumentu jako podklad pro advokáta, ne hotový text. Použij obvyklou strukturu daného druhu dokumentu (označení soudu nebo adresáta, účastníci, věc, odůvodnění, návrh nebo požadavek, datum a podpis). Údaje, které v podkladech nejsou (adresy, rodná čísla, částky, data), NEVYMÝŠLEJ a označ je jako [DOPLNIT: co]. Nevymýšlej paragrafy ani judikaturu; kde by byl vhodný odkaz na předpis, napiš [OVĚŘIT: ustanovení].',
    ask: 'Jsi asistent českého advokáta. Odpověz česky a stručně na OTÁZKU pouze podle poskytnutých podkladů věci a dokumentů. U každého tvrzení uveď, z kterého dokumentu nebo záznamu vychází (např. „podle dokumentu smlouva.pdf“). Pokud odpověď v podkladech není, řekni to přímo a nic nedomýšlej.',
} as const;

// Asistent nad textem, který advokát výslovně vybral. Posílá se jen tento text, po zakrytí identifikátorů provedeném i tady na serveru.
// Funguje jen s udělenými souhlasem (lawyer_access.ai_consent_at) a text se na serveru neukládá ani nelogují.
export async function POST(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: u, error } = await user.auth.getUser(token);
    if (error || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (mfaBlocked(u.user, token)) return NextResponse.json({ error: 'mfa' }, { status: 401 });
    if (await rateLimited(`caseai:${u.user.id}`, 12, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const { data: allowed } = await user.rpc('has_lawyer_access');
    if (allowed !== true) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const consent = await user.from('lawyer_access').select('ai_consent_at').eq('user_id', u.user.id).maybeSingle();
    if (consent.error || !consent.data?.ai_consent_at) return NextResponse.json({ error: 'consent' }, { status: 403 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'disabled' }, { status: 503 });

    const body = await req.json().catch(() => null) as { mode?: unknown; text?: unknown; confirmed?: unknown } | null;
    // Každé odeslání potvrzuje advokát výslovně (klient tohle pole nastaví jen po zaškrtnutí)
    if (body?.confirmed !== true) return NextResponse.json({ error: 'not_confirmed' }, { status: 400 });
    const MODES = ['summary', 'reply', 'route', 'brief', 'client', 'draft', 'ask'] as const;
    const mode = MODES.find((m) => m === body.mode) ?? null;
    const raw = typeof body.text === 'string' ? body.text : '';
    if (!mode || raw.trim().length < 20) return NextResponse.json({ error: 'invalid', message: 'Zadejte aspoň krátký text.' }, { status: 400 });
    if (raw.length > AI_MAX_CHARS) return NextResponse.json({ error: 'too_long', message: `Text je delší než ${AI_MAX_CHARS} znaků.` }, { status: 400 });
    const { text, count } = redact(raw);
    try {
        client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const res = await client.chat.completions.create({ model: 'gpt-4o-mini', temperature: mode === 'route' ? 0 : 0.2, max_tokens: mode === 'route' ? 150 : mode === 'draft' ? 1800 : 900, messages: [{ role: 'system', content: SYSTEM[mode] }, { role: 'user', content: text }] }, { signal: AbortSignal.timeout(40_000) });
        return NextResponse.json({ answer: (res.choices[0]?.message?.content ?? '').trim(), redacted: count }, { headers: { 'Cache-Control': 'no-store' } });
    } catch { return NextResponse.json({ error: 'upstream' }, { status: 502 }); }
}
