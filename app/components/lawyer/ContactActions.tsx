'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Copy, Mail, MessageCircle, MessageSquareText, Phone, Send } from 'lucide-react';
import { isEmail, mailtoHref, prettyPhone, smsHref, telHref, whatsappHref } from '@/lib/contactLinks';

type Action = { label: string; icon: typeof Mail; href?: string; external?: boolean; onClick?: () => void };

function Menu({ label, title, actions }: { label: string; title: string; actions: Action[] }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        if (!open) return;
        const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
    }, [open]);
    return (
        <span ref={ref} className="relative inline-block">
            <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} title={title} className="rounded-md px-1 text-left text-indigo-800 underline decoration-indigo-200 underline-offset-2 hover:decoration-indigo-600 cursor-pointer">{label}</button>
            {open && (
                <span role="menu" className="absolute left-0 top-full z-30 mt-1 block min-w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                    {actions.map((a) => {
                        const cls = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-indigo-50 cursor-pointer';
                        const body = <><a.icon size={15} className="shrink-0 text-indigo-700" aria-hidden="true" />{a.label}</>;
                        if (a.href && !a.external && a.href.startsWith('/')) return <Link key={a.label} role="menuitem" href={a.href} onClick={() => setOpen(false)} className={cls}>{body}</Link>;
                        if (a.href) return <a key={a.label} role="menuitem" href={a.href} onClick={() => setOpen(false)} target={a.external ? '_blank' : undefined} rel={a.external ? 'noopener noreferrer' : undefined} className={cls}>{body}</a>;
                        return <button key={a.label} type="button" role="menuitem" onClick={() => { a.onClick?.(); setOpen(false); }} className={cls}>{body}</button>;
                    })}
                </span>
            )}
        </span>
    );
}

// E-mail a telefon klienta jako nabídka akcí: napsat z Kanceláře nebo z vlastního programu, zavolat, SMS, WhatsApp, zkopírovat
export default function ContactActions({ email, phone, subject = '' }: { email?: string; phone?: string; subject?: string }) {
    const [copied, setCopied] = useState('');
    const copy = (v: string) => { void navigator.clipboard?.writeText(v); setCopied(v); window.setTimeout(() => setCopied(''), 1400); };
    const mail = (email ?? '').trim(); const tel = (phone ?? '').trim();
    const parts: React.ReactNode[] = [];
    if (mail && isEmail(mail)) {
        parts.push(<Menu key="m" label={mail} title="Možnosti e-mailu" actions={[
            { label: 'Napsat e-mail z Kanceláře', icon: Send, href: `/kancelar/email?to=${encodeURIComponent(mail)}${subject ? `&subject=${encodeURIComponent(subject)}` : ''}` },
            { label: 'Otevřít v poštovním programu', icon: Mail, href: mailtoHref(mail, subject) ?? undefined },
            { label: copied === mail ? 'Zkopírováno' : 'Zkopírovat adresu', icon: Copy, onClick: () => copy(mail) },
        ]} />);
    } else if (mail) parts.push(<span key="m">{mail}</span>);
    const t = telHref(tel);
    if (tel && t) {
        parts.push(<Menu key="p" label={prettyPhone(tel)} title="Možnosti telefonu" actions={[
            { label: 'Zavolat', icon: Phone, href: t },
            { label: 'Poslat SMS', icon: MessageSquareText, href: smsHref(tel) ?? undefined },
            { label: 'Napsat přes WhatsApp', icon: MessageCircle, href: whatsappHref(tel) ?? undefined, external: true },
            { label: copied === tel ? 'Zkopírováno' : 'Zkopírovat číslo', icon: Copy, onClick: () => copy(tel) },
        ]} />);
    } else if (tel) parts.push(<span key="p">{tel}</span>);
    if (!parts.length) return <span>–</span>;
    return <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">{parts.flatMap((p, i) => (i ? [<span key={`s${i}`} className="text-slate-300">·</span>, p] : [p]))}</span>;
}
