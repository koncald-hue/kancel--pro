// Živý test po migraci 20261118_11: dobrovolné sdílení hodin vedoucímu a šablony úkolů (oprávnění na úrovni databáze).
//   OWNER_LOGIN=<vedoucí kanceláře> MEMBER_LOGIN=<člen téže kanceláře> [OTHER_LOGIN=<uživatel mimo kancelář, volitelně>] TEST_PASSWORD=<heslo> node scripts/mgmt-test.cjs
const fs = require('fs'); const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const env = {}; for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const need = ['OWNER_LOGIN', 'MEMBER_LOGIN', 'TEST_PASSWORD']; const miss = need.filter((k) => !process.env[k]); if (miss.length) { console.error('Chybí proměnné: ' + miss.join(', ')); process.exit(2); }
const mk = (k = env.NEXT_PUBLIC_SUPABASE_ANON_KEY) => createClient(env.NEXT_PUBLIC_SUPABASE_URL, k, { auth: { persistSession: false, autoRefreshToken: false } });
const svc = mk(env.SUPABASE_SERVICE_ROLE_KEY), O = mk(), M = mk(), X = mk();
let p = 0, f = 0; const ok = (n, c, d = '') => { c ? p++ : f++; console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const day = () => new Date().toISOString().slice(0, 10);

(async () => {
    const HAS_X = !!process.env.OTHER_LOGIN; const [o, m, x] = await Promise.all([[O, 'OWNER_LOGIN'], [M, 'MEMBER_LOGIN'], ...(HAS_X ? [[X, 'OTHER_LOGIN']] : [])].map(([c, k]) => c.auth.signInWithPassword({ email: process.env[k], password: process.env.TEST_PASSWORD })));
    if (o.error || m.error || (HAS_X && x.error)) { console.error('Přihlášení selhalo.'); process.exit(1); }
    const UO = o.data.user.id, UM = m.data.user.id, UX = x?.data?.user?.id; let r;
    const fo = (await svc.from('firm_members').select('firm_id, role').eq('user_id', UO).maybeSingle()).data, fm = (await svc.from('firm_members').select('firm_id, role').eq('user_id', UM).maybeSingle()).data;
    if (!fo || fo.role !== 'owner' || !fm || fm.firm_id !== fo.firm_id) { console.error('OWNER_LOGIN musí být vedoucí kanceláře a MEMBER_LOGIN její člen.'); process.exit(2); }

    // --- Hodiny podle lidí
    const te = await svc.from('time_entries').insert({ user_id: UM, entry_date: day(), minutes: 90, description: 'MGMT-TEST tajný popis', rate: 1000 }).select('id').single();
    await svc.from('time_sharing').delete().eq('user_id', UM);
    r = await O.rpc('team_hours', { p_from: day(), p_to: day() }); const row = (r.data || []).find((t) => t.user_id === UM);
    ok('vedoucí vidí člena v seznamu', !!row, r.error?.message);
    ok('bez zapnutí sdílení nevidí žádná čísla', row && row.shared === false && row.minutes === null && row.amount === null);
    r = await M.from('time_sharing').upsert({ user_id: UM, share: true }); ok('člen si sdílení zapne', !r.error, r.error?.message);
    r = await O.rpc('team_hours', { p_from: day(), p_to: day() }); const row2 = (r.data || []).find((t) => t.user_id === UM);
    ok('po zapnutí vedoucí vidí součet minut a částku', row2 && row2.shared === true && Number(row2.minutes) >= 90 && Number(row2.amount) >= 1500, JSON.stringify(row2));
    ok('výstup neobsahuje popis práce', !JSON.stringify(r.data).includes('tajný'));
    r = await O.from('time_sharing').upsert({ user_id: UM, share: false }); ok('vedoucí členovi sdílení nevypne ani nezapne (cizí řádek)', !!r.error || (await svc.from('time_sharing').select('share').eq('user_id', UM).single()).data.share === true);
    r = await O.from('time_entries').select('id').eq('id', te.data.id); ok('vedoucí nemá přímý přístup k výkazům člena', !(r.data || []).length);
    await M.from('time_sharing').upsert({ user_id: UM, share: false });
    r = await O.rpc('team_hours', { p_from: day(), p_to: day() }); ok('po vypnutí zase čísla zmizí', ((r.data || []).find((t) => t.user_id === UM) || {}).minutes === null);
    r = await M.rpc('team_hours', { p_from: day(), p_to: day() }); ok('člen (ne vedoucí) seznam hodin nedostane', !(r.data || []).length);
    if (HAS_X) {
    r = await X.rpc('team_hours', { p_from: day(), p_to: day() }); ok('uživatel mimo kancelář seznam nedostane', !(r.data || []).length);
    r = await X.from('time_sharing').select('user_id').eq('user_id', UM); ok('cizí uživatel nastavení sdílení nevidí', !(r.data || []).length);
    }

    // --- Šablony úkolů
    r = await O.from('case_templates').insert({ user_id: UO, name: 'MGMT-TEST šablona', items: [{ title: 'Úkol', offset: 3, base: 'start', workdays: true }] }).select('id').single(); ok('šablona se uloží', !r.error, r.error?.message); const tid = r.data?.id;
    r = await M.from('case_templates').select('id').eq('id', tid); ok('kolega šablonu nevidí', !(r.data || []).length);
    r = await M.from('case_templates').update({ name: 'zmena' }).eq('id', tid).select('id'); ok('kolega šablonu nezmění', !(r.data || []).length);
    r = await M.from('case_templates').delete().eq('id', tid).select('id'); ok('kolega šablonu nesmaže', !(r.data || []).length);
    r = await M.from('case_templates').insert({ user_id: UO, name: 'MGMT-TEST cizí', items: [] }); ok('nejde založit šablonu za jiného uživatele', !!r.error);
    r = await O.from('case_templates').insert({ user_id: UO, name: 'MGMT-TEST špatné', items: { a: 1 } }); ok('položky musí být pole', !!r.error);
    r = await O.from('case_templates').insert({ user_id: UO, name: 'MGMT-TEST moc', items: Array.from({ length: 41 }, () => ({ title: 't', offset: 1 })) }); ok('nejvýše 40 položek', !!r.error);

    // --- Úklid
    await svc.from('case_templates').delete().like('name', 'MGMT-TEST%'); await svc.from('time_entries').delete().eq('id', te.data.id); await svc.from('time_sharing').delete().eq('user_id', UM);
    console.log(`\nVýsledek: ${p} PASS, ${f} FAIL`); process.exit(f ? 1 : 0);
})().catch((e) => { console.error('Chyba:', e.message); process.exit(1); });
