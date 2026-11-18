// Živý test migrace 20261118_19: podací deník, zastupování, archiv a skartace, zálohy, opakovaná fakturace, souhrn.
//   A_LOGIN=<vedoucí> TEST_PASSWORD=<heslo> B_USER=<uuid člena téže kanceláře> C_USER=<uuid uživatele mimo kancelář> node scripts/denik-test.cjs
// Účet B se nepřihlašuje: jeho data a zastupování připraví služební klíč, ověřuje se, co z nich vidí A.
const fs = require('fs'); const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const env = {}; for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const miss = ['A_LOGIN', 'TEST_PASSWORD', 'B_USER', 'C_USER'].filter((k) => !process.env[k]); if (miss.length) { console.error('Chybí proměnné: ' + miss.join(', ')); process.exit(2); }
const { B_USER, C_USER } = process.env;
const mk = (k = env.NEXT_PUBLIC_SUPABASE_ANON_KEY) => createClient(env.NEXT_PUBLIC_SUPABASE_URL, k, { auth: { persistSession: false, autoRefreshToken: false } });
const svc = mk(env.SUPABASE_SERVICE_ROLE_KEY), A = mk(); let p = 0, f = 0;
const ok = (n, c, d = '') => { c ? p++ : f++; console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const today = new Date().toISOString().slice(0, 10);
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const T = 'DENIK-TEST';
(async () => {
  const a = await A.auth.signInWithPassword({ email: process.env.A_LOGIN, password: process.env.TEST_PASSWORD });
  if (a.error) { console.error('Přihlášení selhalo.'); process.exit(1); }
  const UA = a.data.user.id; let r;
  const probe = await A.from('mail_log').select('id').limit(1);
  if (probe.error) { console.log('Migrace 20261118_19 není spuštěná:', probe.error.message); process.exit(3); }
  const created = { cases: [], subs: [], mail: [], inv: [], rec: [] };
  try {
    // --- Podací deník
    r = await A.from('mail_log').insert({ user_id: UA, direction: 'in', channel: 'listinna', event_on: today, counterparty: 'Okresní soud', subject: `${T} 1`, source_ref: `${T}:1` }).select('id, year, seq').single(); ok('zápis do deníku dostane číslo jednací', !r.error && r.data.year === Number(today.slice(0, 4)) && r.data.seq > 0, r.error?.message); const m1 = r.data; created.mail.push(m1?.id);
    r = await A.from('mail_log').insert({ user_id: UA, direction: 'out', channel: 'datovka', event_on: today, subject: `${T} 2` }).select('id, seq').single(); ok('další zápis má číslo o jedna vyšší', !r.error && r.data.seq === m1.seq + 1, `${m1?.seq} → ${r.data?.seq}`); created.mail.push(r.data?.id);
    r = await A.from('mail_log').insert({ user_id: UA, direction: 'in', channel: 'email', event_on: today, subject: `${T} dup`, source_ref: `${T}:1` }); ok('stejná zpráva se do deníku nezapíše dvakrát', r.error?.code === '23505', r.error?.message);
    r = await A.from('mail_log').insert({ user_id: UA, direction: 'in', channel: 'listinna', event_on: today, subject: `${T} vlastní číslo`, seq: 99999, year: 1999 }).select('year, seq').single(); ok('vlastní číslo jednací si nelze zvolit', !r.error && r.data.seq !== 99999 && r.data.year !== 1999); created.mail.push(r.data && (await A.from('mail_log').select('id').eq('subject', `${T} vlastní číslo`).single()).data?.id);
    r = await A.from('mail_log').update({ seq: m1.seq + 500 }).eq('id', m1.id).select('seq'); ok('číslo jednací nejde změnit', !!r.error || !(r.data || []).length, r.error?.message);
    r = await A.from('mail_log').update({ event_on: '2020-01-01' }).eq('id', m1.id).select('id'); ok('datum zápisu nejde změnit', !!r.error || !(r.data || []).length, r.error?.message);
    r = await A.from('mail_log').update({ delivered_on: today, delivery_note: 'doručenka' }).eq('id', created.mail[1]).select('delivered_on'); ok('doručení jde doplnit', !r.error && r.data?.[0]?.delivered_on === today, r.error?.message);
    r = await A.from('mail_log').delete().eq('id', m1.id).select('id'); ok('zápis z deníku nejde smazat', !(r.data || []).length);

    // --- Zastupování (B nepřítomen, zastupuje A)
    const bCase = (await svc.from('cases').insert({ user_id: B_USER, title: `${T} věc kolegy`, situation: '', summary: '', urgency: 'low', steps: [], deadline_ids: [], offense_ids: [], template_keys: [] }).select('id').single()).data; created.cases.push(bCase.id);
    await svc.from('case_deadlines').insert({ case_id: bCase.id, user_id: B_USER, title: `${T} lhůta kolegy`, due_date: day(2), kind: 'lhuta' });
    const bMail = (await svc.from('mail_log').insert({ user_id: B_USER, direction: 'in', channel: 'listinna', event_on: today, subject: `${T} pošta kolegy` }).select('id').single()).data; created.mail.push(bMail?.id);
    r = await A.from('cases').select('id').eq('id', bCase.id); ok('bez zastupování věc kolegy nevidím', !(r.data || []).length);
    const sub = (await svc.from('substitutions').insert({ user_id: B_USER, substitute_id: UA, from_on: today, to_on: today, note: T }).select('id').single()).data; created.subs.push(sub.id);
    r = await A.from('cases').select('id').eq('id', bCase.id); ok('zástupce vidí věc nepřítomného', (r.data || []).length === 1);
    r = await A.from('case_deadlines').select('id').eq('case_id', bCase.id); ok('zástupce vidí jeho lhůty', (r.data || []).length === 1);
    r = await A.from('case_deadlines').update({ done: true }).eq('case_id', bCase.id).select('id'); ok('zástupce smí lhůtu vyřídit (editor)', (r.data || []).length === 1, r.error?.message);
    r = await A.from('mail_log').select('id').eq('id', bMail.id); ok('zástupce vidí podací deník nepřítomného', (r.data || []).length === 1);
    r = await A.from('mail_log').update({ note: 'x' }).eq('id', bMail.id).select('id'); ok('zápisy deníku nepřítomného ale nemění', !(r.data || []).length);
    r = await A.rpc('my_substitutions'); ok('přehled zastupování ukazuje jména', !r.error && (r.data || []).some((s) => s.id === sub.id && s.user_name && s.substitute_name), r.error?.message);
    await svc.from('substitutions').update({ from_on: day(-5), to_on: day(-1) }).eq('id', sub.id);
    r = await A.from('cases').select('id').eq('id', bCase.id); ok('po skončení zastupování přístup zaniká', !(r.data || []).length);
    await svc.from('substitutions').update({ from_on: day(1), to_on: day(3) }).eq('id', sub.id);
    r = await A.from('cases').select('id').eq('id', bCase.id); ok('budoucí zastupování ještě přístup nedává', !(r.data || []).length);
    r = await A.from('substitutions').insert({ user_id: UA, substitute_id: C_USER, from_on: today, to_on: today }); ok('zástupce mimo kancelář nejde určit', !!r.error, r.error?.message?.slice(0, 60));
    r = await A.from('substitutions').insert({ user_id: B_USER, substitute_id: UA, from_on: today, to_on: today }); ok('zastupování za kolegu nejde nastavit (jen za sebe)', !!r.error);
    r = await A.from('substitutions').insert({ user_id: UA, substitute_id: B_USER, from_on: today, to_on: day(400) }); ok('zastupování nejvýš na rok', !!r.error);
    r = await A.from('substitutions').insert({ user_id: UA, substitute_id: B_USER, from_on: today, to_on: day(7), note: T }).select('id').single(); ok('vlastní zastupování kolegou jde nastavit', !r.error, r.error?.message); if (r.data) created.subs.push(r.data.id);

    // --- Archiv a skartace
    const c = (await A.from('cases').insert({ user_id: UA, title: `${T} archiv`, situation: '', summary: '', urgency: 'low', steps: [], deadline_ids: [], offense_ids: [], template_keys: [] }).select('id').single()).data; created.cases.push(c.id);
    const arch = (action, on, until, place = '', note = '') => A.rpc('archive_case', { p_case: c.id, p_action: action, p_on: on, p_until: until, p_place: place, p_note: note });
    r = await arch('archivace', today, day(3650)); ok('otevřenou věc nejde archivovat', !!r.error, r.error?.message);
    await A.from('cases').update({ status: 'done' }).eq('id', c.id);
    r = await arch('archivace', today, today); ok('lhůta uložení musí být po archivaci', !!r.error, r.error?.message);
    r = await arch('archivace', day(1), day(3650)); ok('archivace do budoucna nejde', !!r.error, r.error?.message);
    r = await arch('archivace', today, day(3650), 'Regál A', T); ok('uzavřenou věc jde archivovat', !r.error, r.error?.message);
    r = await A.from('cases').update({ archive_until: day(1) }).eq('id', c.id); ok('lhůtu nejde změnit přímým zápisem', !!r.error, r.error?.message);
    r = await A.from('cases').update({ status: 'open' }).eq('id', c.id); ok('archivovanou věc nejde znovu otevřít', !!r.error, r.error?.message);
    r = await A.from('cases').update({ note: `${T} poznámka` }).eq('id', c.id).select('id'); ok('ostatní údaje věci jdou upravit dál', !r.error && (r.data || []).length === 1, r.error?.message);
    r = await arch('skartace', today, null); ok('skartace před uplynutím lhůty nejde', !!r.error, r.error?.message);
    r = await arch('prodlouzeni', today, day(100)); ok('prodloužení na dřívější datum nejde', !!r.error, r.error?.message);
    r = await arch('prodlouzeni', today, day(4000)); ok('prodloužení jde', !r.error, r.error?.message);
    r = await arch('vydani', today, null, '', 'předáno klientovi'); ok('vydání spisu jde', !r.error, r.error?.message);
    r = await arch('vydani', today, null); ok('podruhé vydat nejde', !!r.error);
    r = await A.from('cases').select('archived_on, archive_until, disposal, disposed_on').eq('id', c.id).single(); ok('věc má stav vydáno', r.data?.disposal === 'vydano' && r.data?.disposed_on === today, JSON.stringify(r.data));
    r = await A.from('case_archive_log').select('id, action').eq('case_id', c.id).order('created_at'); ok('protokol má 3 zápisy', (r.data || []).map((x) => x.action).join(',') === 'archivace,prodlouzeni,vydani', (r.data || []).map((x) => x.action).join(','));
    const logId = r.data?.[0]?.id;
    r = await A.from('case_archive_log').update({ note: 'změna' }).eq('id', logId).select('id'); const still = (await svc.from('case_archive_log').select('note').eq('id', logId).single()).data; ok('protokol nejde měnit', (!!r.error || !(r.data || []).length) && still?.note === T, still?.note);
    r = await A.from('case_archive_log').delete().eq('id', logId).select('id'); ok('protokol nejde smazat', !(r.data || []).length);
    r = await A.rpc('archive_case', { p_case: bCase.id, p_action: 'archivace', p_on: today, p_until: day(10), p_place: '', p_note: '' }); ok('cizí věc nejde archivovat', !!r.error);

    // --- Zálohová faktura, opakovaná fakturace, souhrny
    r = await A.from('invoices').insert({ user_id: UA, title: `${T} záloha`, kind: 'zaloha' }).select('id, kind').single(); ok('koncept zálohové faktury', !r.error && r.data.kind === 'zaloha', r.error?.message); if (r.data) created.inv.push(r.data.id);
    r = await A.from('invoices').insert({ user_id: UA, title: `${T} špatný druh`, kind: 'dobropis' }); ok('neznámý druh faktury databáze odmítne', !!r.error);
    r = await A.from('invoice_recurring').insert({ user_id: UA, title: `${T} paušál`, every: 'month', next_on: today, lines: [{ description: 'Paušál', qty: 1, unit: 'měsíc', unit_price: 5000, vat_rate: 21 }] }).select('id').single(); ok('opakovaná fakturace', !r.error, r.error?.message); if (r.data) created.rec.push(r.data.id);
    r = await A.from('invoice_recurring').insert({ user_id: UA, title: `${T} bez řádků`, every: 'month', next_on: today, lines: [] }); ok('opakovaná fakturace bez položek nejde', !!r.error);
    r = await A.from('digest_settings').upsert({ user_id: UA, weekly: false, details: false }); ok('nastavení souhrnu jde uložit', !r.error, r.error?.message);
    r = await A.from('client_digest').upsert({ case_id: c.id, user_id: UA, enabled: false }); ok('klientský přehled u vlastní věci', !r.error, r.error?.message);
    r = await A.from('client_digest').upsert({ case_id: bCase.id, user_id: UA, enabled: true }); ok('klientský přehled u cizí věci nejde', !!r.error);
  } finally {
    await svc.from('client_digest').delete().in('case_id', created.cases);
    await svc.from('substitutions').delete().in('id', created.subs);
    await svc.from('mail_log').delete().like('subject', `${T}%`);
    await svc.from('case_archive_log').delete().like('case_title', `${T}%`);
    await svc.from('invoices').delete().in('id', created.inv);
    await svc.from('invoice_recurring').delete().in('id', created.rec);
    await svc.from('case_deadlines').delete().like('title', `${T}%`);
    await svc.from('work_activity').delete().like('label', `${T}%`);
    await svc.from('cases').delete().in('id', created.cases);
    const left = (await svc.from('cases').select('id', { count: 'exact', head: true }).like('title', `${T}%`)).count + (await svc.from('mail_log').select('id', { count: 'exact', head: true }).like('subject', `${T}%`)).count;
    console.log(`\nVýsledek: ${p} PASS, ${f} FAIL; úklid: zbylé záznamy ${left}`); process.exit(f ? 1 : 0);
  }
})().catch((e) => { console.error('Chyba:', e.message); process.exit(1); });
