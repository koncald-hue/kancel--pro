// Zkušební obnova zálohy do ODDĚLENÉHO testovacího projektu Supabase (ne do ostrého). Slouží k ověření, že se záloha dá načíst
// a že data v ní jsou úplná. Nejdřív v testovacím projektu spusťte všechny SQL z supabase/MIGRACE.md.
//   BACKUP_PASSPHRASE=<heslo> TARGET_URL=<https://testovaci.supabase.co> TARGET_SERVICE_KEY=<service role testovacího projektu> \
//   node scripts/backup-restore-test.cjs <složka zálohy>
// Bezpečnost: skript odmítne cíl, který je shodný s ostrým projektem z .env.local. Uživatelské účty se vytvoří se stejným id a náhodným heslem.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const dir = process.argv[2]; const TU = process.env.TARGET_URL, TK = process.env.TARGET_SERVICE_KEY, PASS = process.env.BACKUP_PASSPHRASE || '';
if (!dir || !TU || !TK) { console.error('Chybí složka zálohy, TARGET_URL nebo TARGET_SERVICE_KEY.'); process.exit(2); }
const env = {}; for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
if (new URL(TU).host === new URL(env.NEXT_PUBLIC_SUPABASE_URL).host) { console.error('ODMÍTNUTO: cíl je ostrý projekt. Obnova se zkouší jen do testovacího.'); process.exit(3); }
const db = createClient(TU, TK, { auth: { persistSession: false } });
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
function open(buf) { if (buf.subarray(0, 3).toString() !== 'KB1') return buf; const salt = buf.subarray(3, 19), iv = buf.subarray(19, 31), tag = buf.subarray(31, 47); const d = crypto.createDecipheriv('aes-256-gcm', crypto.scryptSync(PASS, salt, 32), iv); d.setAuthTag(tag); return Buffer.concat([d.update(buf.subarray(47)), d.final()]); }
(async () => {
    const users = JSON.parse(open(fs.readFileSync(path.join(dir, manifest.users.file))).toString()); let made = 0;
    for (const u of users) { const { error } = await db.auth.admin.createUser({ id: u.id, email: u.email, password: crypto.randomBytes(24).toString('base64url'), email_confirm: true }); if (!error) made++; else if (!/already|registered/i.test(error.message)) console.log(`  účet ${u.id.slice(0, 8)}: ${error.message.slice(0, 60)}`); }
    console.log(`Účtů vytvořeno: ${made}/${users.length}`);
    let bad = 0;
    for (const [t, m] of Object.entries(manifest.tables)) {
        if (m.error || !m.rows) continue;
        const rows = open(fs.readFileSync(path.join(dir, m.file))).toString().split('\n').filter(Boolean).map((l) => JSON.parse(l));
        let done = 0; for (let i = 0; i < rows.length; i += 200) { const { error } = await db.from(t).upsert(rows.slice(i, i + 200), { onConflict: undefined, ignoreDuplicates: true }); if (error) { console.log(`  ${t}: ${error.message.slice(0, 90)}`); break; } done += Math.min(200, rows.length - i); }
        const { count } = await db.from(t).select('*', { count: 'exact', head: true });
        const ok = count >= m.rows; if (!ok) bad++;
        console.log(`  ${ok ? 'OK ' : 'CHYBA'} ${t.padEnd(24)} v záloze ${m.rows}, v testovacím projektu ${count}`);
    }
    console.log(bad ? `\nObnova je neúplná u ${bad} tabulek (často pořadí závislostí nebo chybějící migrace v testovacím projektu).` : '\nVšechny tabulky z zálohy jsou v testovacím projektu.'); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(1); });
