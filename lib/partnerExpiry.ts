import type { SupabaseClient } from '@supabase/supabase-js';
import { PARTNER_REPLY_DAYS, decisionMail } from './directory';
import { sendMail } from './mail';

// Poptávky ze Studuj právo, na které advokát do 5 dnů nereagoval: označí se jako vypršelé a zájemce dostane
// e-mail s odkazem na další advokáty, aby nezůstal bez pomoci. Volá se jednou denně z plánovače.
export async function expirePartnerInquiries(db: SupabaseClient, now = new Date()): Promise<number> {
    const before = new Date(now.getTime() - PARTNER_REPLY_DAYS * 86_400_000).toISOString();
    const { data, error } = await db.from('lawyer_inquiries').select('id, user_id, name, email, area, region')
        .eq('source', 'studujpravo').eq('status', 'new').lt('created_at', before).limit(200);
    if (error || !data?.length) return 0;
    let done = 0;
    for (const q of data as { id: string; user_id: string; name: string; email: string; area: string | null; region: string | null }[]) {
        const { data: changed } = await db.from('lawyer_inquiries').update({ status: 'expired', decided_at: now.toISOString() }).eq('id', q.id).eq('status', 'new').select('id');
        if (!changed?.length) continue;
        done++;
        if (!q.email) continue;
        const { data: me } = await db.from('lawyer_access').select('display_name, register_name').eq('user_id', q.user_id).maybeSingle();
        const catalog = `${process.env.STUDUJPRAVO_URL || 'https://studujpravo.cz'}/advokati?${new URLSearchParams({ ...(q.area ? { obor: q.area } : {}), ...(q.region ? { kraj: q.region } : {}) })}`;
        const m = decisionMail('expired', { clientName: q.name, lawyerName: String(me?.display_name || me?.register_name || 'advokát'), lawyerEmail: '', lawyerPhone: '', catalogUrl: catalog });
        await sendMail(q.email, m.subject, m.text).catch(() => undefined);
    }
    return done;
}
