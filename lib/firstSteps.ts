// První kroky na pracovní ploše. Krok, který nejde zjistit (chybí tabulka, chyba), se bere jako hotový, aby průvodce neotravoval.
export type FirstStep = { id: string; label: string; hint: string; href?: string; alt?: [string, string]; done: boolean };

export const firstStepsDone = (steps: FirstStep[]) => steps.every((s) => s.done);
