// Ověří zálohu z backup-export.cjs: kontrolní součty souborů, dešifrování, počet řádků proti manifestu a (volitelně) proti živé databázi.
//   BACKUP_PASSPHRASE=<heslo> node scripts/backup-verify.cjs <složka zálohy> [--live]
// Návratový kód 0 = záloha je celistvá. Rozdíl proti živé databázi je jen informace (data mezitím vznikla).
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const dir = process.argv[2]; if (!dir) { console.error('Zadejte složku zálohy.'); process.exit(2); }
const PASS = process.env.BACKUP_PASSPHRASE || '';
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
function open(buf) { if (buf.subarray(0, 3).toString() !== 'KB1') return buf; if (!PASS) throw new Error('Záloha je šifrovaná, chybí BACKUP_PASSPHRASE.'); const salt = buf.subarray(3, 19), iv = buf.subarray(19, 31), tag = buf.subarray(31, 47); const d = crypto.createDecipheriv('aes-256-gcm', crypto.scryptSync(PASS, salt, 32), iv); d.setAuthTag(tag); return Buffer.concat([d.update(buf.subarray(47)), d.final()]); }
let bad = 0; const fail = (m) => { bad++; console.log('  CHYBA ' + m); };
(async () => {
    for (const [t, m] of Object.entries(manifest.tables)) {
        if (m.error) { console.log(`  přeskočeno v záloze: ${t}`); continue; }
        const raw = fs.readFileSync(path.join(dir, m.file));
        if (sha(raw) !== m.sha256) { fail(`${t}: kontrolní součet nesouhlasí (soubor poškozen nebo změněn)`); continue; }
        let text; try { text = open(raw).toString('utf8'); } catch (e) { fail(`${t}: nelze dešifrovat (${e.message})`); continue; }
        const rows = text.split('\n').filter(Boolean); let parsed = 0; for (const l of rows) { try { JSON.parse(l); parsed++; } catch { /* */ } }
        if (rows.length !== m.rows || parsed !== m.rows) fail(`${t}: řádků ${rows.length}/${parsed} místo ${m.rows}`); else console.log(`  OK ${t.padEnd(24)} ${m.rows} řádků`);
    }
    for (const [k, m] of Object.entries({ users: manifest.users, ...Object.fromEntries(Object.entries(manifest.buckets).map(([b, v]) => ['bucket ' + b, v])) })) { if (!m) continue; const raw = fs.readFileSync(path.join(dir, m.file)); if (sha(raw) !== m.sha256) fail(`${k}: kontrolní součet nesouhlasí`); else { try { open(raw); console.log(`  OK ${k}`); } catch (e) { fail(`${k}: ${e.message}`); } } }
    if (process.argv.includes('--live')) {
        const { createClient } = require('@supabase/supabase-js'); const env = {}; for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
        const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
        for (const [t, m] of Object.entries(manifest.tables)) { if (m.error) continue; const { count } = await db.from(t).select('*', { count: 'exact', head: true }); if (count !== m.rows) console.log(`  rozdíl proti živé databázi: ${t} záloha ${m.rows}, nyní ${count}`); }
    }
    console.log(bad ? `\nZáloha NENÍ celistvá (${bad} chyb).` : '\nZáloha je celistvá: součty, dešifrování i počty řádků sedí.'); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(1); });
