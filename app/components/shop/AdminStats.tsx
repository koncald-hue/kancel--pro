'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../site/AuthContext';
import { supabase } from '@/lib/supabase';
import { czk } from '@/lib/lawyer';

type Stats = {
    generated_at: string;
    users: { registered: number; new_7d: number; new_30d: number; unconfirmed: number };
    access: { trial: number; active: number; expired: number; requested: number; verified: number; pending_verification: number; rejected: number; trial_ending_7d: number };
    orders: { total: number; paid: number; pending: number; refund_due: number; revenue_total: number; revenue_7d: number; revenue_30d: number; paid_month: number; paid_half: number; paid_year: number; buyers: number; repeat_buyers: number };
    daily: { day: string; signups: number; revenue: number }[];
    firms: { total: number; active: number; seats_sold: number; members: number };
    usage: { cases: number; files: number; files_mb: number; client_links: number; lawyers_with_case: number };
};

const nf = new Intl.NumberFormat('cs-CZ');

function Tile({ label, value, note, warn }: { label: string; value: string; note?: string; warn?: boolean }) {
    return (
        <div className={`rounded-2xl border p-4 ${warn ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
            {note && <p className="mt-1 text-xs text-slate-600">{note}</p>}
        </div>
    );
}

function Bars({ data, color, label }: { data: { day: string; value: number }[]; color: string; label: (d: { day: string; value: number }) => string }) {
    const max = Math.max(1, ...data.map((d) => d.value));
    return (
        <div className="flex h-28 items-end gap-[3px]" role="img" aria-label="Graf za posledních 30 dní">
            {data.map((d) => (
                <div key={d.day} className="flex-1" title={label(d)}>
                    <div className={`w-full rounded-t ${color}`} style={{ height: `${Math.max(d.value > 0 ? 4 : 1, (d.value / max) * 100)}%`, opacity: d.value > 0 ? 1 : 0.25 }} />
                </div>
            ))}
        </div>
    );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mt-8"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">{title}</h2><div className="mt-3">{children}</div></section>
);

// Statistiky jen pro člena týmu. Data vrací databázová funkce admin_stats(), která ověřuje roli sama
// a vrací jen počty a součty (žádná jména, e-maily ani obsah spisů).
export default function AdminStats() {
    const { authReady, isStaff } = useAuth();
    const [stats, setStats] = useState<Stats | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        const { data, error: err } = await supabase.rpc('admin_stats');
        setLoading(false);
        if (err) { setError(/admin_stats|function/i.test(err.message) && /exist|find/i.test(err.message) ? 'Statistiky ještě nejsou v databázi zapnuté (chybí spuštění souboru admin-stats.sql).' : err.message); return; }
        setError('');
        setStats(data as Stats);
    };

    useEffect(() => {
        if (!authReady || !isStaff) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load();
    }, [authReady, isStaff]);

    if (!authReady) return <p className="mx-auto max-w-4xl px-4 py-12 text-sm text-slate-500" role="status">Načítám…</p>;
    if (!isStaff) return <p className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-slate-600">Tato stránka je jen pro tým.</p>;

    const days = stats?.daily ?? [];
    const conv = stats && stats.users.registered > 0 ? Math.round((stats.orders.buyers / stats.users.registered) * 100) : 0;

    return (
        <div className="mx-auto max-w-5xl px-4 py-10">
            <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-800 hover:underline"><ArrowLeft size={15} /> Správa</Link>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Statistiky</h1>
                    <p className="mt-1 text-sm text-slate-600">Jen počty a součty. Žádné údaje klientů ani obsah spisů a zpráv se tu nezobrazují.</p>
                </div>
                <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Obnovit</button>
            </div>

            {error && <p role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</p>}
            {!stats && !error && <p className="mt-6 text-sm text-slate-500" role="status">Načítám statistiky…</p>}

            {stats && (
                <>
                    <Section title="Tržby">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Tile label="Tržby celkem" value={czk(stats.orders.revenue_total)} note={`${nf.format(stats.orders.paid)} zaplacených objednávek`} />
                            <Tile label="Za 30 dní" value={czk(stats.orders.revenue_30d)} />
                            <Tile label="Za 7 dní" value={czk(stats.orders.revenue_7d)} />
                            <Tile label="K vrácení" value={nf.format(stats.orders.refund_due)} note="platby bez vyplněného profilu" warn={stats.orders.refund_due > 0} />
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Tile label="Měsíční plán" value={nf.format(stats.orders.paid_month)} note="zaplacených" />
                            <Tile label="Půlroční plán" value={nf.format(stats.orders.paid_half)} note="zaplacených" />
                            <Tile label="Roční plán" value={nf.format(stats.orders.paid_year)} note="zaplacených" />
                            <Tile label="Čekající objednávky" value={nf.format(stats.orders.pending)} note="vytvořené, nezaplacené" />
                        </div>
                        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-sm font-semibold text-slate-800">Tržby za posledních 30 dní</p>
                            <div className="mt-3"><Bars data={days.map((d) => ({ day: d.day, value: d.revenue }))} color="bg-emerald-600" label={(d) => `${new Date(d.day).toLocaleDateString('cs-CZ')}: ${czk(d.value)}`} /></div>
                        </div>
                    </Section>

                    <Section title="Uživatelé a přístup">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Tile label="Registrovaní" value={nf.format(stats.users.registered)} note={`nových: ${stats.users.new_7d} za 7 dní, ${stats.users.new_30d} za 30 dní`} />
                            <Tile label="Zkušební období" value={nf.format(stats.access.trial)} note={`${stats.access.trial_ending_7d} končí do 7 dní`} />
                            <Tile label="Předplatné aktivní" value={nf.format(stats.access.active)} />
                            <Tile label="Přístup vypršel" value={nf.format(stats.access.expired)} note="možnost obnovy" />
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Tile label="Profil vyplněn" value={nf.format(stats.access.verified)} />
                            <Tile label="Profil nevyplněn" value={nf.format(Math.max(0, stats.access.trial + stats.access.active + stats.access.expired - stats.access.verified))} warn={stats.access.trial + stats.access.active + stats.access.expired > stats.access.verified} note="nemohou používat aplikaci" />
                            <Tile label="Nepotvrzený e-mail" value={nf.format(stats.users.unconfirmed)} />
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <Tile label="Kupující" value={nf.format(stats.orders.buyers)} note={`${conv} % z registrovaných · opakovaně ${stats.orders.repeat_buyers}`} />
                            <Tile label="Žádosti o plný přístup" value={nf.format(stats.access.requested)} />
                        </div>
                        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-sm font-semibold text-slate-800">Nové registrace za posledních 30 dní</p>
                            <div className="mt-3"><Bars data={days.map((d) => ({ day: d.day, value: d.signups }))} color="bg-indigo-600" label={(d) => `${new Date(d.day).toLocaleDateString('cs-CZ')}: ${d.value}`} /></div>
                        </div>
                    </Section>

                    <Section title="Kanceláře">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Tile label="Kanceláře" value={nf.format(stats.firms.total)} note={`${stats.firms.active} s aktivním balíčkem`} />
                            <Tile label="Prodaná místa" value={nf.format(stats.firms.seats_sold)} note="v aktivních balíčcích" />
                            <Tile label="Přijatí členové" value={nf.format(stats.firms.members)} note="bez vedoucích" />
                        </div>
                    </Section>

                    <Section title="Využití aplikace">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Tile label="Věci celkem" value={nf.format(stats.usage.cases)} note={`u ${stats.usage.lawyers_with_case} uživatelů`} />
                            <Tile label="Soubory" value={nf.format(stats.usage.files)} note={`${nf.format(stats.usage.files_mb)} MB celkem`} />
                            <Tile label="Aktivní klientské odkazy" value={nf.format(stats.usage.client_links)} />
                            <Tile label="Aktualizováno" value={new Date(stats.generated_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })} />
                        </div>
                    </Section>
                </>
            )}
        </div>
    );
}
