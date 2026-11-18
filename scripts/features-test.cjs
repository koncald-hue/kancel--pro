// Živý test nových funkcí proti skutečné databázi: audit, hledání v obsahu souborů, verze, vzhled stránky, souhlas s AI.
// Vytvoří a na konci smaže testovací záznamy (jen auditní záznamy zůstanou, jsou záměrně jen pro přidávání).
//   A_LOGIN=<e-mail> B_LOGIN=<e-mail kolegy bez sdílení> TEST_PASSWORD=<heslo> A_CASE=<věc uživatele A> BASE=http://localhost:3001 node scripts/features-test.cjs
const fs = require('fs'); const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const env = {}; for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const need = ['A_LOGIN', 'B_LOGIN', 'TEST_PASSWORD', 'A_CASE']; const miss = need.filter((k) => !process.env[k]); if (miss.length) { console.error('Chybí proměnné: ' + miss.join(', ')); process.exit(2); }
const BASE = process.env.BASE || 'http://localhost:3001'; const CASE = process.env.A_CASE;
const mk = (k = env.NEXT_PUBLIC_SUPABASE_ANON_KEY) => createClient(env.NEXT_PUBLIC_SUPABASE_URL, k, { auth: { persistSession: false, autoRefreshToken: false } });
const svc = mk(env.SUPABASE_SERVICE_ROLE_KEY), A = mk(), B = mk();
let p = 0, f = 0; const ok = (n, c, d = '') => { c ? p++ : f++; console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };

