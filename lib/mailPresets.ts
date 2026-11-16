// Přednastavení poskytovatelů pošty (sdílené mezi prohlížečem a serverem)
export const PRESETS: Record<string, { label: string; imapHost: string; imapPort: number; smtpHost: string; smtpPort: number; skipAppend?: boolean; help: string }> = {
    gmail: { label: 'Gmail', imapHost: 'imap.gmail.com', imapPort: 993, smtpHost: 'smtp.gmail.com', smtpPort: 465, skipAppend: true, help: 'V účtu Google zapněte dvoufázové ověření a vytvořte „Heslo aplikace“ (myaccount.google.com/apppasswords). Použijte ho místo běžného hesla.' },
    seznam: { label: 'Seznam / Email.cz', imapHost: 'imap.seznam.cz', imapPort: 993, smtpHost: 'smtp.seznam.cz', smtpPort: 465, help: 'V nastavení Seznamu zapněte IMAP/SMTP (Nastavení → Přístup přes e-mailové programy) a případně vytvořte heslo pro externí aplikace.' },
    centrum: { label: 'Centrum / Atlas', imapHost: 'imap.centrum.cz', imapPort: 993, smtpHost: 'smtp.centrum.cz', smtpPort: 465, help: 'V nastavení schránky povolte přístup přes IMAP a SMTP.' },
    jiny: { label: 'Jiný poskytovatel (IMAP/SMTP)', imapHost: '', imapPort: 993, smtpHost: '', smtpPort: 465, help: 'Zadejte servery IMAP a SMTP od svého poskytovatele. Microsoft 365 a Outlook.com přihlášení heslem už nepovolují, pro ně tato funkce zatím nefunguje.' },
};
