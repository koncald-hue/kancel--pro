// Přehled výkonu po právnících pro vedoucího kanceláře. Počítá se jen z toho, co kolega sám sdílí (součty za měsíc, nikdy popisy ani věci);
// kdo nesdílí, v číslech není a je to u něj vidět.
export type TeamMember = { user_id: string; name: string; shared: boolean; minutes: number | null; amount: number | null; billed_minutes: number | null };
export type MemberStat = { user_id: string; name: string; hours: number; value: number; unbilledHours: number; unbilledValue: number; realization: number | null; avgRate: number | null };
export type TeamTotals = { sharing: number; total: number; hours: number; value: number; unbilledHours: number; unbilledValue: number; realization: number | null };

const round1 = (n: number) => Math.round(n * 10) / 10;

export function teamStats(members: TeamMember[]): { rows: MemberStat[]; hidden: string[]; totals: TeamTotals } {
    const rows: MemberStat[] = []; const hidden: string[] = [];
    for (const m of members) {
        if (!m.shared) { hidden.push(m.name); continue; }
        const min = Number(m.minutes ?? 0), billed = Math.min(min, Number(m.billed_minutes ?? 0)), value = Number(m.amount ?? 0);
        const unbilledMin = min - billed;
        rows.push({ user_id: m.user_id, name: m.name, hours: round1(min / 60), value: Math.round(value), unbilledHours: round1(unbilledMin / 60), unbilledValue: min > 0 ? Math.round(value * (unbilledMin / min)) : 0, realization: min > 0 ? Math.round((billed / min) * 100) : null, avgRate: min > 0 ? Math.round(value / (min / 60)) : null });
    }
    rows.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'cs'));
    const hours = round1(rows.reduce((s, r) => s + r.hours, 0)), unbilledHours = round1(rows.reduce((s, r) => s + r.unbilledHours, 0));
    return { rows, hidden, totals: { sharing: rows.length, total: members.length, hours, value: rows.reduce((s, r) => s + r.value, 0), unbilledHours, unbilledValue: rows.reduce((s, r) => s + r.unbilledValue, 0), realization: hours > 0 ? Math.round(((hours - unbilledHours) / hours) * 100) : null } };
}
