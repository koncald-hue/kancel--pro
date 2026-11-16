'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';
import { WMS_URL, type AddressHit, type MapParcel } from '@/lib/katastrMap';
import { inputCls, primaryBtn } from '../situation/caseUi';

type Call = (params: Record<string, string>) => Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; message: string }>;

// Mapa katastru: podklad OpenStreetMap, nad ním hranice parcel z veřejné služby ČÚZK. Klik na parcelu ji otevře, adresa mapu přiblíží.
export default function KatastrMap({ call, onParcel, busy }: { call: Call; onParcel: (p: MapParcel) => void; busy: boolean }) {
    const host = useRef<HTMLDivElement>(null);
    const map = useRef<Leaflet.Map | null>(null);
    const lib = useRef<typeof Leaflet | null>(null);
    const outline = useRef<Leaflet.Polygon | null>(null);
    const marker = useRef<Leaflet.Marker | null>(null);
    const onParcelRef = useRef(onParcel);
    const callRef = useRef(call);
    useEffect(() => { onParcelRef.current = onParcel; callRef.current = call; });

    const [q, setQ] = useState('');
    const [hits, setHits] = useState<AddressHit[]>([]);
    const [searching, setSearching] = useState(false);
    const [clicking, setClicking] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        let disposed = false;
        (async () => {
            const L = (await import('leaflet')).default as unknown as typeof Leaflet;
            if (disposed || !host.current || map.current) return;
            lib.current = L;
            const m = L.map(host.current, { center: [49.8, 15.5], zoom: 7, minZoom: 6, maxBounds: [[48, 11.5], [51.4, 19.3]] });
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© přispěvatelé OpenStreetMap' }).addTo(m);
            L.tileLayer.wms(WMS_URL, { layers: 'CP.CadastralParcel,CP.CadastralBoundary', styles: ',', format: 'image/png', transparent: true, version: '1.3.0', minZoom: 15, maxZoom: 21, attribution: '© ČÚZK' } as Leaflet.WMSOptions).addTo(m);
            m.on('click', async (e: Leaflet.LeafletMouseEvent) => {
                if (m.getZoom() < 15) { setMessage('Přibližte mapu (vrstva parcel se ukáže od větší blízkosti) a klikněte na parcelu.'); return; }
                setMessage(''); setClicking(true);
                const r = await callRef.current({ op: 'bod', lat: String(e.latlng.lat), lon: String(e.latlng.lng) });
                setClicking(false);
                if (!r.ok) { setMessage(r.message); return; }
                const parcel = r.data.parcel as MapParcel | undefined;
                if (!parcel) { setMessage('Na tomto místě nebyla nalezena parcela.'); return; }
                outline.current?.remove();
                outline.current = L.polygon(parcel.ring, { color: '#4338ca', weight: 3, fillOpacity: 0.15 }).addTo(m);
                onParcelRef.current(parcel);
            });
            map.current = m;
        })();
        return () => { disposed = true; map.current?.remove(); map.current = null; };
    }, []);

    async function find(e: React.FormEvent) {
        e.preventDefault();
        if (q.trim().length < 3) return;
        setSearching(true); setMessage(''); setHits([]);
        const r = await call({ op: 'adresa', q });
        setSearching(false);
        if (!r.ok) { setMessage(r.message); return; }
        const list = (r.data.results as AddressHit[]) ?? [];
        if (!list.length) setMessage('Adresa nebyla nalezena. Zkuste ulici, číslo a obec.');
        setHits(list);
    }

    function go(h: AddressHit) {
        const m = map.current; const L = lib.current;
        if (!m || !L) return;
        setHits([]); setQ(h.adresa); setMessage('Klikněte na parcelu na mapě.');
        m.setView([h.lat, h.lon], 19);
        marker.current?.remove();
        marker.current = L.marker([h.lat, h.lon], { icon: L.divIcon({ className: '', html: '<div style="width:14px;height:14px;border-radius:50%;background:#4338ca;border:2px solid #fff;box-shadow:0 0 0 2px #4338ca66"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }) }).addTo(m);
    }

    return (
        <div className="space-y-3">
            <form onSubmit={find} className="relative flex gap-2">
                <label className="sr-only" htmlFor="map-address">Adresa</label>
                <input id="map-address" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Adresa, např. náměstí Míru 21, Hustopeče nad Bečvou" className={inputCls} />
                <button type="submit" disabled={searching} className={primaryBtn}>{searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Najít</button>
                {hits.length > 0 && (
                    <ul className="absolute left-0 top-full z-[1000] mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                        {hits.map((h, i) => <li key={i}><button type="button" onClick={() => go(h)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-indigo-50 cursor-pointer"><MapPin size={14} className="shrink-0 text-indigo-700" /> {h.adresa}</button></li>)}
                    </ul>
                )}
            </form>
            <div className="relative overflow-hidden rounded-xl border border-slate-200">
                <div ref={host} className="h-[26rem] w-full" role="application" aria-label="Mapa katastru" />
                {(clicking || busy) && <div className="absolute right-3 top-3 z-[1000] inline-flex items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow"><Loader2 size={14} className="animate-spin" /> Načítám parcelu…</div>}
            </div>
            {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
            <p className="text-xs text-slate-500">Mapa: OpenStreetMap, hranice parcel ČÚZK (aktualizují se jednou denně). Při zobrazení mapy se vaše IP adresa předává těmto poskytovatelům dlaždic. Údaje o parcele se načtou z API katastru až po kliknutí.</p>
        </div>
    );
}
