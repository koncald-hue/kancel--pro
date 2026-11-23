import { NextResponse } from 'next/server';
import { clientIp, rateLimited, serviceClient } from '@/lib/serverSupabase';
import { corsHeaders, isArea, isRegion, toDirectoryLawyer, type DirectoryRow } from '@/lib/directory';

// Veřejný katalog advokátů pro studujpravo.cz: advokáti s vyplněným profilem a aktivním přístupem, kteří si zobrazení nevypnuli.
// Vrací jen údaje, které advokát chce ukázat veřejně (žádné interní ID, e-mail ani telefon).
export async function GET(req: Request) {
    const cors = corsHeaders(req.headers.get('origin'));
    if (await rateLimited(`dir:${clientIp(req)}`, 120, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429, headers: cors });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: cors });
    const sp = new URL(req.url).searchParams;
    const area = sp.get('area'); const region = sp.get('region');
    const today = new Date().toISOString().slice(0, 10);
    let q = db.from('lawyer_access')
        .select('directory_id, display_name, register_name, bar_number, office, profession, directory_areas, directory_regions, directory_consult, directory_bio, avatar_small, website')
        .eq('directory_listed', true).eq('verification_status', 'verified').eq('profession', 'advokat').in('status', ['active', 'trial'])
        .or(`until.is.null,until.gte.${today}`).limit(300);
    // Kdo si obory nebo kraje nevybral, ukazuje se u všech oborů a v celé ČR
    if (isArea(area)) q = q.or(`directory_areas.cs.{${area}},directory_areas.eq.{}`);
    if (isRegion(region)) q = q.or(`directory_regions.cs.{"${region}"},directory_regions.eq.{}`);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: cors });
    const lawyers = ((data ?? []) as DirectoryRow[]).map(toDirectoryLawyer).filter((l) => l.name);
    return NextResponse.json({ lawyers }, { headers: { ...cors, 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}

export function OPTIONS(req: Request) { return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) }); }
