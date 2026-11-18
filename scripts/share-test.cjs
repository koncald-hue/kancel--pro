// Test sdílení věcí mezi dvěma advokáty jedné kanceláře proti SKUTEČNÉ databázi (pravidla RLS, triggery, funkce).
// Spuštění z terminálu (přihlašovací údaje si nastavujete vy, skript je nikam nezapisuje):
//   OWNER_LOGIN=<e-mail vlastníka> COLLEAGUE_LOGIN=<e-mail kolegy> TEST_PASSWORD=<heslo> \
//   OWNER_CASE=<id věci vlastníka> OUTSIDE_CASE=<id věci uživatele mimo kancelář> OUTSIDE_USER=<id uživatele mimo kancelář> \
//   node scripts/share-test.cjs
// Potřebuje v .env.local NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (jen pro úklid).
// Vytváří jen záznamy s názvem „SDILENI-TEST…“ a na konci je smaže, včetně sdílení.
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const env = {};
for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const need = ['OWNER_LOGIN', 'COLLEAGUE_LOGIN', 'TEST_PASSWORD', 'OWNER_CASE', 'OUTSIDE_CASE', 'OUTSIDE_USER'];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) { console.error('Chybí proměnné: ' + missing.join(', ')); process.exit(2); }

const mk = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CASE = process.env.OWNER_CASE, OUT = process.env.OUTSIDE_CASE, OUTSIDER = process.env.OUTSIDE_USER;
let ok = 0, bad = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  -> ' + extra : '')); cond ? ok++ : bad++; };
const none = (r) => (r.data ?? []).length === 0;

