import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { rateLimited } from '@/lib/serverSupabase';
import { CALLBACK_PATH, McpError, exchangeCode, mcpConnect, refreshTokens, registerClient } from '@/lib/mcpClient';
import { EVAL_SYSTEM, MAX_DOCS, PLAN_SYSTEM, anonymize, docSources, judikaturaSources, slimDocSource, lawSearchSources, provisionSource, sourcesForPrompt, validateEvaluation, type SpisDoc, type Source } from '@/lib/legalResearch';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
let openai: OpenAI | null = null;
const getOpenAI = () => (openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const NO_STORE = { 'Cache-Control': 'no-store' };

async function json<T>(system: string, user: unknown): Promise<T | null> {
    const res = await getOpenAI().chat.completions.create({ model: 'gpt-4o', temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: typeof user === 'string' ? user : JSON.stringify(user) }] });
    try { return JSON.parse(res.choices[0]?.message?.content ?? '') as T; } catch { return null; }
}

// Právní rešerše přes DirectCase. Přihlášení k DirectCase patří advokátovi (jeho vlastní účet); jeho přístupový token přichází s požadavkem
// a na serveru se neukládá. Údaje o věci se před odesláním anonymizují.
export async function POST(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: u, error: ue } = await user.auth.getUser(token);
    if (ue || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (rateLimited(`legal:${u.user.id}`, 20, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const { data: allowed } = await user.rpc('has_lawyer_access');
    if (allowed !== true) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    const action = body.action;
    const fail = (e: unknown) => {
        const status = e instanceof McpError ? e.status : 0;
        if (status === 401 || status === 403) return NextResponse.json({ error: 'legal_auth', message: e instanceof Error ? e.message : 'Přihlášení vypršelo.' }, { status: 401, headers: NO_STORE });
        console.warn('[legal]', e instanceof Error ? e.message : e);
        return NextResponse.json({ error: 'upstream', message: e instanceof Error ? e.message : 'Právní vyhledávač teď neodpovídá.' }, { status: 502, headers: NO_STORE });
    };

    try {
        if (action === 'register') {
            const origin = new URL(req.url).origin;
            const redirectUri = clean(body.redirectUri, 300);
            if (redirectUri !== `${origin}${CALLBACK_PATH}`) return NextResponse.json({ error: 'bad_request', message: 'Neplatná adresa pro přesměrování.' }, { status: 400 });
            return NextResponse.json({ clientId: await registerClient(redirectUri) }, { headers: NO_STORE });
        }
        if (action === 'exchange') {
            const origin = new URL(req.url).origin;
            const redirectUri = clean(body.redirectUri, 300);
            if (redirectUri !== `${origin}${CALLBACK_PATH}`) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
            const t = await exchangeCode({ clientId: clean(body.clientId, 200), code: clean(body.code, 2000), verifier: clean(body.verifier, 200), redirectUri });
            return NextResponse.json({ tokens: t }, { headers: NO_STORE });
        }
        if (action === 'refresh') {
            return NextResponse.json({ tokens: await refreshTokens({ clientId: clean(body.clientId, 200), refreshToken: clean(body.refreshToken, 4000) }) }, { headers: NO_STORE });
        }
        if (action === 'research') {
            const accessToken = clean(body.accessToken, 8000);
            const question = anonymize(clean(body.question, 1500)).text;
            const facts = anonymize(clean(body.facts, 6000)).text;
            // Podklady ze spisu: dokumenty se znovu projdou anonymizací (pojistka k té v prohlížeči) a omezí se rozsah
            let budget = 24000;
            const docs: SpisDoc[] = (Array.isArray(body.documents) ? body.documents : []).slice(0, MAX_DOCS).flatMap((d, i) => {
                const o = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
                const text = anonymize(clean(o.text, 8000)).text.slice(0, budget);
                if (text.length < 20) return [];
                budget -= text.length;
                return [{ label: anonymize(clean(o.label, 100)).text || `Dokument ${i + 1}`, text }];
            });
            if (!accessToken || question.length < 10) return NextResponse.json({ error: 'bad_request', message: 'Zadejte právní otázku (aspoň několik slov).' }, { status: 400 });
            if (body.consent !== true) return NextResponse.json({ error: 'consent', message: 'Odeslání údajů je třeba potvrdit.' }, { status: 409 });
            if (rateLimited(`legalr:${u.user.id}`, 30, 86_400_000)) return NextResponse.json({ error: 'rate', message: 'Dnešní limit rešerší je vyčerpán.' }, { status: 429 });

            const ai = !!process.env.OPENAI_API_KEY;
            // 1) plán dotazů (bez AI se použije otázka sama)
            const plan = ai ? await json<{ queries?: string[]; provisions?: string[] }>(PLAN_SYSTEM, { otázka: question, skutkový_popis: facts, podklady_ze_spisu: docs.map((d) => ({ název: d.label, začátek: d.text.slice(0, 800) })) }) : null;
            const queries = (plan?.queries ?? []).map((q) => clean(q, 200)).filter(Boolean).slice(0, 4);
            if (queries.length === 0) queries.push(question.slice(0, 200));
            const provisions = (plan?.provisions ?? []).map((q) => clean(q, 120)).filter(Boolean).slice(0, 4);

            // 2) vyhledání v právní databázi
            const mcp = await mcpConnect(accessToken);
            const [caselaw, lawHits, ...exact] = await Promise.all([
                mcp.call('search_caselaw_parallel', { queries, collections: [] }),
                mcp.call('search_law_text', { query: question.slice(0, 300), limit: 5 }).catch(() => null),
                ...provisions.map((c) => mcp.call('get_law_provision', { citation: c }).catch(() => null)),
            ]);
            const sources: Source[] = judikaturaSources(caselaw).slice(0, 8);
            for (const p of exact) { const s = provisionSource(p, `S${sources.length + 1}`); if (s) sources.push(s); }
            for (const s of lawSearchSources(lawHits, sources.length + 1, 4)) if (!sources.some((x) => x.title === s.title)) sources.push({ ...s, id: `S${sources.length + 1}` });
            const summaries = Object.values((caselaw as { collection_summaries?: Record<string, string> } | null)?.collection_summaries ?? {}).filter((x): x is string => typeof x === 'string').slice(0, 3);

            // 3) hodnocení podle nalezených zdrojů (výstup se ověřuje)
            const all: Source[] = [...sources, ...docSources(docs)];
            const evaluation = ai && all.length
                ? validateEvaluation(await json(EVAL_SYSTEM, { otázka: question, skutkový_popis: facts, zdroje: sourcesForPrompt(all) }), all)
                : null;
            // Dokumenty ze spisu se vracejí jen jako krátké úryvky
            return NextResponse.json({ question, queries, provisions, sources: all.map((s) => (s.kind === 'spis' ? slimDocSource(s) : s)), summaries, evaluation, ai }, { headers: NO_STORE });
        }
    } catch (e) { return fail(e); }
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
}
