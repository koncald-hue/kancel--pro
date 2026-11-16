import { describe, expect, it } from 'vitest';
import { addressWhere, parseRef, parseWfsParcels, pointInParcel, pointInRing } from './katastrMap';

const SAMPLE = `<member><cp:CadastralParcel gml:id="CP.1"><cp:areaValue uom="m2">120</cp:areaValue><cp:geometry><gml:Polygon><gml:exterior><gml:LinearRing><gml:posList srsDimension="2">50.0 14.0 50.0 14.1 50.1 14.1 50.1 14.0 50.0 14.0</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></cp:geometry><cp:label>1152/5</cp:label><cp:nationalCadastralReference>727024-1152/5</cp:nationalCadastralReference></cp:CadastralParcel></member>`;

describe('katastr map helpers', () => {
    it('parses cadastral references', () => {
        expect(parseRef('727024-1152/5')).toEqual({ ku: 727024, kmen: 1152, poddeleni: 5, druh: 2 });
        expect(parseRef('727024-st. 12')).toEqual({ ku: 727024, kmen: 12, druh: 1 });
        expect(parseRef('nic')).toBeNull();
    });
    it('reads parcels from WFS and finds the one containing a point', () => {
        const parcels = parseWfsParcels(SAMPLE);
        expect(parcels).toHaveLength(1);
        expect(parcels[0]).toMatchObject({ ku: 727024, kmen: 1152, poddeleni: 5, area: 120 });
        expect(pointInRing(50.05, 14.05, parcels[0].ring)).toBe(true);
        expect(pointInRing(50.2, 14.05, parcels[0].ring)).toBe(false);
    });
    it('treats a building cut out of a parcel as outside that parcel', () => {
        const xml = SAMPLE.replace('</gml:exterior>', '</gml:exterior><gml:interior><gml:LinearRing><gml:posList>50.04 14.04 50.04 14.06 50.06 14.06 50.06 14.04 50.04 14.04</gml:posList></gml:LinearRing></gml:interior>');
        const [p] = parseWfsParcels(xml);
        expect(p.holes).toHaveLength(1);
        expect(pointInParcel(50.05, 14.05, p)).toBe(false);
        expect(pointInParcel(50.02, 14.02, p)).toBe(true);
    });
    it('builds a safe address query', () => {
        expect(addressWhere("Náměstí Míru 1'; drop")).toContain("like '%NÁMĚSTÍ%'");
        expect(addressWhere("Náměstí Míru 1'; drop")).not.toContain(';');
        expect(addressWhere('a')).toBeNull();
    });
});