(async () => {
    const A = mk(), B = mk(); // A = vlastník věci, B = kolega ze stejné kanceláře
    const a = await A.auth.signInWithPassword({ email: process.env.OWNER_LOGIN, password: process.env.TEST_PASSWORD });
    const b = await B.auth.signInWithPassword({ email: process.env.COLLEAGUE_LOGIN, password: process.env.TEST_PASSWORD });
    if (a.error || b.error) { console.error('Přihlášení selhalo (zkontrolujte údaje).'); process.exit(1); }
    const ua = a.data.user.id, ub = b.data.user.id;
    const cleanup = async () => {
        await db.from('case_members').delete().eq('case_id', CASE);
        await db.from('case_deadlines').delete().like('title', 'SDILENI-TEST%');
        await db.from('client_links').delete().like('label', 'SDILENI-TEST%');
        await db.from('client_requests').delete().like('title', 'SDILENI-TEST%');
        await db.from('client_messages').delete().like('body', 'SDILENI-TEST%');
        await db.from('signature_requests').delete().like('title', 'SDILENI-TEST%');
    };
    await cleanup();
    const original = (await db.from('cases').select('title').eq('id', CASE).single()).data.title;
    let r;

    r = await B.from('cases').select('id').eq('id', CASE); check('před sdílením kolega věc nevidí', none(r));
    r = await B.from('case_deadlines').select('id').eq('case_id', CASE); check('před sdílením kolega nevidí lhůty věci', none(r));
    r = await A.from('cases').select('id').eq('id', OUT); check('vlastník nevidí věc uživatele mimo kancelář', none(r));
    r = await B.from('cases').select('id').eq('id', OUT); check('kolega nevidí věc uživatele mimo kancelář', none(r));
    r = await B.from('case_members').insert({ case_id: CASE, user_id: ub, role: 'editor', added_by: ub }); check('kolega se nemůže sám přidat do cizí věci', !!r.error, r.error?.message?.slice(0, 60));

    r = await A.from('case_members').insert({ case_id: CASE, user_id: ub, role: 'viewer', added_by: ua }); check('vlastník nasdílí věc jako čtenáři', !r.error, r.error?.message);
    r = await B.from('cases').select('id').eq('id', CASE); check('čtenář věc vidí', (r.data ?? []).length === 1);
    r = await B.from('cases').update({ title: 'HACK' }).eq('id', CASE).select('id'); check('čtenář věc NEUPRAVÍ', none(r));
    r = await B.from('case_deadlines').insert({ case_id: CASE, user_id: ub, title: 'SDILENI-TEST čtenář', due_date: '2026-12-01' }); check('čtenář NEPŘIDÁ lhůtu', !!r.error);

    r = await A.from('case_members').update({ role: 'editor' }).eq('case_id', CASE).eq('user_id', ub); check('vlastník změní roli na editora', !r.error, r.error?.message);
    r = await B.from('case_deadlines').insert({ case_id: CASE, user_id: ub, title: 'SDILENI-TEST editor', due_date: '2026-12-02' }).select('id').single(); check('editor přidá lhůtu', !r.error, r.error?.message);
    const myDl = r.data?.id;
    r = await A.from('case_deadlines').insert({ case_id: CASE, user_id: ua, title: 'SDILENI-TEST vlastník', due_date: '2026-12-03' }).select('id').single();
    const ownDl = r.data?.id;
    r = await B.from('case_deadlines').select('id').eq('case_id', CASE).like('title', 'SDILENI-TEST%'); check('editor vidí lhůty vlastníka i své', (r.data ?? []).length === 2);
    r = await B.from('cases').update({ title: original + ' (upraveno kolegou)' }).eq('id', CASE).select('id'); check('editor smí upravit věc', (r.data ?? []).length === 1);
    await A.from('cases').update({ title: original }).eq('id', CASE);
    r = await B.from('cases').update({ user_id: ub }).eq('id', CASE).select('id'); check('editor NEPŘEVEDE vlastnictví věci', !!r.error || none(r), r.error?.message?.slice(0, 60));
    r = await B.from('case_deadlines').update({ case_id: OUT }).eq('id', ownDl).select('id'); check('editor nepřesune lhůtu do cizí věci', !!r.error || none(r));
    r = await B.from('case_deadlines').update({ user_id: ub }).eq('id', ownDl).select('id'); check('editor nepřepíše autora cizí lhůty', !!r.error || none(r));
    r = await B.from('case_deadlines').delete().eq('id', ownDl).select('id'); check('editor NESMAŽE lhůtu vlastníka', none(r));
    r = await B.from('case_deadlines').delete().eq('id', myDl).select('id'); check('editor smaže svou lhůtu', (r.data ?? []).length === 1);

    for (const [t, label] of [['client_links', 'klientské odkazy'], ['signature_requests', 'žádosti o podpis'], ['client_messages', 'zprávy klienta'], ['client_requests', 'požadavky na klienta']]) {
        r = await B.from(t).select('*').eq('case_id', CASE); check(`editor nevidí ${label}`, none(r), r.error?.message?.slice(0, 40));
    }
    r = await B.from('client_links').insert({ case_id: CASE, user_id: ub, token: 'x'.repeat(43), label: 'SDILENI-TEST' }); check('editor NEZALOŽÍ klientský odkaz ke sdílené věci', !!r.error, r.error?.message?.slice(0, 50));
    r = await B.from('client_requests').insert({ case_id: CASE, user_id: ub, title: 'SDILENI-TEST požadavek' }); check('editor NEPODSTRČÍ klientovi požadavek', !!r.error, r.error?.message?.slice(0, 50));
    r = await B.from('client_messages').insert({ case_id: CASE, user_id: ub, from_client: false, body: 'SDILENI-TEST zpráva' }); check('editor NEPOŠLE klientovi zprávu jménem advokáta', !!r.error, r.error?.message?.slice(0, 50));
    r = await B.from('signature_requests').insert({ case_id: CASE, user_id: ub, title: 'SDILENI-TEST podpis', doc_sha256: '0'.repeat(64) }); check('editor NEPODSTRČÍ klientovi žádost o podpis', !!r.error, r.error?.message?.slice(0, 50));
    r = await B.from('case_deadlines').update({ client_visible: true }).eq('id', ownDl).select('id'); check('editor NEVYSTAVÍ lhůtu klientovi', !!r.error || none(r), r.error?.message?.slice(0, 50));
    r = await B.from('time_entries').select('id').eq('user_id', ua); check('kolega nevidí výkazy vlastníka', none(r));
    r = await B.from('invoices').select('id').eq('user_id', ua); check('kolega nevidí faktury vlastníka', none(r));
    r = await B.from('lawyer_clients').select('id').eq('user_id', ua); check('kolega nevidí klienty vlastníka', none(r));
    r = await B.from('lawyer_access').select('user_id').eq('user_id', ua); check('kolega nečte předplatné vlastníka', none(r));
    r = await B.rpc('case_people', { p_case: CASE }); check('case_people: kolega vidí vlastníka i sebe', (r.data ?? []).length === 2);
    r = await A.from('case_deadlines').insert({ case_id: CASE, user_id: ua, title: 'SDILENI-TEST přiřazeno', due_date: '2026-12-04', assignee_id: ub, kind: 'ukol' }); check('vlastník přiřadí úkol kolegovi', !r.error, r.error?.message);
    r = await B.rpc('has_lawyer_access', { p_user: ua }); check('kolega se přes funkci nedozví předplatné vlastníka', r.data === false);
    r = await A.from('case_members').insert({ case_id: CASE, user_id: OUTSIDER, role: 'viewer', added_by: ua }); check('nelze sdílet s uživatelem mimo kancelář', !!r.error, r.error?.message?.slice(0, 50));

    r = await A.from('client_requests').insert({ case_id: CASE, user_id: ua, title: 'SDILENI-TEST vlastník' }); check('vlastník KLIENTSKÝ POŽADAVEK dál založí (regrese)', !r.error, r.error?.message?.slice(0, 50));
    r = await A.from('client_links').insert({ case_id: CASE, user_id: ua, token: 'y'.repeat(43), label: 'SDILENI-TEST vlastník' }); check('vlastník klientský odkaz dál založí (regrese)', !r.error, r.error?.message?.slice(0, 50));
    r = await A.from('case_deadlines').update({ client_visible: true }).eq('id', ownDl).select('id'); check('vlastník smí lhůtu zpřístupnit klientovi (regrese)', (r.data ?? []).length === 1, r.error?.message?.slice(0, 50));
    r = await A.from('case_members').delete().eq('case_id', CASE).eq('user_id', ub); check('vlastník odebere kolegu', !r.error);
    r = await B.from('cases').select('id').eq('id', CASE); check('po odebrání kolega věc nevidí', none(r));
    r = await B.from('case_deadlines').select('id').eq('case_id', CASE); check('po odebrání kolega nevidí lhůty', none(r));

    await cleanup();
    const left = await db.from('case_deadlines').select('id', { count: 'exact', head: true }).like('title', 'SDILENI-TEST%');
    const m = await db.from('case_members').select('case_id', { count: 'exact', head: true }).eq('case_id', CASE);
    const t = (await db.from('cases').select('title').eq('id', CASE).single()).data.title;
    console.log(`\nVýsledek: ${ok} PASS, ${bad} FAIL. Úklid: zbylé testovací lhůty=${left.count}, členů sdílení=${m.count}, název věci ${t === original ? 'beze změny' : 'ZMĚNĚN: ' + t}`);
    process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('Chyba testu:', e.message); process.exit(1); });
