// Potvrzení důležitých a nevratných akcí vlastním dialogem (místo prohlížečového confirm).
// confirmAction() vrací slib true/false; dialog vykresluje <ConfirmHost /> v kořenovém layoutu.
export type ConfirmOptions = { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean; typeToConfirm?: string };
export type ConfirmRequest = ConfirmOptions & { message: string; resolve: (ok: boolean) => void };

let listener: ((r: ConfirmRequest) => void) | null = null;
export const onConfirmRequest = (fn: ((r: ConfirmRequest) => void) | null) => { listener = fn; };

const DANGER = /smaz|smaž|odpojit|zruš|storn|skart|opustit|vrátit (tento )?import|odebrat|vypnout dvoufázové|nové klíče|přestat hlídat/i;
const DELETE = /smaz|smaž|odebrat|skart/i;
const SAYS_FINAL = /nevratn|nelze vrátit|nejde vrátit|zůstan|zachovan/i;

// Doplní do textu, že smazání je nevratné, pokud to text sám neříká
export function confirmText(message: string): string {
    return DELETE.test(message) && !SAYS_FINAL.test(message) ? `${message.trim()}\n\nSmazání je nevratné.` : message;
}

export function confirmAction(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
    const danger = opts.danger ?? DANGER.test(message);
    if (!listener) {
        // Bez hostitele dialogu (např. v testech) se použije prohlížečové potvrzení
        return Promise.resolve(typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(confirmText(message)) : false);
    }
    return new Promise((resolve) => listener!({ ...opts, danger, message: confirmText(message), resolve }));
}
