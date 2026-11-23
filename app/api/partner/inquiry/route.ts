import { NextResponse } from 'next/server';
import { clientIp, rateLimited, serviceClient } from '@/lib/serverSupabase';
import { AREA_LABELS, PARTNER_REPLY_DAYS, corsHeaders, partnerOrigins, validatePartnerInquiry } from '@/lib/directory';
import { mailConfigured, sendMail } from '@/lib/mail';
import { getSiteOrigin } from '@/lib/siteUrl';

// Poptávka z katalogu na studujpravo.cz. Odesílá ji přímo prohlížeč člověka (se souhlasem k předání konkrétnímu advokátovi),
// Studuj právo údaje nikam nepřeposílá. Advokát ji uvidí v Poptávkách se štítkem „Studuj právo“ a dostane e-mail.
export async function POST(req: Request) {
    const origin = req.headers.get('origin');
    const cors = corsHeaders(origin);
    if (origin && !partnerOrigins().includes(origin) && origin !== getSiteOrigin()) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: cors });
    const ip = clientIp(req);
    if (await rateLimited(`pin:${ip}`, 4, 60 * 60_000) || await rateLimited(`pid:${ip}`, 10, 24 * 60 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429, headers: cors });
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'invalid' }, { status: 400, headers: cors });
    if (typeof body.website === 'string' && body.website.trim()) return NextResponse.json({ ok: true }, { headers: cors });
    const v = validatePartnerInquiry(body);
    if (!v.ok) return NextResponse.json({ error: 'validation', field: v.field }, { status: 400, headers: cors });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: cors });

    const { data: lawyer } = await db.from('lawyer_access').select('user_id, status, until, verification_status, directory_listed, display_name, contact_email, email').eq('directory_id', v.value.directoryId).maybeSingle();
    const today = new Date().toISOString().slice(0, 10);
    const active = lawyer && lawyer.directory_listed && lawyer.verification_status === 'verified' && (lawyer.status === 'active' || lawyer.status === 'trial') && (!lawyer.until || String(lawyer.until) >= today);
    if (!active) return NextResponse.json({ error: 'notfound' }, { status: 404, headers: cors });

    // Stejný člověk stejnému advokátovi jednou za den stačí (dvojklik, opakované odeslání)
    if (v.value.ref) {
        const { data: dup } = await db.from('lawyer_inquiries').select('id').eq('user_id', lawyer.user_id).eq('source_ref', v.value.ref).limit(1);
        if (dup?.length) return NextResponse.json({ ok: true, duplicate: true }, { headers: cors });
    }
    const { error } = await db.from('lawyer_inquiries').insert({
        user_id: lawyer.user_id, name: v.value.name, email: v.value.email, phone: v.value.phone, message: v.value.message,
        source: 'studujpravo', source_ref: v.value.ref, area: v.value.area, region: v.value.region, district: v.value.district || null,
    });
    if (error) return NextResponse.json({ error: 'failed' }, { status: 500, headers: cors });

    const to = String(lawyer.contact_email || lawyer.email || '');
    if (to && mailConfigured()) {
        const site = getSiteOrigin() ?? '';
        const where = [v.value.district, v.value.region].filter(Boolean).join(', ');
        await sendMail(to, 'Nová poptávka ze Studuj právo', [
            'Dobrý den,', '', 'přes katalog advokátů na studujpravo.cz vám poslal poptávku nový zájemce.', '',
            `Obor: ${v.value.area ? AREA_LABELS[v.value.area] : 'neuveden'}`, `Místo: ${where || 'neuvedeno'}`, '',
            `Přijměte ji, nebo odmítněte do ${PARTNER_REPLY_DAYS} dnů. Zájemce dostane e-mail podle vašeho rozhodnutí; když neodpovíte, nabídneme mu jiného advokáta.`, '',
            `Otevřít Poptávky: ${site}/kancelar/poptavky`, '', 'Kancelář Pro',
        ].join('\n')).catch((e) => console.warn('[partner-inquiry] mail', (e as Error).message));
    }
    return NextResponse.json({ ok: true, lawyer: String(lawyer.display_name ?? '') }, { headers: { ...cors, 'Cache-Control': 'no-store' } });
}

export function OPTIONS(req: Request) { return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) }); }
