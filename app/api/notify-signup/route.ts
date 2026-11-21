import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { serviceClient } from '@/lib/serverSupabase';
import { notifyAdmin } from '@/lib/adminMail';
import { isFreshSignup } from '@/lib/signupNotice';
import { getSiteOrigin } from '@/lib/siteUrl';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const done = () => new NextResponse(null, { status: 204 });

// Po přihlášení právě potvrzeného účtu pošle správci e-mail „Nová registrace“. U každého účtu jen jednou.
export async function POST(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return done();
    const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.getUser(token);
    const user = data.user;
    if (error || !user || !isFreshSignup(user)) return done();
    const db = serviceClient();
    if (!db) return done();
    // Značka se zapíše dřív než e-mail, aby se při opakovaném volání neposlal dvakrát
    const { error: markError } = await db.auth.admin.updateUserById(user.id, { app_metadata: { ...(user.app_metadata ?? {}), signup_notified: true } });
    if (markError) return done();
    await notifyAdmin('Kancelář Pro: nová registrace', [`Zaregistroval se nový uživatel: ${user.email ?? 'bez e-mailu'}`, '', `Přehled: ${(getSiteOrigin() ?? '').replace(/\/$/, '')}/admin`]);
    return done();
}
