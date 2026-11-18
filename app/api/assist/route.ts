import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { rateLimited } from '@/lib/serverSupabase';
import { ASSIST_SYSTEM, TOOLS, validateSuggestions } from '@/lib/tools';
import { mfaBlocked } from '@/lib/serverMfa';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const cache = new Map<string, { at: number; out: unknown }>();
const TTL = 10 * 60_000;
let client: OpenAI | null = null;

// Nápověda s AI: z toho, co advokát napsal, doporučí nástroje Kanceláře. Posílá se jen napsaný text (nikdy údaje z věcí a klientů)
// a odpověď se ověří proti pevnému katalogu nástrojů.
export async function POST(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: u, error } = await user.auth.getUser(token);
    if (error || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (mfaBlocked(u.user, token)) return NextResponse.json({ error: 'mfa' }, { status: 401 });
    if (await rateLimited(`assist:${u.user.id}`, 15, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const { data: allowed } = await user.rpc('has_lawyer_access');
    if (allowed !== true) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'disabled' }, { status: 503 });

    const body = await req.json().catch(() => null) as { q?: unknown } | null;
    const q = typeof body?.q === 'string' ? body.q.trim().slice(0, 200) : '';
    if (q.length < 3) return NextResponse.json({ suggestions: [] });
    const key = `${u.user.id}:${q.toLowerCase()}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.out);
    try {
        client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const catalog = TOOLS.map((t) => `${t.id}: ${t.name}. ${t.desc}`).join('\n');
        const res = await client.chat.completions.create({ model: 'gpt-4o-mini', temperature: 0, max_tokens: 400, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: ASSIST_SYSTEM }, { role: 'user', content: `Katalog:\n${catalog}\n\nUživatel napsal: ${JSON.stringify(q)}` }] }, { signal: AbortSignal.timeout(12_000) });
        let raw: unknown = null; try { raw = JSON.parse(res.choices[0]?.message?.content ?? ''); } catch { raw = null; }
        const out = { suggestions: validateSuggestions(raw).map((s) => ({ id: s.tool.id, name: s.tool.name, href: s.tool.href, desc: s.tool.desc, reason: s.reason })) };
        if (cache.size > 500) cache.clear();
        cache.set(key, { at: Date.now(), out });
        return NextResponse.json(out);
    } catch { return NextResponse.json({ error: 'upstream' }, { status: 502 }); }
}
