'use client';

import { Library } from 'lucide-react';

// Knihovna šablon a judikatury: bude mít vlastní databázi přímo v této aplikaci
export default function LawyerLibrary() {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <Library size={28} className="mx-auto text-indigo-700" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-bold text-slate-900">Knihovna se připravuje</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">Tady budou šablony podání a smluv, judikatura a vzory pro práci se spisem. Zatím je knihovna prázdná.</p>
        </div>
    );
}
