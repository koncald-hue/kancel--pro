import { supabase } from './supabase';

// Spustí platbu objednávky u Comgate. Vrací true, pokud prohlížeč přesměrovala na platební bránu.
export async function startComgatePayment(orderId: string, autoRenew = false): Promise<{ redirected: boolean; error?: string }> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { redirected: false, error: 'Přihlášení vypršelo, přihlaste se znovu.' };
    const res = await fetch('/api/payments/comgate/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ orderId, autoRenew }) }).catch(() => null);
    if (res?.ok) { const j = await res.json().catch(() => null) as { redirect?: string } | null; if (j?.redirect) { window.location.href = j.redirect; return { redirected: true }; } }
    if (res?.status === 503) return { redirected: false };
    return { redirected: false, error: 'Platební bránu se nepodařilo spustit. Objednávka je vytvořena, zkuste to za chvíli znovu.' };
}
