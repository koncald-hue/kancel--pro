// Živý test migrace 20261118_21: úkoly mezi kolegy a kalendář kanceláře.
//   A_LOGIN=<advokát v kanceláři> TEST_PASSWORD=<heslo> B_USER=<uuid kolegy ze stejné kanceláře> C_USER=<uuid uživatele mimo kancelář> node scripts/kalendar-test.cjs
// Kolega B se nepřihlašuje: jeho úkoly a události pro A připraví služební klíč, ověřuje se, co s nimi smí A.
const fs = require('fs'); const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const env = {}; for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const miss = ['A_LOGIN', 'TEST_PASSWORD', 'B_USER', 'C_USER'].filter((k) => !process.env[k]); if (miss.length) { console.error('Chybí proměnné: ' + miss.join(', ')); process.exit(2); }
const { B_USER, C_USER } = process.env;
const mk = (k = env.NEXT_PUBLIC_SUPABASE_ANON_KEY) => createClient(env.NEXT_PUBLIC_SUPABASE_URL, k, { auth: { persistSession: false, autoRefreshToken: false } });
const svc = mk(env.SUPABASE_SERVICE_ROLE_KEY), A = mk(); let p = 0, f = 0;
const ok = (n, c, d = '') => { c ? p++ : f++; console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const T = 'KAL-TEST'; const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
(async () => {
  const a = await A.auth.signInWithPassword({ email: process.env.A_LOGIN, password: process.env.TEST_PASSWORD });
  if (a.error) { console.error('Přihlášení selhalo.'); process.exit(1); }
  const UA = a.data.user.id; let r;
  if ((await A.from('team_tasks').select('id').limit(1)).error) { console.log('Migrace 20261118_21 není spuštěná.'); process.exit(3); }
  try {
    // --- Úkoly: A zadává
    r = await A.from('team_tasks').insert({ created_by: UA, assignee_id: B_USER, title: `${T} pro kolegu`, due_date: day(2), due_time: '14:00' }).select('*').single();
    ok('úkol pro kolegu z kanceláře', !r.error && r.data.status === 'open' && r.data.seen_at === null, r.error?.message); const t1 = r.data;
    r = await A.from('team_tasks').insert({ created_by: UA, assignee_id: C_USER, title: `${T} mimo kancelář`, due_date: day(2) }); ok('úkol pro člověka mimo kancelář nejde', !!r.error, r.error?.message?.slice(0, 60));
    r = await A.from('team_tasks').insert({ created_by: B_USER, assignee_id: UA, title: `${T} za cizí jméno`, due_date: day(2) }); ok('úkol za jiného zadavatele nejde', !!r.error);
    r = await A.from('team_tasks').insert({ created_by: UA, assignee_id: UA, title: `${T} pro sebe`, due_date: day(1), status: 'done' }).select('status, seen_at').single(); ok('vlastní úkol vznikne otevřený a viděný', !r.error && r.data.status === 'open' && !!r.data.seen_at, r.error?.message);
    r = await A.from('team_tasks').update({ title: `${T} pro kolegu upraveno`, priority: 'high' }).eq('id', t1.id).select('title'); ok('zadavatel smí upravit zadání', (r.data || [])[0]?.title === `${T} pro kolegu upraveno`, r.error?.message);
    r = await A.from('team_tasks').update({ assignee_id: C_USER }).eq('id', t1.id); ok('předat úkol mimo kancelář nejde', !!r.error, r.error?.message?.slice(0, 60));

    // --- Úkoly: A řeší úkol od B
    const t2 = (await svc.from('team_tasks').insert({ created_by: B_USER, assignee_id: UA, title: `${T} od kolegy`, due_date: day(3), note: 'zadání' }).select('*').single()).data;
    r = await A.from('team_tasks').select('id, seen_at').eq('id', t2.id); ok('řešitel vidí úkol od kolegy', (r.data || []).length === 1 && r.data[0].seen_at === null);
    r = await A.from('team_tasks').update({ seen_at: new Date().toISOString() }).eq('id', t2.id).select('seen_at'); ok('řešitel smí označit „viděno“', !!(r.data || [])[0]?.seen_at, r.error?.message);
    r = await A.from('team_tasks').update({ title: `${T} přepsáno řešitelem` }).eq('id', t2.id); ok('řešitel nesmí měnit zadání', !!r.error, r.error?.message?.slice(0, 60));
    r = await A.from('team_tasks').update({ due_date: day(30) }).eq('id', t2.id); ok('řešitel nesmí posunout termín', !!r.error);
    r = await A.from('team_tasks').update({ status: 'declined', answer: '' }).eq('id', t2.id); ok('odmítnutí bez důvodu nejde', !!r.error, r.error?.message?.slice(0, 60));
    r = await A.from('team_tasks').update({ status: 'done' }).eq('id', t2.id).select('status, done_at'); ok('řešitel úkol splní a zapíše se čas', (r.data || [])[0]?.status === 'done' && !!(r.data || [])[0]?.done_at, r.error?.message);
    r = await A.from('team_tasks').update({ status: 'open' }).eq('id', t2.id).select('done_at'); ok('vrácení do práce smaže čas splnění', (r.data || [])[0]?.done_at === null);
    r = await A.from('team_tasks').update({ status: 'declined', answer: 'jsem u soudu' }).eq('id', t2.id).select('status'); ok('odmítnutí s důvodem', (r.data || [])[0]?.status === 'declined', r.error?.message);
    r = await A.from('team_tasks').delete().eq('id', t2.id).select('id'); ok('řešitel úkol nesmaže (jen zadavatel)', !(r.data || []).length);
    const t3 = (await svc.from('team_tasks').insert({ created_by: B_USER, assignee_id: C_USER, title: `${T} cizí`, due_date: day(3) }).select('id').single()).data;
    r = await A.from('team_tasks').select('id').eq('id', t3?.id); ok('cizí úkol (mezi jinými lidmi) nevidím', !(r.data || []).length);

    // --- Kalendář
    const start = new Date(Date.now() + 2 * 86400000).toISOString(); const end = new Date(Date.now() + 2 * 86400000 + 3600000).toISOString();
    r = await A.from('calendar_events').insert({ user_id: UA, title: `${T} jednání`, kind: 'jednani', starts_at: start, ends_at: end, attendees: [B_USER, UA, B_USER] }).select('attendees').single();
    ok('událost s pozvaným kolegou; duplicity a já sám se z pozvaných odstraní', !r.error && JSON.stringify(r.data.attendees) === JSON.stringify([B_USER]), r.error?.message || JSON.stringify(r.data?.attendees));
    r = await A.from('calendar_events').insert({ user_id: UA, title: `${T} s cizím`, starts_at: start, ends_at: end, attendees: [C_USER] }); ok('pozvat člověka mimo kancelář nejde', !!r.error, r.error?.message?.slice(0, 60));
    r = await A.from('calendar_events').insert({ user_id: UA, title: `${T} obráceně`, starts_at: end, ends_at: start }); ok('konec před začátkem nejde', !!r.error);
    const e2 = (await svc.from('calendar_events').insert({ user_id: B_USER, title: `${T} pozvánka od kolegy`, starts_at: start, ends_at: end, attendees: [UA] }).select('id').single()).data;
    r = await A.from('calendar_events').select('id').eq('id', e2.id); ok('pozvaný vidí událost kolegy', (r.data || []).length === 1);
    r = await A.from('calendar_events').update({ title: 'přepsáno' }).eq('id', e2.id).select('id'); ok('pozvaný událost nezmění', !(r.data || []).length);
    r = await A.from('calendar_events').delete().eq('id', e2.id).select('id'); ok('pozvaný událost nesmaže', !(r.data || []).length);
    const e3 = (await svc.from('calendar_events').insert({ user_id: B_USER, title: `${T} soukromá kolegy`, starts_at: start, ends_at: end }).select('id').single()).data;
    r = await A.from('calendar_events').select('id').eq('id', e3.id); ok('nepozvaný soukromou událost kolegy nevidí', !(r.data || []).length);
    r = await A.rpc('people_names', { p_ids: [B_USER, C_USER] }); ok('jména jen kolegů z kanceláře', !r.error && (r.data || []).length === 1 && r.data[0].user_id === B_USER, JSON.stringify(r.data));

    // --- Odběr kalendáře (iCal) obsahuje úkoly a události
    const feed = (await svc.from('calendar_feeds').select('token').eq('user_id', UA).maybeSingle()).data;
    if (feed?.token) {
      const res = await fetch(`${process.env.BASE || 'http://localhost:3001'}/api/calendar/${feed.token}.ics`).catch(() => null);
      const ics = res ? (await res.text()).replace(/\r\n /g, '') : '';
      ok('odběr kalendáře obsahuje úkol s časem a událost', ics.includes(`${T} pro sebe`) && ics.includes(`${T} jednání`) && ics.includes(`${T} pozvánka od kolegy`) && !ics.includes(`${T} soukromá kolegy`), res ? `HTTP ${res.status}` : 'server neběží');
    } else console.log('  (účet A nemá odběr kalendáře, test iCal vynechán)');
  } finally {
    await svc.from('team_tasks').delete().like('title', `${T}%`);
    await svc.from('calendar_events').delete().like('title', `${T}%`);
    const left = (await svc.from('team_tasks').select('id', { count: 'exact', head: true }).like('title', `${T}%`)).count + (await svc.from('calendar_events').select('id', { count: 'exact', head: true }).like('title', `${T}%`)).count;
    console.log(`\nVýsledek: ${p} PASS, ${f} FAIL; úklid: zbylé záznamy ${left}`); process.exit(f ? 1 : 0);
  }
})().catch((e) => { console.error('Chyba:', e.message); process.exit(1); });
