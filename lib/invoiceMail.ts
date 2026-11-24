import { serviceClient } from './serverSupabase';
import { mailConfigured, sendMail } from './mail';
import { invoiceHtml, type OpsInvoice } from './opsBooks';

// Po zaplacení pošle zákazníkovi fakturu (vystavil ji trigger v databázi) jako přílohu. Chyba e-mailu platbu nikdy nezruší.
export async function sendInvoiceForOrder(orderId: string, source: 'predplatne' | 'insolvence'): Promise<boolean> {
    try {
        if (!mailConfigured()) return false;
        const db = serviceClient();
        if (!db) return false;
        const { data: inv } = await db.from('ops_invoices').select('*').eq('source', source).eq('source_ref', orderId).maybeSingle();
        if (!inv || !inv.user_id) return false;
        const to = (await db.auth.admin.getUserById(String(inv.user_id))).data.user?.email;
        if (!to) return false;
        const i = inv as OpsInvoice;
        const text = [`Děkujeme za platbu. Faktura č. ${i.number} (${i.description}) je v příloze a najdete ji také v aplikaci v Nastavení, sekce Faktury.`, '', 'Kancelář Pro'].join('\n');
        await sendMail(to, `Faktura č. ${i.number} – Kancelář Pro`, text, fetch, [{ name: `faktura-${i.number}.html`, content: invoiceHtml(i) }]);
        return true;
    } catch (e) { console.warn('[faktura-mail]', (e as Error).message); return false; }
}
