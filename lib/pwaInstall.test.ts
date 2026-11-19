import { describe, expect, it } from 'vitest';
import { detectPlatform, iosSafariCanInstall, shouldSuggest } from './pwaInstall';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15';
const base = { standalone: false, dismissedAt: null, now: 1_000_000_000_000, iosBrowserCanInstall: true };

describe('instalace aplikace na plochu', () => {
    it('pozná platformu včetně iPadu, který se hlásí jako Mac', () => {
        expect(detectPlatform(IPHONE_SAFARI)).toBe('ios');
        expect(detectPlatform(ANDROID)).toBe('android');
        expect(detectPlatform(MAC, 0)).toBe('desktop');
        expect(detectPlatform(MAC, 5)).toBe('ios');
    });
    it('na iPhonu rozliší Safari od Chromu', () => {
        expect(iosSafariCanInstall(IPHONE_SAFARI)).toBe(true);
        expect(iosSafariCanInstall(IPHONE_CHROME)).toBe(false);
    });
    it('doporučí jen na telefonu, jen mimo nainstalovanou aplikaci', () => {
        expect(shouldSuggest({ ...base, platform: 'android' })).toBe(true);
        expect(shouldSuggest({ ...base, platform: 'desktop' })).toBe(false);
        expect(shouldSuggest({ ...base, platform: 'android', standalone: true })).toBe(false);
        expect(shouldSuggest({ ...base, platform: 'ios', iosBrowserCanInstall: false })).toBe(false);
    });
    it('po zavření se 30 dní neukazuje', () => {
        const day = 86_400_000;
        expect(shouldSuggest({ ...base, platform: 'android', dismissedAt: base.now - 5 * day })).toBe(false);
        expect(shouldSuggest({ ...base, platform: 'android', dismissedAt: base.now - 31 * day })).toBe(true);
    });
});
