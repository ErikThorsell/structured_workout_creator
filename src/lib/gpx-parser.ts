import type { GpxRoute, TrackPoint } from '../types/workout';
import { computeCumulativeDistances } from './route-utils';

export function parseGpx(xml: string): GpxRoute {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid GPX file: ' + parseError.textContent);
  }

  const trkpts = doc.querySelectorAll('trkpt');
  if (trkpts.length === 0) {
    throw new Error('GPX file contains no track points');
  }

  const points: TrackPoint[] = [];
  trkpts.forEach((pt) => {
    const lat = parseFloat(pt.getAttribute('lat') ?? '0');
    const lon = parseFloat(pt.getAttribute('lon') ?? '0');
    const eleEl = pt.querySelector('ele');
    const ele = eleEl ? parseFloat(eleEl.textContent ?? '0') : 0;
    points.push({ lat, lon, ele, cumDist: 0 });
  });

  computeCumulativeDistances(points);

  const totalDistance = points.length > 0 ? points[points.length - 1].cumDist : 0;

  return { rawXml: xml, points, totalDistance };
}
