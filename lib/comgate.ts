// Komunikace s platební bránou Comgate (protokol v1.0, odpovědi ve formátu application/x-www-form-urlencoded).
// Údaje obchodníka: COMGATE_MERCHANT (ID obchodu) a COMGATE_SECRET (heslo pro API), COMGATE_TEST=true pro testovací platby.
const BASE = 'https://payments.comgate.cz/v1.0';

export type ComgateConfig = { merchant: string; secret: string; test: boolean };

export function comgateConfig(): ComgateConfig | null {
    const merchant = process.env.COMGATE_MERCHANT;
    const secret = process.env.COMGATE_SECRET;
    if (!merchant || !secret) return null;
    return { merchant, secret, test: process.env.COMGATE_TEST === 'true' };
}

async function call(path: string, params: Record<string, string>): Promise<Record<string, string> | null> {
    try {
        const res = await fetch(`${BASE}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params), signal: AbortSignal.timeout(15_000), cache: 'no-store' });
        if (!res.ok) return null;
        return Object.fromEntries(new URLSearchParams(await res.text()));
    } catch { return null; }
}

// Částka se Comgate posílá v haléřích.
export const toMinor = (czk: number) => String(Math.round(czk * 100));

export async function createPayment(cfg: ComgateConfig, o: { orderId: string; priceCzk: number; label: string; email: string }): Promise<{ transId: string; redirect: string } | null> {
    const r = await call('create', {
        merchant: cfg.merchant, secret: cfg.secret, test: String(cfg.test), price: toMinor(o.priceCzk), curr: 'CZK',
        label: o.label.slice(0, 16), refId: o.orderId, email: o.email, country: 'CZ', lang: 'cs', method: 'ALL', prepareOnly: 'true', preauth: 'false',
    });
    if (!r || r.code !== '0' || !r.transId || !r.redirect) return null;
    return { transId: r.transId, redirect: r.redirect };
}

export type ComgateStatus = { status: string; refId: string; price: string; curr: string; test: boolean };

// Stav platby se vždy zjišťuje přímo u Comgate (oznámení od brány samo o sobě nic neprokazuje).
export async function getStatus(cfg: ComgateConfig, transId: string): Promise<ComgateStatus | null> {
    const r = await call('status', { merchant: cfg.merchant, secret: cfg.secret, transId });
    if (!r || r.code !== '0') return null;
    return { status: r.status ?? '', refId: r.refId ?? '', price: r.price ?? '', curr: r.curr ?? '', test: r.test === 'true' };
}

// Zaplacená objednávka se uplatní jen když stav je PAID, odkazuje na naši objednávku, sedí částka a měna a režim (test × ostrý).
export function isPaidFor(cfg: ComgateConfig, st: ComgateStatus, orderId: string, priceCzk: number): boolean {
    return st.status === 'PAID' && st.refId === orderId && st.curr === 'CZK' && st.price === toMinor(priceCzk) && st.test === cfg.test;
}
