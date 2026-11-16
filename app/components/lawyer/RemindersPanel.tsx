'use client';

import type { Receivable } from '@/lib/billing';

// Místo pro upomínky (doplní se v dalším kroku)
export default function RemindersPanel({ invoices, userId, onChanged }: { invoices: Receivable[]; userId: string; onChanged: () => void | Promise<void> }) {
    void invoices; void userId; void onChanged;
    return null;
}
