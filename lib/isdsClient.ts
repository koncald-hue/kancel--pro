import { supabase } from './supabase';

export type ApiRes = { ok: boolean; status: number; json: Record<string, unknown> };

// Volání našeho serverového mostu k datovým schránkám (přihlášený uživatel)
export async function isdsApi(body: Record<string, unknown>): Promise<ApiRes> {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/isds', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify(body) });
    return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) as Record<string, unknown> };
}
