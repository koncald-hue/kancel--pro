import { daysUntil } from '@/lib/cases';
import type { CaseDeadlineView } from '@/lib/caseFile';
import { shortDate } from './caseUi';

const DAY = 86_400_000;
const dot = (left: number) => (left < 0 ? 'bg-slate-400' : left <= 3 ? 'bg-rose-600' : left <= 10 ? 'bg-indigo-500' : 'bg-emerald-600');

// Vodorovná osa: dnešek a termíny v poměrném odstupu, barvy podle zbývajícího času
export default function DeadlineAxis({ deadlines }: { deadlines: CaseDeadlineView[] }) {
    const items = deadlines.filter((d) => !d.done);
    if (items.length === 0) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const times = items.map((d) => d.date.getTime());
    const start = Math.min(today, ...times) - DAY * 2;
    const end = Math.max(today + 14 * DAY, ...times) + DAY * 2;
    const pos = (t: number) => ((t - start) / (end - start)) * 100;

    return (
        <div className="rounded-xl border border-slate-200 bg-white px-4 pb-4 pt-3" aria-hidden="true">
            <div className="relative h-28">
                <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200" />
                <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${pos(today)}%` }}>
                    <div className="-translate-x-1/2 text-center">
                        <div className="mx-auto h-5 w-0.5 bg-slate-800" />
                        <span className="mt-0.5 block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white">Dnes</span>
                    </div>
                </div>
                {items.map((d, i) => {
                    const left = daysUntil(d.date);
                    const up = i % 2 === 0;
                    const x = Math.min(92, Math.max(8, pos(d.date.getTime())));
                    return (
                        <div key={d.key} className="absolute -translate-x-1/2" style={{ left: `${x}%`, top: up ? '0' : 'auto', bottom: up ? 'auto' : '0' }}>
                            <div className={`flex max-w-32 flex-col items-center text-center ${up ? '' : 'flex-col-reverse'}`}>
                                <span className="text-[10px] font-semibold leading-tight text-slate-700">{d.title.length > 34 ? `${d.title.slice(0, 33)}…` : d.title}</span>
                                <span className="text-[10px] text-slate-500">{shortDate(d.date)}</span>
                                <span className={`my-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow ${dot(left)}`} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
