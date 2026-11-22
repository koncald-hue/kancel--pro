import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { serviceClient } from '@/lib/serverSupabase';
import { mfaBlocked } from '@/lib/serverMfa';
import { mailConfigured, sendMail } from '@/lib/mail';
import { buildAccountDeleted } from '@/lib/accountMail';

// Smazání účtu advokáta týmem. Oprávnění a samotné smazání řeší databáze (funkce admin_delete_user, jen tým);
// po úspěšném smazání odejde advokátovi e-mail. Chyba e-mailu smazání nevrací zpět.
export async function POST(req: Request) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!token || !url || !anon) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const client = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
        const { data: u, error: authError } = await client.auth.getUser(token);
        if (authError || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        if (mfaBlocked(u.user, token)) return NextResponse.json({ error: 'mfa' }, { status: 401 });
        const { data: staff } = await client.rpc('is_staff');
        if (staff !== true) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

        const body = (await req.json().catch(() => ({}))) as { userId?: unknown; force?: unknown };
        const userId = typeof body.userId === 'string' ? body.userId : '';
        if (!/^[0-9a-f-]{36}$/i.test(userId)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
        const db = serviceClient();
        if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
        // E-mail je nutné zjistit před smazáním
        const email = (await db.auth.admin.getUserById(userId)).data.user?.email ?? '';

        const { error } = await client.rpc('admin_delete_user', { p_user_id: userId, p_force: body.force === true });
        if (error) return NextResponse.json({ error: 'rpc', message: error.message }, { status: 400 });

        let mailed = false;
        if (email && mailConfigured()) {
            try { const m = buildAccountDeleted(new URL(req.url).origin); await sendMail(email, m.subject, m.text); mailed = true; } catch (e) { console.warn('[delete-user mail]', (e as Error).message); }
        }
        return NextResponse.json({ ok: true, mailed });
    } catch (e) {
        console.error('API admin/delete-user error:', e);
        return NextResponse.json({ error: 'failed' }, { status: 500 });
    }
}
