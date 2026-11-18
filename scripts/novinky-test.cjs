// Živý test databázové části novinek (úkon z dokumentu, hromadný e-mail, upomínky, výchozí šablona) proti skutečné DB.
//   A_LOGIN=<e-mail> TEST_PASSWORD=<heslo> A_CASE=<věc A> B_CASE=<cizí věc> node scripts/novinky-test.cjs
// E-maily se NEODESÍLAJÍ (odeslání jde přes vaši schránku a zkouší se ručně v aplikaci).
const fs = require('fs'); const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const env = {}; for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const miss = ['A_LOGIN', 'TEST_PASSWORD', 'A_CASE', 'B_CASE'].filter((k) => !process.env[k]); if (miss.length) { console.error('Chybí proměnné: ' + miss.join(', ')); process.exit(2); }
const { A_CASE, B_CASE } = process.env;
const mk = (k = env.NEXT_PUBLIC_SUPABASE_ANON_KEY) => createClient(env.NEXT_PUBLIC_SUPABASE_URL, k, { auth: { persistSession: false, autoRefreshToken: false } });
const svc = mk(env.SUPABASE_SERVICE_ROLE_KEY), A = mk(); let p = 0, f = 0;
const ok = (n, c, d = '') => { c ? p++ : f++; console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const a = await A.auth.signInWithPassword({ email: process.env.A_LOGIN, password: process.env.TEST_PASSWORD }); if (a.error) { console.error('Přihlášení selhalo.'); process.exit(1); }
  const U = a.data.user.id; const today = new Date().toISOString().slice(0, 10); let r;
  r = await A.from('time_entries').insert({ case_id: A_CASE, user_id: U, entry_date: today, minutes: 12, rate: 2000, description: 'NOVINKY-TEST čtení dokumentu' }).select('id').single(); ok('časový úkon z dokumentu se zapíše', !r.error, r.error?.message); const te = r.data?.id;
  r = await A.from('case_deadlines').insert({ case_id: A_CASE, user_id: U, title: 'NOVINKY-TEST Odpovědět', due_date: today, kind: 'ukol' }).select('id').single(); ok('úkol „Odpovědět“ se založí', !r.error, r.error?.message); const dl = r.data?.id;
  r = await A.from('case_entries').insert({ case_id: A_CASE, user_id: U, kind: 'event', title: 'NOVINKY-TEST Odeslán e-mail klientovi', body: 'x' }).select('id').single(); ok('zápis o odeslaném e-mailu do chronologie', !r.error, r.error?.message); const ce = r.data?.id;
  r = await A.from('case_entries').insert({ case_id: B_CASE, user_id: U, kind: 'event', title: 'NOVINKY-TEST cizí', body: 'x' }); ok('do cizí věci zápis nejde', !!r.error);
  r = await A.from('time_entries').insert({ case_id: B_CASE, user_id: U, entry_date: today, minutes: 6, rate: 1, description: 'NOVINKY-TEST cizí' }); ok('do cizí věci čas nejde', !!r.error);
  const inv = await svc.from('invoices').select('id').eq('user_id', U).limit(1);
  if (inv.data?.length) {
    r = await A.from('invoice_reminders').insert({ user_id: U, invoice_id: inv.data[0].id, level: 1, sent_on: today, channel: 'e-mail' }).select('id').single(); ok('záznam o odeslané upomínce', !r.error, r.error?.message);
    if (r.data) await svc.from('invoice_reminders').delete().eq('id', r.data.id);
  } else console.log('  (žádná faktura, test upomínek vynechán)');
  r = await A.from('case_templates').select('id, is_default').limit(1); ok('sloupec is_default existuje (migrace 12)', !r.error, r.error?.message);
  await svc.from('time_entries').delete().like('description', 'NOVINKY-TEST%'); await svc.from('case_deadlines').delete().like('title', 'NOVINKY-TEST%'); await svc.from('case_entries').delete().like('title', 'NOVINKY-TEST%');
  console.log(`\nVýsledek: ${p} PASS, ${f} FAIL`); process.exit(f ? 1 : 0);
})().catch((e) => { console.error('Chyba:', e.message); process.exit(1); });
