import { NextResponse } from 'next/server';
import { clientIp, findActiveLink, rateLimited, serviceClient } from '@/lib/serverSupabase';
import { secondFactorBlock, type FactorLink } from '@/lib/portalSession';
import { maskEmail } from '@/lib/mail';
import { accentOf, greetingOf } from '@/lib/portalBrand';

const NOT_FOUND = () => NextResponse.json({ error: 'notfound' }, { status: 404 });

// Obsah klientské stránky: nejdřív jen vizitka advokáta a výzva k vyplnění údajů, po identifikaci
// klienta i to, co advokát výslovně zpřístupnil
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
    const { token } = await ctx.params;
    if (await rateLimited(`pg:${clientIp(req)}`, 60, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const link = await findActiveLink(db, token);
    if (!link) return NOT_FOUND();

    if (!link.verified) return NextResponse.json({ unverified: true });
    // Klientská stránka funguje po dobu předplatného advokáta
    if (!link.subscribed) return NextResponse.json({ inactive: true });

    const cols = 'firm_name, display_name, phone, office, website, bar_number, contact_email';
    const first = await db.from('lawyer_access').select(`${cols}, avatar_large`)  .eq('user_id', link.user_id).maybeSingle();
    let lawyerRow = first.data;
    // Bez spuštěného profil-foto.sql sloupec s fotkou není; stránka musí fungovat i tak
    if (first.error) ({ data: lawyerRow } = await db.from('lawyer_access').select(cols).eq('user_id', link.user_id).maybeSingle());
    const lawyer = {
        firm: (lawyerRow?.firm_name as string | undefined) ?? '',
        name: (lawyerRow?.display_name as string | undefined) ?? '',
        phone: (lawyerRow?.phone as string | undefined) ?? '',
        office: (lawyerRow?.office as string | undefined) ?? '',
        website: (lawyerRow?.website as string | undefined) ?? '',
        barNumber: (lawyerRow?.bar_number as string | undefined) ?? '',
        verified: true,
        profession: link.profession,
        verifiedAt: link.verified_at,
        email: (lawyerRow?.contact_email as string | undefined) ?? '',
        photo: ((lawyerRow as { avatar_large?: string } | null)?.avatar_large) ?? '',
    };
    // Vzhled stránky (migrace 20261118_07): když sloupce nejsou, použije se výchozí
    const brand = await db.from('lawyer_access').select('portal_accent, portal_greeting').eq('user_id', link.user_id).maybeSingle();
    const b = (brand.error ? null : brand.data) as { portal_accent?: string; portal_greeting?: string } | null;
    (lawyer as Record<string, unknown>).accent = accentOf(b?.portal_accent);
    (lawyer as Record<string, unknown>).greeting = greetingOf(b?.portal_greeting);
    // Dokud klient nevyplní údaje, nečteme ani nevracíme údaje ze spisu.
    const linkAny = link as unknown as { onboarded_at?: string | null; client_name?: string; client_email?: string; client_phone?: string; client_verified_at?: string | null };
    // Druhý faktor: bez ověřeného kódu jen vizitka advokáta a výzva k zadání kódu, nic ze spisu
    if (await secondFactorBlock(db, link as FactorLink, req)) {
        return NextResponse.json({ needsCode: true, email: maskEmail((link as FactorLink).code_email ?? ''), e2ee: Boolean(link.e2ee), lawyer, title: link.label || 'Váš spis' });
    }
    if (!linkAny.onboarded_at) {
        return NextResponse.json({ onboarded: false, e2ee: Boolean(link.e2ee), lawyer, title: link.label || 'Váš spis', prefillName: linkAny.client_name || '' });
    }
    const { data: caseRow } = await db.from('cases').select('title, client_name').eq('id', link.case_id).maybeSingle();
    const title = link.label || (caseRow?.title as string | undefined) || 'Váš spis';

    const [requests, files, entries, deadlines, messages] = await Promise.all([
        db.from('client_requests').select('id, title, done').eq('case_id', link.case_id).order('created_at'),
        db.from('case_files').select('id, name, size, created_at, source, request_id, client_visible, enc').eq('case_id', link.case_id).or('client_visible.eq.true,source.eq.client').order('created_at', { ascending: false }),
        db.from('case_entries').select('id, title, body, happened_on, created_at').eq('case_id', link.case_id).eq('client_visible', true).order('happened_on', { ascending: false }),
        db.from('case_deadlines').select('id, title, due_date, done').eq('case_id', link.case_id).eq('client_visible', true).order('due_date'),
        db.from('client_messages').select('id, from_client, body, created_at').eq('case_id', link.case_id).order('created_at'),
    ]);

    await db.from('client_links').update({ opens: link.opens + 1, last_opened_at: new Date().toISOString() }).eq('id', link.id);
    // Zprávy od advokáta se po otevření klientem považují za přečtené
    await db.from('client_messages').update({ read: true }).eq('case_id', link.case_id).eq('from_client', false).eq('read', false);

    return NextResponse.json({
        onboarded: true,
        e2ee: Boolean(link.e2ee),
        lawyer,
        client: { name: linkAny.client_name ?? '', email: linkAny.client_email ?? '', phone: linkAny.client_phone ?? '', verified: Boolean(linkAny.client_verified_at) },
        title,
        status: link.status_text,
        requests: requests.data ?? [],
        files: files.data ?? [],
        entries: entries.data ?? [],
        deadlines: deadlines.data ?? [],
        messages: messages.data ?? [],
    });
}
