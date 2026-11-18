// Živý test úschov a střetu zájmů v kanceláři (po migracích 20261118_13 a _14):
//   A_LOGIN=<e-mail> TEST_PASSWORD=<heslo> [B_LOGIN=<jiný uživatel>] node scripts/uschovy-test.cjs
const fs = require('fs'); const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const env = {}; for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const miss = ['A_LOGIN', 'TEST_PASSWORD'].filter((k) => !process.env[k]); if (miss.length) { console.error('Chybí proměnné: ' + miss.join(', ')); process.exit(2); }
const mk = (k = env.NEXT_PUBLIC_SUPABASE_ANON_KEY) => createClient(env.NEXT_PUBLIC_SUPABASE_URL, k, { auth: { persistSession: false, autoRefreshToken: false } });
const svc = mk(env.SUPABASE_SERVICE_ROLE_KEY), A = mk(), B = mk(); let p = 0, f = 0;
const ok = (n, c, d = '') => { c ? p++ : f++; console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const a = await A.auth.signInWithPassword({ email: process.env.A_LOGIN, password: process.env.TEST_PASSWORD });
  const b = process.env.B_LOGIN ? await B.auth.signInWithPassword({ email: process.env.B_LOGIN, password: process.env.TEST_PASSWORD }) : null;
  if (a.error || (b && b.error)) { console.error('Přihlášení selhalo.'); process.exit(1); }
  const UA = a.data.user.id, UB = b ? b.data.user.id : null; let r;
  const probe = await A.from('escrows').select('id').limit(1);
  if (probe.error) { console.log('Migrace 20261118_14 není spuštěná:', probe.error.message); process.exit(3); }
  r = await A.from('escrows').insert({ user_id: UA, title: 'USCHOVY-TEST', currency: 'CZK' }).select('id').single(); ok('úschova se založí', !r.error, r.error?.message); const E = r.data?.id;
  const mv = (kind, amount) => A.from('escrow_moves').insert({ escrow_id: E, user_id: UA, kind, amount }).select('id').single();
  r = await mv('deposit', 1000); ok('příjem 1000', !r.error, r.error?.message); const M1 = r.data?.id;
  r = await mv('payout', 1000.01); ok('výdej nad zůstatek databáze odmítne', !!r.error, r.error?.message);
  r = await mv('payout', 400); ok('výdej 400', !r.error, r.error?.message);
  const bal = await A.rpc('escrow_balance', { p_escrow: E }); ok('zůstatek je 600', Number(bal.data) === 600, String(bal.data));
  r = await A.from('escrow_moves').update({ amount: 1 }).eq('id', M1).select('id'); ok('pohyb nejde upravit', !!r.error || !(r.data || []).length, r.error?.message);
  r = await A.from('escrow_moves').delete().eq('id', M1).select('id'); ok('pohyb nejde smazat', !!r.error || !(r.data || []).length, r.error?.message);
  r = await A.from('escrows').update({ status: 'closed' }).eq('id', E); ok('úschova s nenulovým zůstatkem nejde uzavřít', !!r.error, r.error?.message);
  r = await A.from('escrows').delete().eq('id', E); ok('úschova s pohyby nejde smazat', !!r.error, r.error?.message);
  if (b) {
    r = await B.from('escrows').select('id').eq('id', E); ok('cizí uživatel úschovu nevidí', !(r.data || []).length);
    r = await B.from('escrow_moves').insert({ escrow_id: E, user_id: UB, kind: 'deposit', amount: 5 }); ok('cizí uživatel nezapíše pohyb do cizí úschovy', !!r.error);
  } else console.log('  (B_LOGIN nezadán, testy cizího uživatele vynechány)');
  r = await mv('payout', 600); ok('výdej zbytku', !r.error, r.error?.message);
  r = await A.from('escrows').update({ status: 'closed' }).eq('id', E); ok('s nulovým zůstatkem jde uzavřít', !r.error, r.error?.message);
  r = await mv('deposit', 1); ok('do uzavřené úschovy se nezapíše', !!r.error, r.error?.message);
  r = await A.from('escrows').update({ status: 'open' }).eq('id', E); ok('uzavřená se znovu neotevře', !!r.error, r.error?.message);

  const cf = await A.rpc('conflict_firm_check', { p_names: ['USCHOVY-TEST klient'], p_icos: [] });
  if (cf.error) console.log('  (migrace 20261118_13 není spuštěná: ' + cf.error.message.slice(0, 60) + ')'); else ok('střet zájmů v kanceláři vrací jen seznam bez obsahu', Array.isArray(cf.data) && cf.data.every((x) => Object.keys(x).sort().join() === 'kind,n,term'));
  const anon = await mk().rpc('conflict_firm_check', { p_names: ['abcd'], p_icos: [] }); ok('anonym funkci nezavolá', !!anon.error || !(anon.data || []).length);

  await svc.from('escrow_moves').delete().eq('escrow_id', E); await svc.from('escrows').delete().eq('id', E);
  const left = (await svc.from('escrows').select('id', { count: 'exact', head: true }).eq('title', 'USCHOVY-TEST')).count;
  console.log(`\nVýsledek: ${p} PASS, ${f} FAIL; úklid: zbylých úschov ${left}`); process.exit(f ? 1 : 0);
})().catch((e) => { console.error('Chyba:', e.message); process.exit(1); });
