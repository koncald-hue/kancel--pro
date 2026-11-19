import Link from 'next/link';
import { Calculator, Clock3, FileArchive, Landmark, LayoutDashboard, Receipt, Tags, TrendingUp, Vault } from 'lucide-react';

export type MoneySection = 'penize' | 'vedeni' | 'vykazy' | 'faktury' | 'platby' | 'export' | 'cenik' | 'kalkulacky' | 'uschovy';
const TABS = [
    ['penize', '/kancelar/penize', 'Přehled', LayoutDashboard],
    ['vedeni', '/kancelar/vedeni', 'Pro vedení', TrendingUp],
    ['vykazy', '/kancelar/vykazy', 'Výkazy práce', Clock3],
    ['faktury', '/kancelar/faktury', 'Fakturace', Receipt],
    ['platby', '/kancelar/platby', 'Platby', Landmark],
    ['uschovy', '/kancelar/uschovy', 'Úschovy', Vault],
    ['export', '/kancelar/export', 'Export pro účetní', FileArchive],
    ['cenik', '/kancelar/cenik', 'Ceník', Tags],
    ['kalkulacky', '/kancelar/kalkulacky', 'Kalkulačky', Calculator],
] as const;

// Společná lišta pro peníze: výkazy práce, fakturace, ceník a kalkulačky jsou na jednom místě
export default function MoneyTabs({ current }: { current: MoneySection }) {
    return (
        <nav className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" aria-label="Peníze">
            {TABS.map(([id, href, label, Icon]) => (
                <Link key={id} href={href} aria-current={current === id ? 'page' : undefined} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold sm:px-3.5 sm:text-sm ${current === id ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}><Icon size={15} aria-hidden="true" /> {label}</Link>
            ))}
        </nav>
    );
}
