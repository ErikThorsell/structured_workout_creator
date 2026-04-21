import type { TrackPoint } from '../types/workout';

const R = 6371000; // Earth radius in meters

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function snapToRoute(
  lat: number,
  lon: number,
  points: TrackPoint[],
): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = haversineDistance(lat, lon, points[i].lat, points[i].lon);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function interpolatePoint(
  points: TrackPoint[],
  targetDist: number,
): { lat: number; lon: number } {
  if (targetDist <= 0) return { lat: points[0].lat, lon: points[0].lon };
  for (let i = 1; i < points.length; i++) {
    if (points[i].cumDist >= targetDist) {
      const prev = points[i - 1];
      const segLen = points[i].cumDist - prev.cumDist;
      if (segLen === 0) return { lat: prev.lat, lon: prev.lon };
      const frac = (targetDist - prev.cumDist) / segLen;
      return {
        lat: prev.lat + frac * (points[i].lat - prev.lat),
        lon: prev.lon + frac * (points[i].lon - prev.lon),
      };
    }
  }
  const last = points[points.length - 1];
  return { lat: last.lat, lon: last.lon };
}

export function computeCumulativeDistances(points: TrackPoint[]): void {
  if (points.length === 0) return;
  points[0].cumDist = 0;
  for (let i = 1; i < points.length; i++) {
    const d = haversineDistance(
      points[i - 1].lat,
      points[i - 1].lon,
      points[i].lat,
      points[i].lon,
    );
    points[i].cumDist = points[i - 1].cumDist + d;
  }
}
