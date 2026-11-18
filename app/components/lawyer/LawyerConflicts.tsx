'use client';

import { useState } from 'react';
import { Scale } from 'lucide-react';
import { inputCls } from '../situation/caseUi';
import ConflictPanel from './ConflictPanel';

// Samostatná kontrola střetu zájmů před převzetím věci nebo poptávky
export default function LawyerConflicts() {
    const [name, setName] = useState(''); const [ico, setIco] = useState(''); const [email, setEmail] = useState('');
    const [role, setRole] = useState<'klient' | 'protistrana'>('klient');
    return (
        <div className="max-w-3xl space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Scale size={18} className="text-indigo-700" aria-hidden="true" /> Kontrola střetu zájmů</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Než převezmete věc, zjistěte, jestli osobu nebo firmu už neznáte jako klienta či protistranu. Porovná se jméno (včetně jiného pořadí a skloňování), IČO a e-mail s vašimi klienty, protistranami a věcmi i s evidencí kolegů v kanceláři.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jméno nebo firma" aria-label="Jméno nebo firma" className={`${inputCls} sm:col-span-2`} maxLength={200} />
                    <input value={ico} onChange={(e) => setIco(e.target.value)} placeholder="IČO (nepovinné)" aria-label="IČO" className={inputCls} maxLength={12} />
                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail (nepovinné)" aria-label="E-mail" className={inputCls} maxLength={200} />
                    <div className="flex gap-1 rounded-lg bg-slate-100 p-1 sm:col-span-2" role="tablist" aria-label="Role nové strany">
                        {([['klient', 'Chce být naším klientem'], ['protistrana', 'Je protistranou nového klienta']] as const).map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={role === id} onClick={() => setRole(id)} className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer ${role === id ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'}`}>{l}</button>)}
                    </div>
                </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5"><ConflictPanel parties={[{ name, ico, email }]} role={role} />
                {!name.trim() && !ico.trim() && <p className="text-sm text-slate-500">Zadejte jméno nebo IČO.</p>}</section>
        </div>
    );
}
