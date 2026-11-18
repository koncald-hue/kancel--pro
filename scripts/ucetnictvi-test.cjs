// Živý test účetnictví provozovatele (migrace 20261118_20):
//   A_LOGIN=<účet> TEST_PASSWORD=<heslo> N_USER=<uuid zákazníka pro zkušební objednávky> node scripts/ucetnictvi-test.cjs
// Automatické faktury se ověří vždy (objednávky zakládá služební klíč). Když A NENÍ v týmu, ověří se, že nic z účetnictví
// nevidí ani nezmění; když v týmu JE, ověří se i ruční faktura, dobropis, výdaje a záznam správce.
// Objednávky a faktury připraví a nakonec smaže služební klíč.
const fs = require('fs'); const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const env = {}; for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const miss = ['A_LOGIN', 'TEST_PASSWORD', 'N_USER'].filter((k) => !process.env[k]); if (miss.length) { console.error('Chybí proměnné: ' + miss.join(', ')); process.exit(2); }
const mk = (k = env.NEXT_PUBLIC_SUPABASE_ANON_KEY) => createClient(env.NEXT_PUBLIC_SUPABASE_URL, k, { auth: { persistSession: false, autoRefreshToken: false } });
const svc = mk(env.SUPABASE_SERVICE_ROLE_KEY), A = mk(), anon = mk(); let p = 0, f = 0;
const ok = (n, c, d = '') => { c ? p++ : f++; console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const T = 'UCTO-TEST';
(async () => {
  const a = await A.auth.signInWithPassword({ email: process.env.A_LOGIN, password: process.env.TEST_PASSWORD });
  if (a.error) { console.error('Přihlášení selhalo.'); process.exit(1); }
  const staff = (await A.rpc('is_staff')).data === true;
  console.log(staff ? '  (A je v týmu: test správy)' : '  (A není v týmu: test, že účetnictví nevidí)');
  const created = { orders: [], isir: [], inv: [], exp: [] };
  const origSettings = (await svc.from('ops_settings').select('*').eq('id', 1).single()).data;
  try {
    let r = await A.from('ops_settings').select('*').eq('id', 1); ok(staff ? 'tým vidí nastavení provozovatele' : 'běžný uživatel nastavení nevidí', staff ? (r.data || []).length === 1 : !(r.data || []).length);
    r = await anon.from('ops_settings').select('*'); ok('nepřihlášený nastavení nevidí', !(r.data || []).length);
    r = await anon.from('ops_invoices').select('id'); ok('nepřihlášený faktury nevidí', !(r.data || []).length);
    await svc.from('ops_settings').update({ name: `${T} provozovatel`, ico: '12345678', vat_payer: true, vat_rate: 21, prefix: 'KT' }).eq('id', 1);

    // Zaplacená objednávka předplatného vystaví fakturu
    const o = (await svc.from('lawyer_orders').insert({ user_id: process.env.N_USER, plan: 'month', price_czk: 1210, status: 'pending' }).select('id').single()).data; created.orders.push(o.id);
    r = await svc.from('ops_invoices').select('id').eq('source_ref', o.id); ok('nezaplacená objednávka fakturu nemá', !(r.data || []).length);
    await svc.from('lawyer_orders').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', o.id);
    r = await svc.from('ops_invoices').select('*').eq('source', 'predplatne').eq('source_ref', o.id); const inv = r.data?.[0]; if (inv) created.inv.push(inv.id);
    ok('po zaplacení vznikla faktura', !!inv, r.error?.message);
    ok('faktura má číslo z řady s předponou', !!inv && /^KT\d{4}\d{4}$/.test(inv.number), inv?.number);
    ok('DPH vypočtené shora (1210 = 1000 + 210)', !!inv && Number(inv.base) === 1000 && Number(inv.vat) === 210 && Number(inv.vat_rate) === 21, inv && `${inv.base}+${inv.vat}`);
    ok('snímek dodavatele z nastavení', inv?.supplier?.name === `${T} provozovatel` && inv?.supplier?.ico === '12345678');
    await svc.from('lawyer_orders').update({ status: 'refund_due' }).eq('id', o.id); await svc.from('lawyer_orders').update({ status: 'paid' }).eq('id', o.id);
    r = await svc.from('ops_invoices').select('id').eq('source_ref', o.id); ok('opakované „zaplaceno“ druhou fakturu nevystaví', (r.data || []).length === 1);

    // Hlídání insolvence
    const io = (await svc.from('isir_orders').insert({ user_id: process.env.N_USER, plan: 'year', price_czk: 2420, status: 'paid', paid_at: new Date().toISOString() }).select('id').single()).data; created.isir.push(io.id);
    r = await svc.from('ops_invoices').select('id, number, seq').eq('source', 'insolvence').eq('source_ref', io.id); if (r.data?.[0]) created.inv.push(r.data[0].id);
    ok('zaplacené hlídání insolvence má fakturu s dalším číslem', (r.data || []).length === 1 && r.data[0].seq === inv.seq + 1, r.data?.[0]?.number);

    if (!staff) {
      r = await A.from('ops_invoices').select('id').eq('id', inv.id); ok('běžný uživatel faktury nevidí', !(r.data || []).length);
      r = await A.rpc('ops_manual_invoice', { p_desc: `${T} cizí`, p_total: 5, p_paid: null, p_buyer: { name: 'X' }, p_note: '' }); ok('běžný uživatel ruční fakturu nevystaví', !!r.error);
      r = await A.rpc('ops_credit_note', { p_invoice: inv.id, p_reason: `${T} cizí` }); ok('běžný uživatel dobropis nevystaví', !!r.error);
      r = await A.rpc('ops_backfill'); ok('běžný uživatel doplnění nespustí', !!r.error);
      r = await A.from('ops_expenses').insert({ spent_on: '2026-11-01', description: `${T} cizí`, total: 1 }); ok('běžný uživatel výdaj nezapíše', !!r.error);
      r = await A.from('ops_log').insert({ staff_id: a.data.user.id, action: `${T}` }); ok('běžný uživatel do záznamu správce nezapíše', !!r.error);
      r = await A.from('ops_settings').update({ name: 'hack' }).eq('id', 1).select('id'); ok('běžný uživatel nastavení nezmění', !(r.data || []).length);
    } else {
    // Ruční faktura, dobropis, pravidla
      r = await A.rpc('ops_manual_invoice', { p_desc: `${T} ruční`, p_total: 500, p_paid: null, p_buyer: { name: 'Klient s.r.o.' }, p_note: '' }); ok('ruční faktura', !r.error, r.error?.message); if (r.data) created.inv.push(r.data);
      r = await A.rpc('ops_manual_invoice', { p_desc: `${T} špatná`, p_total: -5, p_paid: null, p_buyer: { name: 'X' }, p_note: '' }); ok('ruční faktura se zápornou částkou nejde', !!r.error);
      r = await A.rpc('ops_manual_invoice', { p_desc: `${T} bez odběratele`, p_total: 5, p_paid: null, p_buyer: {}, p_note: '' }); ok('ruční faktura bez odběratele nejde', !!r.error);
      r = await A.rpc('ops_credit_note', { p_invoice: inv.id, p_reason: '' }); ok('dobropis bez důvodu nejde', !!r.error);
      r = await A.rpc('ops_credit_note', { p_invoice: inv.id, p_reason: `${T} vrácení` }); ok('dobropis s důvodem', !r.error, r.error?.message); if (r.data) created.inv.push(r.data);
      const cn = (await svc.from('ops_invoices').select('total, credit_for').eq('id', r.data).single()).data; ok('dobropis je záporný a odkazuje na fakturu', Number(cn?.total) === -1210 && cn?.credit_for === inv.id);
      r = await A.rpc('ops_credit_note', { p_invoice: inv.id, p_reason: `${T} znovu` }); ok('druhý dobropis ke stejné faktuře nejde', !!r.error);
      r = await A.from('ops_invoices').update({ total: 1 }).eq('id', inv.id).select('id'); ok('fakturu nejde upravit', !!r.error || !(r.data || []).length);
      r = await A.from('ops_invoices').delete().eq('id', inv.id).select('id'); ok('fakturu nejde smazat', !!r.error || !(r.data || []).length);
      r = await A.from('ops_invoices').insert({ number: 'X1', year: 2026, seq: 99999, source: 'rucne', issue_date: '2026-01-01', description: 'x', total: 1, base: 1 }); ok('fakturu nejde vložit mimo funkce', !!r.error);

      // Výdaje a záznam
      r = await A.from('ops_expenses').insert({ spent_on: '2026-11-01', description: `${T} hosting`, category: 'hosting', total: 605, vat: 105 }).select('id').single(); ok('výdaj', !r.error, r.error?.message); if (r.data) created.exp.push(r.data.id);
      r = await A.from('ops_expenses').insert({ spent_on: '2026-11-01', description: `${T} špatný`, total: -1 }); ok('záporný výdaj nejde', !!r.error);
      r = await A.from('ops_log').select('action').in('action', ['ruční faktura', 'dobropis']).order('created_at', { ascending: false }).limit(5); ok('ruční faktura i dobropis jsou v záznamu správce', (r.data || []).some((x) => x.action === 'dobropis') && (r.data || []).some((x) => x.action === 'ruční faktura'));
      r = await A.from('ops_log').update({ detail: 'x' }).eq('action', 'dobropis').select('id'); ok('záznam správce nejde měnit', !(r.data || []).length);
      r = await A.rpc('ops_backfill'); ok('doplnění faktur běží a nevystaví duplicity', !r.error, `doplněno ${r.data}`);
    }
  } finally {
    await svc.from('ops_invoices').delete().in('id', created.inv.filter(Boolean).reverse());
    await svc.from('ops_invoices').delete().like('description', `${T}%`);
    await svc.from('ops_invoices').delete().like('supplier->>name', `${T}%`);
    await svc.from('lawyer_orders').delete().in('id', created.orders); await svc.from('isir_orders').delete().in('id', created.isir);
    await svc.from('ops_expenses').delete().like('description', `${T}%`);
    await svc.from('ops_log').delete().or(`detail.like.${T}%,target.like.${T}%`);
    if (origSettings) await svc.from('ops_settings').update(origSettings).eq('id', 1);
    const left = (await svc.from('ops_invoices').select('id', { count: 'exact', head: true }).or(`description.like.${T}%,supplier->>name.like.${T}%`)).count;
    console.log(`\nVýsledek: ${p} PASS, ${f} FAIL; úklid: zbylé testovací faktury ${left}`); process.exit(f ? 1 : 0);
  }
})().catch((e) => { console.error('Chyba:', e.message); process.exit(1); });
