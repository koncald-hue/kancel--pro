'use client';

import { useEffect, useState } from 'react';
import { qrSvg, spayd, formatIban, toIban } from '@/lib/qrPayment';

// Náhled QR platby k vyúčtování (zbývající částka, variabilní symbol = číslice čísla faktury)
export default function InvoiceQr({ account, amount, currency, number, due, name }: { account: string; amount: number; currency: 'CZK' | 'EUR'; number: string | null; due: string | null; name: string }) {
    const [svg, setSvg] = useState('');
    const iban = toIban(account);
    const payload = iban && amount > 0 ? spayd({ iban, amount, currency, vs: number ?? '', message: number ? `Faktura ${number}` : '', due: due ?? undefined, name }) : null;
    useEffect(() => {
        let alive = true;
        if (!payload) { Promise.resolve().then(() => { if (alive) setSvg(''); }); return () => { alive = false; }; }
        qrSvg(payload, 120).then((s) => { if (alive) setSvg(s); }).catch(() => { if (alive) setSvg(''); });
        return () => { alive = false; };
    }, [payload]);
    if (!account.trim()) return <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-950">Na faktuře nebude QR platba, protože v Nastavení chybí číslo účtu.</p>;
    if (!iban) return <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-950">Číslo účtu v Nastavení nemá platný tvar, QR platba se na faktuře nezobrazí. Zadejte ho jako 123456789/0100 nebo jako IBAN.</p>;
    if (!payload || !svg) return null;
    return (
        <div className="mt-3 flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="h-[120px] w-[120px] shrink-0 bg-white" dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR platba" role="img" />
            <p className="text-xs leading-relaxed text-slate-600"><strong className="text-slate-900">QR platba</strong> (vytiskne se na faktuře)<br />Účet {formatIban(iban)}<br />Variabilní symbol {number ? number.replace(/\D/g, '') : 'doplní se po vystavení'}</p>
        </div>
    );
}
