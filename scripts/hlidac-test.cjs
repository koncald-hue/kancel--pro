// Živý test Hlídače a souvisejících změn proti skutečné databázi a API (po migraci 20261118_10):
// hlídání řízení v katastru (sloupce, události radaru, jedinečnost, oprávnění), úkon „splnění úkolu“ pro výkazy,
// upozornění klientovi (jen kontroly vstupu a oprávnění, e-mail se NEODEŠLE).
//   A_LOGIN=<e-mail> B_LOGIN=<e-mail kolegy bez sdílení> TEST_PASSWORD=<heslo> A_CASE=<věc A> C_CASE=<cizí věc> BASE=http://localhost:3001 node scripts/hlidac-test.cjs
const fs = require('fs'); const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const env = {}; for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const need = ['A_LOGIN', 'B_LOGIN', 'TEST_PASSWORD', 'A_CASE', 'C_CASE']; const miss = need.filter((k) => !process.env[k]); if (miss.length) { console.error('Chybí proměnné: ' + miss.join(', ')); process.exit(2); }
const BASE = process.env.BASE || 'http://localhost:3001'; const { A_CASE, C_CASE } = process.env;
const mk = (k = env.NEXT_PUBLIC_SUPABASE_ANON_KEY) => createClient(env.NEXT_PUBLIC_SUPABASE_URL, k, { auth: { persistSession: false, autoRefreshToken: false } });
const svc = mk(env.SUPABASE_SERVICE_ROLE_KEY), A = mk(), B = mk();
let p = 0, f = 0; const ok = (n, c, d = '') => { c ? p++ : f++; console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const post = async (token, body) => { const r = await fetch(BASE + '/api/portal-notify', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => ({})) }; };

