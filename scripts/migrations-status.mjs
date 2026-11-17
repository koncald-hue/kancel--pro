// Ukáže, které migrace ze supabase/migrations už v databázi běžely. Databázi jen čte (tabulka schema_migrations).
// Spuštění: node scripts/migrations-status.mjs   (čte NEXT_PUBLIC_SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY z .env.local)
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const env = {};
try {
    for (const line of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
} catch { /* bez .env.local se použijí proměnné prostředí */ }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const files = readdirSync(join(root, 'supabase/migrations')).filter((f) => /^\d{8}_\d{2}_.+\.sql$/.test(f)).sort();

if (!url || !key) { console.error('Chybí NEXT_PUBLIC_SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY.'); process.exit(2); }
const res = await fetch(`${url}/rest/v1/schema_migrations?select=name,applied_at&order=name`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
let applied = new Map();
if (res.ok) applied = new Map((await res.json()).map((r) => [r.name, r.applied_at]));
else if (res.status === 404 || res.status === 400) console.log('Tabulka schema_migrations zatím neexistuje (neběžela žádná migrace ze složky migrations).');
else { console.error(`Databáze odpověděla ${res.status}.`); process.exit(2); }

let pending = 0;
for (const f of files) {
    const name = f.replace(/\.sql$/, '');
    const at = applied.get(name);
    if (at) console.log(`✓ ${f}  (${new Date(at).toLocaleString('cs-CZ')})`);
    else { pending += 1; console.log(`✗ ${f}  ČEKÁ NA SPUŠTĚNÍ`); }
}
console.log(pending ? `\nNespuštěno: ${pending}. Spouštějte podle názvu vzestupně (viz supabase/MIGRACE.md).` : '\nVšechny migrace ze složky migrations běžely.');
process.exit(pending ? 1 : 0);
