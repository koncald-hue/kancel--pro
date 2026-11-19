'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { INSTALL_STEPS, detectPlatform, iosSafariCanInstall, shouldSuggest } from '@/lib/pwaInstall';
import { ghostBtn, primaryBtn } from '../situation/caseUi';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
const KEY = 'kancelar-install-dismissed';

// Událost „lze nainstalovat“ přijde jen jednou a brzy, proto se zachytí na úrovni modulu
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent; emit(); });
    window.addEventListener('appinstalled', () => { deferred = null; emit(); });
}
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const readDismissed = () => { try { const v = Number(localStorage.getItem(KEY)); return v > 0 ? v : null; } catch { return null; } };

function useInstall() {
    const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
    const env = useSyncExternalStore(subscribe, () => {
        const ua = navigator.userAgent;
        const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
        const platform = detectPlatform(ua, navigator.maxTouchPoints); const safari = iosSafariCanInstall(ua);
        const suggest = shouldSuggest({ platform, standalone, dismissedAt: readDismissed(), now: Date.now(), iosBrowserCanInstall: safari });
        return `${platform}|${standalone ? 1 : 0}|${safari ? 1 : 0}|${suggest ? 1 : 0}`;
    }, () => 'desktop|0|0|0');
    const [platform, standalone, safari, suggest] = env.split('|');
    const install = useCallback(async () => { if (!deferred) return; await deferred.prompt(); await deferred.userChoice.catch(() => null); deferred = null; emit(); }, []);
    return { platform: platform as 'ios' | 'android' | 'desktop', standalone: standalone === '1', iosBrowserCanInstall: safari === '1', canPrompt, suggest: suggest === '1', install };
}

function Steps({ platform }: { platform: 'ios' | 'android' | 'desktop' }) {
    const g = INSTALL_STEPS[platform];
    return <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{g.title}</p><ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-slate-700">{g.steps.map((s) => <li key={s}>{s}</li>)}</ol></div>;
}

// Jednorázové doporučení nahoře na telefonu; po zavření se 30 dní neukáže
export function InstallBanner() {
    const i = useInstall();
    const [hidden, setHidden] = useState(false);
    const [guide, setGuide] = useState(false);
    const show = !hidden && i.suggest;
    if (!show) return null;
    const dismiss = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* nic */ } setHidden(true); };
    return (
        <div role="region" aria-label="Doporučení: aplikace na plochu" className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex items-start gap-3">
                <Smartphone size={20} className="mt-0.5 shrink-0 text-indigo-700" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-indigo-950">Mějte Kancelář po ruce jako aplikaci</p>
                    <p className="mt-0.5 text-sm text-indigo-900">Ikona na ploše, otevře se na celou obrazovku a lhůty máte o klepnutí blíž. Žádná data se do telefonu neukládají.</p>
                    {guide && <div className="mt-3 rounded-xl bg-white p-3"><Steps platform={i.platform} /></div>}
                    <div className="mt-3 flex flex-wrap gap-2">
                        {i.canPrompt ? <button type="button" onClick={() => void i.install()} className={primaryBtn}><Download size={15} /> Nainstalovat</button>
                            : !guide && <button type="button" onClick={() => setGuide(true)} className={primaryBtn}>Jak na to</button>}
                        <button type="button" onClick={dismiss} className={ghostBtn}>Teď ne</button>
                    </div>
                </div>
                <button type="button" onClick={dismiss} aria-label="Zavřít doporučení" className="rounded-lg p-1 text-indigo-700 hover:bg-indigo-100"><X size={16} /></button>
            </div>
        </div>
    );
}

// Trvalý návod v Nastavení pro všechny platformy
export function InstallCard() {
    const i = useInstall();
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="pwa-h">
            <h2 id="pwa-h" className="flex items-center gap-2 text-lg font-bold text-slate-900"><Smartphone size={18} className="text-indigo-700" aria-hidden="true" /> Aplikace na plochu</h2>
            {i.standalone ? <p className="mt-2 text-sm text-emerald-800">Kancelář už běží jako nainstalovaná aplikace.</p> : (
                <>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">Kancelář si můžete přidat na plochu telefonu nebo počítače. Otevře se jako samostatná aplikace, bez adresního řádku. Z bezpečnostních důvodů se do zařízení neukládají žádná data spisů ani klientů, aplikace tedy potřebuje připojení k internetu.</p>
                    {i.canPrompt && <button type="button" onClick={() => void i.install()} className={`${primaryBtn} mt-3`}><Download size={15} /> Nainstalovat do tohoto zařízení</button>}
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">{(['ios', 'android', 'desktop'] as const).map((p) => <Steps key={p} platform={p} />)}</div>
                </>
            )}
        </section>
    );
}
