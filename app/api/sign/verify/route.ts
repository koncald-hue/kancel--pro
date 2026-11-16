import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sealSecret } from '@/lib/signServer';
import { verifySeal, type Evidence } from '@/lib/signing';

// Advokát si ověří, že doklad o podpisu nebyl po podpisu změněn (pečeť se přepočítá serverovým klíčem)
export async function POST(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!token || !url || !anon) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const client = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json().catch(() => null) as { id?: unknown } | null;
    if (typeof body?.id !== 'string') return NextResponse.json({ error: 'invalid' }, { status: 400 });
    // Řádek vrátí jen vlastníkovi (pravidla přístupu v databázi)
    const { data } = await client.from('signature_requests').select('evidence, evidence_seal, doc_sha256, status').eq('id', body.id).maybeSingle();
    if (!data?.evidence || !data.evidence_seal) return NextResponse.json({ error: 'notfound' }, { status: 404 });
    const ev = data.evidence as Evidence;
    const intact = await verifySeal(sealSecret(), ev, data.evidence_seal as string) && ev.docSha256 === data.doc_sha256;
    return NextResponse.json({ intact });
}