(async () => {
    const a = await A.auth.signInWithPassword({ email: process.env.A_LOGIN, password: process.env.TEST_PASSWORD });
    const b = await B.auth.signInWithPassword({ email: process.env.B_LOGIN, password: process.env.TEST_PASSWORD });
    if (a.error || b.error) { console.error('Přihlášení selhalo.'); process.exit(1); }
    const UA = a.data.user.id, TA = a.data.session.access_token;
    let r;

    // --- Audit
    r = await A.from('case_entries').insert({ case_id: CASE, user_id: UA, kind: 'note', title: 'AUDIT-TEST záznam', body: 'TAJNY OBSAH NESMI DO AUDITU' }).select('id').single(); ok('vložení záznamu do chronologie', !r.error, r.error?.message); const eid = r.data?.id;
    await A.from('case_entries').update({ title: 'AUDIT-TEST změněno', body: 'jiny tajny obsah' }).eq('id', eid);
    await A.rpc('log_case_event', { p_case: CASE, p_action: 'otevreno' }); await A.rpc('log_case_event', { p_case: CASE, p_action: 'otevreno' });
    r = await A.rpc('audit_list', { p_case: CASE, p_limit: 100 }); const rows = r.data || [];
    ok('audit_list vrací události z vlastní věci', rows.length > 0, r.error?.message);
    ok('vytvoření i změna záznamu jsou zapsané (u změny název sloupce)', rows.some((x) => x.action === 'vytvoreno' && x.entity === 'case_entries') && rows.some((x) => x.action === 'zmeneno' && x.entity === 'case_entries' && x.changed.includes('title')));
    ok('v auditu NENÍ obsah, jen název a názvy sloupců', !/TAJNY OBSAH|jiny tajny/.test(JSON.stringify(rows)));
    const opened = (await svc.from('audit_log').select('id', { count: 'exact', head: true }).eq('case_id', CASE).eq('actor', UA).eq('action', 'otevreno').gt('at', new Date(Date.now() - 120000).toISOString())).count;
    ok('dvě otevření věci hned po sobě se zapíšou jen jednou', opened === 1, 'zapsáno ' + opened);
    ok('jméno autora je vyřešené', rows.some((x) => x.actor_name && x.actor_name !== 'klient / systém'));
    r = await B.rpc('audit_list', { p_case: CASE, p_limit: 50 }); const bu = b.data.user.id; const bn = (await svc.from('lawyer_access').select('display_name,firm_name,email').eq('user_id', bu).single()).data; const bName = bn.display_name || bn.firm_name || bn.email;
    ok('kolega bez sdílení audit věci nevidí (kromě svých dřívějších úkonů)', (r.data || []).filter((x) => x.actor_name !== bName).length === 0);

    // --- Hledání v obsahu souborů
    const file = await svc.from('case_files').insert({ case_id: CASE, user_id: UA, name: 'smlouva-test.docx', path: `${UA}/${CASE}/live-test.docx`, size: 10, mime: '', enc: false }).select('id').single();
    r = await A.from('case_file_text').insert({ file_id: file.data.id, case_id: CASE, user_id: UA, body: 'Smlouva o dílo mezi objednatelem a zhotovitelem. Cena díla činí 50 000 Kč. Záruční doba 24 měsíců.' }); ok('uložení textu souboru', !r.error, r.error?.message);
    for (const q of ['zhotovitelem', 'zhotovit', 'dilo smlouva', 'zarucni', 'ZÁRUČNÍ DOBA']) { r = await A.rpc('search_file_text', { p_q: q }); ok(`hledání „${q}“ najde soubor (diakritika, předpona, velikost písmen)`, (r.data || []).some((x) => x.file_id === file.data.id), r.error?.message); }
    r = await A.rpc('search_file_text', { p_q: 'zhotovitel' }); console.log('   úryvek:', (r.data || [])[0]?.snippet);
    r = await B.rpc('search_file_text', { p_q: 'zhotovitel' }); ok('kolega bez sdílení v obsahu nic nenajde', !(r.data || []).some((x) => x.file_id === file.data.id));
    const enc = await svc.from('case_files').insert({ case_id: CASE, user_id: UA, name: 'tajne.docx', path: `${UA}/${CASE}/enc.docx`, size: 1, mime: '', enc: true }).select('id').single();
    r = await A.from('case_file_text').insert({ file_id: enc.data.id, case_id: CASE, user_id: UA, body: 'zasifrovany soubor' }); ok('text ŠIFROVANÉHO souboru databáze nepřijme', !!r.error);

    // --- Verze souborů
    const v2 = await A.from('case_files').insert({ case_id: CASE, user_id: UA, name: 'smlouva-test.docx', path: `${UA}/${CASE}/live-test-v2.docx`, size: 11, mime: '', version: 2, version_of: file.data.id }).select('id,version,version_of').single();
    ok('nová verze souboru se uloží s vazbou na původní', !v2.error && v2.data.version === 2 && v2.data.version_of === file.data.id, v2.error?.message);

    // --- Vzhled klientské stránky
    r = await A.rpc('save_portal_branding', { p_accent: 'emerald', p_greeting: 'Dobrý den, vítejte.' }); ok('barva a uvítání se uloží', !r.error, r.error?.message);
    const la = (await svc.from('lawyer_access').select('portal_accent,portal_greeting').eq('user_id', UA).single()).data; ok('hodnoty jsou v databázi', la.portal_accent === 'emerald' && la.portal_greeting.startsWith('Dobrý'));
    await A.rpc('save_portal_branding', { p_accent: 'indigo', p_greeting: '' });

    // --- AI se souhlasem
    const call = async (body) => { const x = await fetch(BASE + '/api/case-ai', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TA }, body: JSON.stringify(body) }); return { status: x.status, json: await x.json().catch(() => ({})) }; };
    const text = 'Dobrý den, žalobce (RČ 800101/1234, e-mail kontakt@example.invalid, tel. +420 777 123 456, účet 19-2000145399/0800) požaduje do 20. 12. 2030 zaplacení 50 000 Kč za dílo dle smlouvy.';
    let x = await call({ mode: 'summary', text, confirmed: true }); ok('AI bez souhlasu je odmítnuta (403)', x.status === 403, 'status ' + x.status);
    await A.rpc('set_ai_consent', { p_on: true });
    x = await call({ mode: 'summary', text }); ok('AI bez potvrzení odeslání je odmítnuta (400)', x.status === 400, 'status ' + x.status);
    x = await call({ mode: 'summary', text: 'krátké', confirmed: true }); ok('příliš krátký text odmítnut (400)', x.status === 400);
    x = await call({ mode: 'summary', text, confirmed: true }); ok('AI se souhlasem a potvrzením odpoví (200), server zakryl identifikátory', x.status === 200 && x.json.redacted >= 4, `status ${x.status}, zakryto ${x.json.redacted}`);
    if (x.json.answer) console.log('   odpověď AI:', x.json.answer.slice(0, 260).replace(/\n/g, ' '));
    ok('odpověď neobsahuje zakrytá čísla', !/800101|2000145399|kontakt@example|777 123/.test(x.json.answer || ''));
    await A.rpc('set_ai_consent', { p_on: false }); x = await call({ mode: 'summary', text, confirmed: true }); ok('po odvolání souhlasu je AI zase odmítnuta (403)', x.status === 403);

    // --- Úklid
    await svc.from('case_files').delete().in('id', [file.data.id, enc.data.id, v2.data?.id].filter(Boolean)); await svc.from('case_entries').delete().eq('id', eid);
    const left = await svc.from('case_file_text').select('file_id', { count: 'exact', head: true }).in('file_id', [file.data.id, enc.data.id]);
    console.log(`\nVýsledek: ${p} PASS, ${f} FAIL; úklid: zbylý text souborů ${left.count}`); process.exit(f ? 1 : 0);
})().catch((e) => { console.error('Chyba:', e.message); process.exit(1); });
