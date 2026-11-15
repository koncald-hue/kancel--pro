import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { UPGRADE_HREF } from '@/lib/tiers';

// Nenápadná nabídka balíčku pro advokáty tam, kde bezplatný účet narazí na limit
export default function UpgradeNote({ children }: { children: React.ReactNode }) {
    return (
        <p className="flex items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs leading-relaxed text-slate-700">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-indigo-800" aria-hidden="true" />
            <span>{children} <Link href={UPGRADE_HREF} className="font-semibold text-indigo-900 underline">Balíček pro advokáty</Link></span>
        </p>
    );
}
