import type { Metadata } from 'next';
import { Scale } from 'lucide-react';
import { OFFLINE_KEY } from '@/lib/offlineDeadlines';

export const metadata: Metadata = { title: 'Jste offline | Kancelář', robots: { index: false } };

// Zobrazí se, když zařízení nemá připojení. Stránka musí fungovat bez dalších souborů, proto lhůty (pokud je uživatel povolil v Nastavení)
// vykreslí malý vložený skript z úložiště prohlížeče. Text se vkládá přes textContent, takže se z uložených dat nikdy nespustí HTML.
const SCRIPT = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(OFFLINE_KEY)});if(!raw)return;var d=JSON.parse(raw);if(!d||!Array.isArray(d.items))return;
var root=document.getElementById('offline-root');var box=document.createElement('section');box.className='mt-6 w-full rounded-2xl border border-slate-200 bg-white p-4 text-left';
var h=document.createElement('h2');h.className='text-sm font-bold text-slate-900';h.textContent='Vaše lhůty na nejbližších 14 dní';box.appendChild(h);
var head=document.createElement('p');head.className='mt-0.5 text-xs text-slate-500';var t=new Date(d.savedAt);head.textContent='Stav z '+t.toLocaleDateString('cs-CZ')+' '+t.toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'})+'. Po obnovení připojení se aktualizuje.';box.appendChild(head);
var list=document.createElement('ul');list.className='mt-2 divide-y divide-slate-100 text-sm text-slate-800';box.appendChild(list);
if(!d.items.length){var e=document.createElement('li');e.className='py-2';e.textContent='V příštích dnech nejsou uložené žádné lhůty.';list.appendChild(e)}
d.items.forEach(function(i){var li=document.createElement('li');li.className='py-2';var a=document.createElement('strong');var p=String(i.due).split('-');a.textContent=Number(p[2])+'. '+Number(p[1])+'. '+p[0];li.appendChild(a);li.appendChild(document.createTextNode(' – '+i.title));if(i.caseTitle){var s=document.createElement('span');s.className='block text-xs text-slate-500';s.textContent=i.caseTitle;li.appendChild(s)}list.appendChild(li)});
root.appendChild(box);}catch(e){}})();`;

export default function OfflinePage() {
    return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10 text-center">
            <span className="rounded-2xl bg-indigo-600 p-4 text-white" aria-hidden="true"><Scale size={36} /></span>
            <h1 className="mt-5 text-xl font-bold text-slate-900">Jste offline</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Kancelář potřebuje připojení k internetu. Z bezpečnostních důvodů se data spisů ani klientů neukládají do zařízení. Jakmile se spojení vrátí, otevřete aplikaci znovu.</p>
            <div id="offline-root" suppressHydrationWarning className="w-full" dangerouslySetInnerHTML={{ __html: '' }} />
            <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: SCRIPT }} />
        </main>
    );
}
