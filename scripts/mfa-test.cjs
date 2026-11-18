// Test dvoufázového přihlášení proti SKUTEČNÉ databázi: zapíše testovacímu účtu TOTP, ověří, že token úrovně aal1 (jen heslo)
// data nevidí a aal2 ano, ověří API a úložiště, a faktor na konci ODSTRANÍ (i při chybě). Vyžaduje migraci 20261118_05 (a 06 pro audit).
//   COLLEAGUE_LOGIN=<e-mail> TEST_PASSWORD=<heslo> TEST_CASE=<id věci uživatele> BASE=http://localhost:3001 node scripts/mfa-test.cjs
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const env = {}; for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const need = ['COLLEAGUE_LOGIN', 'TEST_PASSWORD', 'TEST_CASE']; const miss = need.filter((k) => !process.env[k]); if (miss.length) { console.error('Chybí proměnné: ' + miss.join(', ')); process.exit(2); }
const BASE = process.env.BASE || 'http://localhost:3001';
const mk = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32 = (s) => { let bits = 0, v = 0; const out = []; for (const c of s.toUpperCase().replace(/=+$/, '')) { v = (v << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
const totp = (secret, at = Date.now()) => { const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(Math.floor(at / 30000))); const h = crypto.createHmac('sha1', b32(secret)).update(buf).digest(); const o = h[h.length - 1] & 15; return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0'); };
let pass = 0, fail = 0; const ok = (n, c, d = '') => { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n + (d ? '  -> ' + d : '')); };
const call = async (p, token) => { const r = await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: '{}' }); return r.status; };

(async () => {
    const U = mk(); const s = await U.auth.signInWithPassword({ email: process.env.COLLEAGUE_LOGIN, password: process.env.TEST_PASSWORD });
    if (s.error) { console.error('Přihlášení selhalo.'); process.exit(1); }
    const aal1 = s.data.session.access_token; const uid = s.data.user.id;
    let factorId = null;
    try {
        const before = mk(); await before.auth.setSession({ access_token: aal1, refresh_token: s.data.session.refresh_token });
        const casesBefore = await before.from('cases').select('id').eq('id', process.env.TEST_CASE); ok('(kontrola) bez druhého faktoru účet data vidí', (casesBefore.data ?? []).length === 1);
        const en = await U.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'pentest-' + Date.now() });
        if (en.error) { console.log('  Zápis faktoru selhal: ' + en.error.message + ' (je TOTP zapnuté v Supabase: Authentication → Multi-Factor?)'); process.exit(1); }
        factorId = en.data.id; const secret = en.data.totp.secret;
        const ch = await U.auth.mfa.challenge({ factorId }); const ver = await U.auth.mfa.verify({ factorId, challengeId: ch.data.id, code: totp(secret) });
        ok('ověření kódem z aplikace projde a vznikne relace aal2', !ver.error, ver.error?.message);
        const aal2 = ver.data?.access_token; const lvl = await U.auth.mfa.getAuthenticatorAssuranceLevel();
        ok('úroveň po ověření je aal2', lvl.data?.currentLevel === 'aal2', JSON.stringify(lvl.data));
        // Starý token (jen heslo) je platný, ale databáze mu data nevydá
        const old = mk(); await old.auth.setSession({ access_token: aal1, refresh_token: s.data.session.refresh_token });
        let r = await old.from('cases').select('id').eq('id', process.env.TEST_CASE); ok('token aal1 (jen heslo) NEVIDÍ věci', (r.data ?? []).length === 0, r.error?.message);
        for (const t of ['case_files', 'case_entries', 'client_links', 'lawyer_clients', 'time_entries', 'invoices', 'mail_accounts', 'isds_accounts']) { r = await old.from(t).select('*').limit(5); ok(`token aal1 nevidí ${t}`, (r.data ?? []).length === 0); }
        r = await old.from('cases').insert({ user_id: uid, title: 'MFA-TEST' }).select('id'); ok('token aal1 nezapíše novou věc', !!r.error || (r.data ?? []).length === 0);
        if (r.data?.length) { const x = mk(); await x.auth.setSession({ access_token: aal2, refresh_token: ver.data.refresh_token }); await x.from('cases').delete().eq('title', 'MFA-TEST'); }
        const st = await old.storage.from('case-files').list(`${uid}`, { limit: 5 }); ok('token aal1 nevypíše úložiště', !(st.data ?? []).length);
        r = await old.rpc('audit_list', {}); ok('token aal1 nedostane auditní záznam', !(r.data ?? []).length);
        ok('API odmítne token aal1 s chybou „mfa“ (401)', (await call('/api/assist', aal1)) === 401 && (await call('/api/mail', aal1)) === 401 && (await call('/api/isds', aal1)) === 401);
        // Relace aal2 funguje
        const good = mk(); await good.auth.setSession({ access_token: aal2, refresh_token: ver.data.refresh_token });
        r = await good.from('cases').select('id').eq('id', process.env.TEST_CASE); ok('token aal2 věci vidí', (r.data ?? []).length === 1, r.error?.message);
        const a2 = await call('/api/assist', aal2); ok('API s tokenem aal2 požadavek přijme (ne 401)', a2 !== 401, 'status ' + a2);
        // Úklid: odstranění faktoru vyžaduje aal2
        const un = await good.auth.mfa.unenroll({ factorId }); ok('faktor jde odebrat v relaci aal2', !un.error, un.error?.message); if (!un.error) factorId = null;
        const after = mk(); const s2 = await after.auth.signInWithPassword({ email: process.env.COLLEAGUE_LOGIN, password: process.env.TEST_PASSWORD });
        r = await after.from('cases').select('id').eq('id', process.env.TEST_CASE); ok('po odebrání faktoru účet opět vidí data jen s heslem', !s2.error && (r.data ?? []).length === 1);
    } finally {
        if (factorId) { try { const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }); const d = await svc.auth.admin.mfa.deleteFactor({ id: factorId, userId: uid }); console.log('  úklid: faktor odstraněn serverem' + (d.error ? ' (CHYBA: ' + d.error.message + ')' : '')); } catch (e) { console.log('  ÚKLID SELHAL, odeberte faktor ručně: ' + e.message); } }
    }
    console.log(`\nVýsledek: ${pass} PASS, ${fail} FAIL`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('Chyba testu:', e.message); process.exit(1); });
