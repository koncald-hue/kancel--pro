// Logická záloha dat Kanceláře do souborů (NDJSON po tabulkách + manifest s kontrolními součty a počty řádků).
// Čte přes klíč service role, nic v databázi nemění. Zálohu NEUKLÁDEJTE do repozitáře (složka backups/ je ignorovaná).
//   BACKUP_PASSPHRASE=<heslo> node scripts/backup-export.cjs [--dir cesta] [--files]
// S BACKUP_PASSPHRASE se každý soubor zašifruje (AES-256-GCM, klíč ze hesla přes scrypt). Bez něj je záloha čitelná, což se u dat
// klientů nedoporučuje. --files stáhne i obsah souborů z úložiště (jinak jen seznam).
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const env = {}; for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const args = process.argv.slice(2); const argv = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };

const TABLES = ['lawyer_access', 'staff', 'app_settings', 'firms', 'firm_members', 'firm_invites', 'member_keys', 'lawyer_clients', 'cases', 'case_members', 'case_folders', 'case_files', 'case_entries', 'case_deadlines', 'case_contacts', 'case_research', 'case_properties', 'case_law', 'case_data_messages', 'data_message_checks', 'client_links', 'client_requests', 'client_messages', 'client_identifications', 'signature_requests', 'lawyer_inquiries', 'inquiry_files', 'time_entries', 'price_items', 'invoices', 'invoice_lines', 'invoice_payments', 'invoice_reminders', 'bank_accounts', 'bank_transactions', 'lawyer_orders', 'isds_accounts', 'mail_accounts', 'google_connections', 'google_calendar_sync', 'calendar_feeds', 'legal_connections', 'isir_watches', 'isir_hits', 'isir_orders', 'radar_events', 'radar_snapshots', 'import_batches', 'work_activity', 'lawyer_templates', 'chat_nudges', 'firm_messages', 'firm_message_files', 'firm_shares', 'verification_docs', 'audit_log'];
const BUCKETS = ['case-files', 'inquiry-files', 'firm-shares', 'verification-docs'];
const PASS = process.env.BACKUP_PASSPHRASE || '';
const dir = path.resolve(argv('--dir') || path.join(__dirname, '..', 'backups', new Date().toISOString().replace(/[:.]/g, '-')));
fs.mkdirSync(dir, { recursive: true });

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
function seal(buf) { if (!PASS) return buf; const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12); const key = crypto.scryptSync(PASS, salt, 32); const c = crypto.createCipheriv('aes-256-gcm', key, iv); const enc = Buffer.concat([c.update(buf), c.final()]); return Buffer.concat([Buffer.from('KB1'), salt, iv, c.getAuthTag(), enc]); }

(async () => {
    const manifest = { created: new Date().toISOString(), encrypted: !!PASS, supabase: new URL(env.NEXT_PUBLIC_SUPABASE_URL).host, tables: {}, buckets: {}, users: null };
    for (const t of TABLES) {
        const lines = []; let from = 0, missing = false;
        for (;;) {
            const { data, error } = await db.from(t).select('*').range(from, from + 999);
            if (error) { missing = true; manifest.tables[t] = { error: error.message.slice(0, 80) }; break; }
            for (const row of data) lines.push(JSON.stringify(row));
            if (data.length < 1000) break; from += 1000;
        }
        if (missing) { console.log(`  přeskočeno ${t} (${manifest.tables[t].error})`); continue; }
        const body = Buffer.from(lines.join('\n') + (lines.length ? '\n' : '')); const out = seal(body); const file = `${t}.ndjson${PASS ? '.enc' : ''}`;
        fs.writeFileSync(path.join(dir, file), out); manifest.tables[t] = { file, rows: lines.length, sha256: sha(out) };
        console.log(`  ${t.padEnd(24)} ${String(lines.length).padStart(6)} řádků`);
    }
    // Uživatelé (jen id, e-mail a časy: hesla Supabase nevydává; pro zkoušku obnovy se vytvoří účty se stejným id)
    const users = []; for (let page = 1; ; page++) { const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 }); if (error || !data.users.length) break; users.push(...data.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, factors: (u.factors || []).length }))); if (data.users.length < 200) break; }
    const ub = seal(Buffer.from(JSON.stringify(users))); fs.writeFileSync(path.join(dir, `auth-users.json${PASS ? '.enc' : ''}`), ub); manifest.users = { file: `auth-users.json${PASS ? '.enc' : ''}`, count: users.length, sha256: sha(ub) };
    for (const b of BUCKETS) {
        const objs = []; const walk = async (prefix) => { for (let off = 0; ; off += 100) { const { data, error } = await db.storage.from(b).list(prefix, { limit: 100, offset: off }); if (error || !data?.length) break; for (const o of data) { if (o.id) objs.push({ name: prefix ? `${prefix}/${o.name}` : o.name, size: o.metadata?.size ?? 0 }); else await walk(prefix ? `${prefix}/${o.name}` : o.name); } if (data.length < 100) break; } };
        await walk('');
        const lb = seal(Buffer.from(JSON.stringify(objs))); const f = `bucket-${b}.json${PASS ? '.enc' : ''}`; fs.writeFileSync(path.join(dir, f), lb);
        manifest.buckets[b] = { file: f, objects: objs.length, bytes: objs.reduce((s, o) => s + Number(o.size || 0), 0), sha256: sha(lb), downloaded: 0 };
        if (args.includes('--files')) { fs.mkdirSync(path.join(dir, 'files', b), { recursive: true }); for (const o of objs) { const { data } = await db.storage.from(b).download(o.name); if (!data) continue; const dest = path.join(dir, 'files', b, o.name.replace(/[\\/]/g, '__')); fs.writeFileSync(dest + (PASS ? '.enc' : ''), seal(Buffer.from(await data.arrayBuffer()))); manifest.buckets[b].downloaded++; } }
        console.log(`  úložiště ${b}: ${objs.length} souborů`);
    }
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(`\nZáloha uložena: ${dir}\nŠifrováno: ${PASS ? 'ano' : 'NE (nastavte BACKUP_PASSPHRASE)'}`);
})().catch((e) => { console.error('Záloha selhala:', e.message); process.exit(1); });
