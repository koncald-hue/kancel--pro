import { supabase } from './supabase';

// Sdílení věci mezi advokáty jedné kanceláře (viz supabase/sdilene-veci.sql)
export type ShareRole = 'editor' | 'viewer';
export type ShareRow = { user_id: string; name: string; email: string; role: 'owner' | ShareRole; is_owner: boolean };
export const ROLE_LABEL: Record<'owner' | ShareRole, string> = { owner: 'Vlastník', editor: 'Editor (čte a upravuje)', viewer: 'Čtenář (jen čte)' };

const setup = (m: string) => (/case_members|case_share_info|schema cache|find the function|does not exist/i.test(m) ? 'Sdílení spisů zatím není v databázi zapnuté (chybí spuštění souboru sdilene-veci.sql).' : m);

export async function loadShare(caseId: string): Promise<ShareRow[]> {
    const { data, error } = await supabase.rpc('case_share_info', { p_case: caseId });
    if (error) throw new Error(setup(error.message));
    return (data ?? []) as ShareRow[];
}
export async function addMember(caseId: string, userId: string, memberId: string, role: ShareRole, wrappedKey: string | null) {
    const { error } = await supabase.from('case_members').insert({ case_id: caseId, user_id: memberId, role, wrapped_key: wrappedKey, added_by: userId });
    if (error) throw new Error(setup(error.message));
}
export async function updateMember(caseId: string, memberId: string, patch: { role?: ShareRole; wrapped_key?: string | null }) {
    const { error } = await supabase.from('case_members').update(patch).eq('case_id', caseId).eq('user_id', memberId);
    if (error) throw new Error(setup(error.message));
}
export async function removeMember(caseId: string, memberId: string) {
    const { error } = await supabase.from('case_members').delete().eq('case_id', caseId).eq('user_id', memberId);
    if (error) throw new Error(setup(error.message));
}
