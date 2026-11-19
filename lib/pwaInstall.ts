// Pomůcky pro instalaci aplikace na plochu (PWA). Čisté funkce, aby šly otestovat bez prohlížeče.
export type InstallPlatform = 'ios' | 'android' | 'desktop';

export function detectPlatform(ua: string, maxTouchPoints = 0): InstallPlatform {
    if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1)) return 'ios'; // iPadOS se hlásí jako Mac
    if (/Android/i.test(ua)) return 'android';
    return 'desktop';
}

// Doporučení se ukazuje jen na telefonu a tabletu, jen když aplikace ještě neběží jako nainstalovaná a po zavření ho 30 dní nezobrazujeme
export const DISMISS_DAYS = 30;
export function shouldSuggest(o: { platform: InstallPlatform; standalone: boolean; dismissedAt: number | null; now: number; iosBrowserCanInstall: boolean }): boolean {
    if (o.standalone || o.platform === 'desktop') return false;
    if (o.platform === 'ios' && !o.iosBrowserCanInstall) return false;
    return o.dismissedAt === null || o.now - o.dismissedAt > DISMISS_DAYS * 86_400_000;
}

// Na iPhonu jde aplikaci přidat jen ze Safari; v Chromu, Firefoxu a v prohlížečích uvnitř aplikací (Gmail, Facebook) tlačítko Sdílet → Přidat na plochu chybí
export const iosSafariCanInstall = (ua: string) => /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|GSA|Line\//i.test(ua);

export const INSTALL_STEPS: Record<InstallPlatform, { title: string; steps: string[] }> = {
    ios: { title: 'iPhone nebo iPad (Safari)', steps: ['Otevřete Kancelář v prohlížeči Safari.', 'Klepněte na ikonu Sdílet (čtvereček se šipkou nahoru).', 'Vyberte „Přidat na plochu“ a potvrďte.', 'Aplikaci pak spustíte ikonou na ploše.'] },
    android: { title: 'Android (Chrome)', steps: ['Otevřete Kancelář v Chromu.', 'Klepněte na tlačítko „Nainstalovat“ níže, nebo na ⋮ vpravo nahoře a vyberte „Nainstalovat aplikaci“.', 'Potvrďte. Ikona se objeví na ploše.'] },
    desktop: { title: 'Počítač (Chrome, Edge)', steps: ['Otevřete Kancelář v Chromu nebo Edgi.', 'V adresním řádku vpravo klikněte na ikonu instalace (monitor se šipkou), nebo v nabídce zvolte „Nainstalovat Kancelář“.', 'Aplikace se otevře ve vlastním okně a najdete ji i v nabídce Start nebo v Launchpadu.'] },
};
