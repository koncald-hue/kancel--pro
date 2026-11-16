import type { LawyerAccess } from './lawyer';
import { isValidIco, cleanIco } from './ares';
import { toIban } from './qrPayment';

// První krok po koupi (i po zahájení zkušebního přístupu): bez vyplnění těchto údajů se Kancelář neotevře
export type StepId = 'profil' | 'kancelar' | 'sifrovani';
export type Step = { id: StepId; label: string; hint: string; done: boolean };

export const hasBillingBasics = (a: Pick<LawyerAccess, 'firm_name' | 'ico' | 'bank_account'>) =>
    !!a.firm_name?.trim() && !!a.ico && isValidIco(cleanIco(a.ico)) && !!a.bank_account && toIban(a.bank_account) !== null;

export function onboardingSteps(a: LawyerAccess): Step[] {
    return [
        { id: 'profil', label: 'Váš profil', hint: 'Jméno, evidenční číslo ČAK, adresa kanceláře, telefon a e-mail pro klienty. Uvidí je klienti na své stránce.', done: a.verification_status === 'verified' },
        { id: 'kancelar', label: 'Kancelář a fakturace', hint: 'Název na dokladech, IČO a číslo účtu. Použijí se na vyúčtováních a v QR platbě.', done: hasBillingBasics(a) },
        { id: 'sifrovani', label: 'Šifrovací heslo', hint: 'Chrání zprávy a soubory ve spolupráci s klienty. Bez něj nejde vytvořit klientskou stránku.', done: !!(a.e2ee_salt && a.e2ee_wrapped_master) },
    ];
}
export const onboardingComplete = (a: LawyerAccess) => onboardingSteps(a).every((s) => s.done);
