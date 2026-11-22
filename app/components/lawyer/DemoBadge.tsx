// Výrazný štítek u ukázkových dat, aby nešla splést s vlastní prací. Ukázka se nepočítá do přehledů peněz ani výkonu.
export default function DemoBadge({ className = '' }: { className?: string }) {
    return <span title="Ukázkový údaj. Nepočítá se do vašich přehledů." className={`inline-block rounded-md border border-amber-400 bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] font-extrabold uppercase tracking-wide text-amber-950 ${className}`}>Ukázka</span>;
}