(async () => {
    const a = await A.auth.signInWithPassword({ email: process.env.A_LOGIN, password: process.env.TEST_PASSWORD });
    const b = await B.auth.signInWithPassword({ email: process.env.B_LOGIN, password: process.env.TEST_PASSWORD });
    if (a.error || b.error) { console.error('Přihlášení selhalo.'); process.exit(1); }
    const UA = a.data.user.id, UB = b.data.user.id, TA = a.data.session.access_token; let r;
    const snap = { kind: 'rizeni', id: 999001, typ: 'V', typNazev: 'Vklad', cislo: '1/2030', kodPracoviste: 101, datumPrijeti: '2030-01-01', stav: 'Probíhá', stavUhrady: 'Uhrazeno', navazana: [], poznamky: [] };

    // --- Hlídání řízení
    r = await A.from('case_properties').insert({ case_id: A_CASE, user_id: UA, label: 'HLIDAC-TEST řízení', snapshot: snap }).select('id,watch,watch_checked_at,watch_error').single();
    ok('uložené řízení má sloupce hlídání (migrace 10 je spuštěná)', !r.error && r.data.watch === false && 'watch_checked_at' in r.data, r.error?.message); const pid = r.data?.id;
    r = await A.from('case_properties').update({ watch: true }).eq('id', pid).select('watch'); ok('vlastník zapne hlídání řízení', r.data?.[0]?.watch === true, r.error?.message);
    r = await B.from('case_properties').update({ watch: false }).eq('id', pid).select('id'); ok('cizí uživatel hlídání nevypne', !(r.data || []).length);
    r = await B.from('case_properties').select('id').eq('id', pid); ok('cizí uživatel řízení nevidí', !(r.data || []).length);
    r = await A.from('radar_events').insert({ user_id: UA, case_id: A_CASE, contact_id: null, kind: 'katastr_rizeni', ref: 'rizeni:999001:abc', title: 'HLIDAC-TEST změna', detail: 'stav: Probíhá → Zapsáno' }).select('id'); ok('událost „změna řízení v katastru“ jde zapsat (nový druh)', !r.error && r.data?.length === 1, r.error?.message);
    r = await A.from('radar_events').insert({ user_id: UA, case_id: A_CASE, contact_id: null, kind: 'katastr_rizeni', ref: 'rizeni:999001:abc', title: 'HLIDAC-TEST duplicita', detail: '' }); ok('stejná změna se nezapíše podruhé (jedinečnost)', !!r.error, r.error?.message?.slice(0, 50));
    r = await B.from('radar_events').insert({ user_id: UB, case_id: A_CASE, contact_id: null, kind: 'katastr_rizeni', ref: 'x', title: 'HLIDAC-TEST' }); ok('cizí uživatel nezapíše událost do cizí věci', !!r.error);
    r = await A.from('radar_events').insert({ user_id: UA, case_id: A_CASE, kind: 'neznamy_druh', ref: 'y', title: 'HLIDAC-TEST' }); ok('neznámý druh události databáze odmítne', !!r.error);

    // --- Výkazy: splnění úkolu je nový zdroj návrhu
    r = await A.from('case_deadlines').insert({ case_id: A_CASE, user_id: UA, title: 'HLIDAC-TEST úkol', due_date: '2030-01-01', kind: 'ukol' }).select('id').single(); const did = r.data?.id; ok('úkol se založí', !r.error, r.error?.message);
    const before = (await svc.from('work_activity').select('id', { count: 'exact', head: true }).eq('kind', 'deadline_done').eq('label', 'HLIDAC-TEST úkol')).count;
    await A.from('case_deadlines').update({ done: true }).eq('id', did);
    const after = await svc.from('work_activity').select('id, case_id, user_id').eq('kind', 'deadline_done').eq('label', 'HLIDAC-TEST úkol');
    ok('splnění úkolu zapíše úkon pro návrh výkazu', before === 0 && (after.data || []).length === 1 && after.data[0].user_id === UA && after.data[0].case_id === A_CASE, `před ${before}, po ${(after.data || []).length}`);
    await A.from('case_deadlines').update({ title: 'HLIDAC-TEST úkol upraveno' }).eq('id', did);
    ok('úprava hotového úkolu další úkon nezapíše', ((await svc.from('work_activity').select('id', { count: 'exact', head: true }).eq('kind', 'deadline_done').eq('case_id', A_CASE).like('label', 'HLIDAC-TEST%')).count) === 1);

    // --- Upozornění klientovi: kontroly vstupu a oprávnění (e-mail se neodešle)
    let x = await post(null, { caseId: A_CASE, confirmed: true }); ok('upozornění bez přihlášení: 401', x.status === 401);
    x = await post(TA, { caseId: 'ne-uuid', confirmed: true }); ok('upozornění s neplatným id věci: 400', x.status === 400);
    x = await post(TA, { caseId: A_CASE }); ok('upozornění bez výslovného potvrzení: 400', x.status === 400 && x.json.error === 'not_confirmed');
    x = await post(TA, { caseId: C_CASE, confirmed: true }); ok('upozornění k cizí věci: 403', x.status === 403, 'status ' + x.status);
    const links = (await svc.from('client_links').select('id').eq('case_id', A_CASE)).data || [];
    if (!links.length) { x = await post(TA, { caseId: A_CASE, confirmed: true }); ok('upozornění u věci bez klientské stránky: 409, nic se neodešle', x.status === 409 && x.json.error === 'no_link', 'status ' + x.status); }
    else console.log('  (věc A_CASE má klientský odkaz, test „bez odkazu“ vynechán, aby se neodeslal e-mail)');

    // --- Úklid
    await svc.from('radar_events').delete().like('title', 'HLIDAC-TEST%'); await svc.from('case_properties').delete().eq('id', pid); await svc.from('case_deadlines').delete().eq('id', did);
    await svc.from('work_activity').delete().like('label', 'HLIDAC-TEST%'); await svc.from('case_entries').delete().like('title', 'HLIDAC-TEST%');
    const left = (await svc.from('radar_events').select('id', { count: 'exact', head: true }).like('title', 'HLIDAC-TEST%')).count;
    console.log(`\nVýsledek: ${p} PASS, ${f} FAIL; úklid: zbylé události ${left}`); process.exit(f ? 1 : 0);
})().catch((e) => { console.error('Chyba:', e.message); process.exit(1); });
