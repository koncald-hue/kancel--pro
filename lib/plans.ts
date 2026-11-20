// Tarify předplatného: měsíční, půlroční a roční
export type PlanId = 'month' | 'half' | 'year';
export type Prices = Record<PlanId, number>;

export const PLANS: { id: PlanId; name: string; unit: string; months: number }[] = [
    { id: 'month', name: 'Měsíční', unit: 'za měsíc', months: 1 },
    { id: 'half', name: 'Půlroční', unit: 'za 6 měsíců', months: 6 },
    { id: 'year', name: 'Roční', unit: 'za rok', months: 12 },
];

export const planName = (id: string) => PLANS.find((p) => p.id === id)?.name ?? id;
export const EMPTY_PRICES: Prices = { month: 0, half: 0, year: 0 };

// Kolik se ušetří oproti měsíčnímu placení
export const saving = (prices: Prices, id: PlanId) => {
    const plan = PLANS.find((p) => p.id === id);
    return plan && prices.month > 0 && prices[id] > 0 ? Math.max(0, prices.month * plan.months - prices[id]) : 0;
};

// Sleva v procentech oproti měsíčnímu placení (zaokrouhleno)
export const savingPct = (prices: Prices, id: PlanId) => {
    const plan = PLANS.find((p) => p.id === id);
    return plan && prices.month > 0 && prices[id] > 0 ? Math.max(0, Math.round((1 - prices[id] / (prices.month * plan.months)) * 100)) : 0;
};
