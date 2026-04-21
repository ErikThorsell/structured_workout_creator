// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parseGpx } from './gpx-parser';

const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <trkseg>
      <trkpt lat="59.33" lon="18.07">
        <ele>10</ele>
      </trkpt>
      <trkpt lat="59.34" lon="18.07">
        <ele>15</ele>
      </trkpt>
      <trkpt lat="59.35" lon="18.07">
        <ele>20</ele>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe('parseGpx', () => {
  it('parses track points', () => {
    const route = parseGpx(SAMPLE_GPX);
    expect(route.points).toHaveLength(3);
    expect(route.points[0].lat).toBe(59.33);
    expect(route.points[0].lon).toBe(18.07);
    expect(route.points[0].ele).toBe(10);
  });

  it('computes cumulative distances', () => {
    const route = parseGpx(SAMPLE_GPX);
    expect(route.points[0].cumDist).toBe(0);
    expect(route.points[1].cumDist).toBeGreaterThan(0);
    expect(route.points[2].cumDist).toBeGreaterThan(route.points[1].cumDist);
  });

  it('computes total distance', () => {
    const route = parseGpx(SAMPLE_GPX);
    expect(route.totalDistance).toBe(route.points[2].cumDist);
    expect(route.totalDistance).toBeGreaterThan(0);
  });

  it('preserves raw XML', () => {
    const route = parseGpx(SAMPLE_GPX);
    expect(route.rawXml).toBe(SAMPLE_GPX);
  });

  it('throws on empty GPX', () => {
    const emptyGpx = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg></trkseg></trk></gpx>`;
    expect(() => parseGpx(emptyGpx)).toThrow('no track points');
  });

  it('throws on invalid XML', () => {
    expect(() => parseGpx('not xml')).toThrow('Invalid GPX');
  });
});
